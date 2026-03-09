# Phase 7: Security & Token Management Hardening

## Overview

Build Fastn-like capabilities (multi-tenant isolation, encrypted token vault, audit logging) **without vendor lock-in**.

---

## Phase 7A: Encrypted Token Vault (Week 1-2)

### Current State
- eBay tokens stored directly in KV with plain JSON
- No encryption
- No rotation mechanism
- Limited audit trail

### Target State
```
User logs in with eBay OAuth
    ↓
Exchange code for token
    ↓
Encrypt token + metadata
    ↓
Store in KV with TTL
    ↓
Log action to D1 (audit trail)
    ↓
Queue consumer retrieves → decrypts → uses
```

### Implementation

**1. Add encryption types**
```typescript
// worker/security/types.ts
export interface EncryptedToken {
  id: string;                    // UUID
  userId: string;                // tenant/user
  platform: "ebay" | "shopify";  // platform
  encryptedPayload: string;      // base64(AES-256-GCM)
  nonce: string;                 // IV for encryption
  expiresAt: string;             // ISO timestamp
  createdAt: string;
  lastUsedAt: string;            // For rotation tracking
  rotationCount: number;         // API calls until refresh
}

export interface TokenVaultConfig {
  encryptionKey: string;         // From Worker Secret
  rotationThreshold: number;     // 1000 uses
  ttlSeconds: number;            // 86400 (24h)
}
```

**2. Implement TokenVault class**
```typescript
// worker/security/TokenVault.ts
export class TokenVault {
  private cryptoKey: CryptoKey;
  
  async encryptToken(payload: any): Promise<string> {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      this.cryptoKey,
      data
    );
    
    return btoa(JSON.stringify({
      nonce: btoa(String.fromCharCode(...nonce)),
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    }));
  }
  
  async decryptToken(encoded: string): Promise<any> {
    const { nonce, encrypted } = JSON.parse(atob(encoded));
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(atob(nonce).split('').map(c => c.charCodeAt(0))) },
      this.cryptoKey,
      new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)))
    );
    
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
  
  async storeToken(token: EncryptedToken): Promise<void> {
    await env.TOKENS.put(
      `vault:${token.userId}:${token.platform}`,
      JSON.stringify(token),
      { expirationTtl: token.ttlSeconds }
    );
  }
  
  async retrieveToken(userId: string, platform: string): Promise<any> {
    const stored = await env.TOKENS.get(`vault:${userId}:${platform}`);
    if (!stored) return null;
    
    const token = JSON.parse(stored) as EncryptedToken;
    const decrypted = await this.decryptToken(token.encryptedPayload);
    
    // Log retrieval
    await this.auditLog(userId, platform, "token_retrieved");
    
    return decrypted;
  }
  
  private async auditLog(userId: string, platform: string, action: string) {
    await env.DB.prepare(`
      INSERT INTO token_audit_log (id, user_id, platform, action, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      platform,
      action,
      new Date().toISOString()
    ).run();
  }
}
```

**3. Add D1 audit table**
```sql
-- migrations/20260308_token_vault.sql
CREATE TABLE IF NOT EXISTS token_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_token_audit_user_time 
ON token_audit_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS token_rotation_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  old_token_hash TEXT,
  new_token_hash TEXT,
  rotation_reason TEXT,
  rotated_at TEXT NOT NULL
);
```

**4. Integration points**

Update `browser-jobs.ts`:
```typescript
// Before: Direct KV retrieval
// const sessionData = await env.TOKENS.get(`ebay_session:${listingId}`);

// After: Vault decryption
const vault = new TokenVault(env);
const sessionData = await vault.retrieveToken(userId, "ebay");
```

---

## Phase 7B: Multi-tenant Token Isolation (Week 2-3)

### Current State
- All users share same token namespace
- No store/workspace isolation
- Future-proof for: User → Store → Workspace hierarchy

### Target State
```typescript
/kv/vault:store123:user456:ebay
/kv/vault:store123:user789:shopify
/kv/vault:store999:user123:ebay
```

### Implementation

**1. Add tenant context**
```typescript
// worker/types/env.ts
export interface TenantContext {
  storeId: string;       // Multi-tenant root
  userId: string;        // User within store
  workspaceId?: string;  // Team within store (optional)
  permissions: string[]; // ["listings:read", "tokens:manage"]
}

// Update Env interface
export interface Env {
  // ... existing ...
  TENANT_CONTEXT?: TenantContext;  // Set by auth middleware
}
```

**2. Update TokenVault**
```typescript
// worker/security/TokenVault.ts
export class TenantAwareTokenVault extends TokenVault {
  async storeTokenForTenant(
    tenant: TenantContext,
    platform: string,
    token: any
  ): Promise<void> {
    const kvKey = `vault:${tenant.storeId}:${tenant.userId}:${platform}`;
    
    const encrypted = await this.encryptToken(token);
    const record: EncryptedToken = {
      id: crypto.randomUUID(),
      userId: tenant.userId,
      platform,
      encryptedPayload: encrypted,
      // ... other fields
    };
    
    await env.TOKENS.put(kvKey, JSON.stringify(record), {
      expirationTtl: 86400
    });
    
    // Log with tenant context
    await this.auditLogTenant(tenant, platform, "token_stored");
  }
  
  async retrieveTokenForTenant(
    tenant: TenantContext,
    platform: string
  ): Promise<any> {
    const kvKey = `vault:${tenant.storeId}:${tenant.userId}:${platform}`;
    const stored = await env.TOKENS.get(kvKey);
    
    if (!stored) {
      throw new LoginRequiredError(`No ${platform} token for user ${tenant.userId}`);
    }
    
    const token = JSON.parse(stored) as EncryptedToken;
    return await this.decryptToken(token.encryptedPayload);
  }
  
  private async auditLogTenant(
    tenant: TenantContext,
    platform: string,
    action: string
  ) {
    await env.DB.prepare(`
      INSERT INTO token_audit_log 
      (id, store_id, user_id, workspace_id, platform, action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.storeId,
      tenant.userId,
      tenant.workspaceId || null,
      platform,
      action,
      new Date().toISOString()
    ).run();
  }
}
```

---

## Phase 7C: Token Rotation & Refresh (Week 3)

### Mechanism
```
Each token tracks:
├─ rotationCount (API calls made)
├─ maxRotation (threshold, e.g., 1000)
└─ lastRotation (timestamp)

When rotationCount > maxRotation:
├─ Trigger refresh with OAuth2 refresh_token
├─ Encrypt new token
├─ Log rotation to D1
└─ Update KV
```

### Implementation

**1. Rotation checker**
```typescript
// worker/security/TokenRotation.ts
export class TokenRotationManager {
  async shouldRotate(token: EncryptedToken): Promise<boolean> {
    return token.rotationCount > token.maxRotation ||
           this.isExpiringSoon(token.expiresAt);
  }
  
  private isExpiringSoon(expiresAt: string): boolean {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24;
  }
  
  async rotateToken(
    tenant: TenantContext,
    platform: "ebay" | "shopify",
    refreshToken: string
  ): Promise<string> {
    // Call platform's refresh endpoint
    const newToken = await this.exchangeRefreshToken(platform, refreshToken);
    
    // Encrypt and store
    const vault = new TenantAwareTokenVault(env);
    await vault.storeTokenForTenant(tenant, platform, {
      ...newToken,
      rotationCount: 0
    });
    
    // Log rotation
    await this.logRotation(tenant, platform, "auto_refresh");
    
    return newToken.access_token;
  }
  
  private async exchangeRefreshToken(
    platform: string,
    refreshToken: string
  ): Promise<any> {
    // Platform-specific OAuth2 refresh logic
    if (platform === "ebay") {
      return await this.refreshEbayToken(refreshToken);
    } else if (platform === "shopify") {
      return await this.refreshShopifyToken(refreshToken);
    }
  }
}
```

**2. Queue consumer integration**
```typescript
// worker/queues/browser-jobs.ts
async function handleBrowserJobsBatch(...) {
  for (const message of messages) {
    const vault = new TenantAwareTokenVault(env);
    const rotationMgr = new TokenRotationManager(env);
    
    // Retrieve token
    let token = await vault.retrieveTokenForTenant(tenant, "ebay");
    
    // Check if rotation needed
    if (await rotationMgr.shouldRotate(token)) {
      token = await rotationMgr.rotateToken(tenant, "ebay", token.refresh_token);
    }
    
    // Use token...
  }
}
```

---

## Phase 7D: Observability & Compliance (Week 4)

### Metrics to track
```typescript
// worker/observability/TokenMetrics.ts
export class TokenMetrics {
  async recordTokenUsage(
    tenant: TenantContext,
    platform: string,
    success: boolean,
    duration_ms: number
  ) {
    await env.DB.prepare(`
      INSERT INTO token_usage_metrics
      (id, store_id, user_id, platform, success, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenant.storeId,
      tenant.userId,
      platform,
      success ? 1 : 0,
      duration_ms,
      new Date().toISOString()
    ).run();
  }
  
  async getComplianceReport(storeId: string, days: number = 90) {
    return env.DB.prepare(`
      SELECT 
        user_id,
        platform,
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        AVG(duration_ms) as avg_latency,
        MAX(created_at) as last_used
      FROM token_usage_metrics
      WHERE store_id = ? AND created_at > datetime('now', '-${days} days')
      GROUP BY user_id, platform
    `).bind(storeId).all();
  }
}
```

### Compliance checks
```typescript
// worker/security/ComplianceChecker.ts
export class ComplianceChecker {
  async generateSOC2Report(storeId: string) {
    const auditLog = await env.DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT platform) as platforms_accessed
      FROM token_audit_log
      WHERE store_id = ? AND created_at > datetime('now', '-90 days')
      GROUP BY DATE(created_at)
    `).bind(storeId).all();
    
    // Export as JSON for compliance docs
    return {
      reportDate: new Date().toISOString(),
      storeId,
      period: "90 days",
      events: auditLog.results,
      signature: this.sign(auditLog)
    };
  }
  
  private sign(data: any): string {
    // HMAC-SHA256 signature for integrity
    const encoder = new TextEncoder();
    const message = encoder.encode(JSON.stringify(data));
    // ... sign with stored key
  }
}
```

---

## Testing & Deployment

### Unit tests
```typescript
// test/security/TokenVault.test.ts
describe("TokenVault", () => {
  it("encrypts and decrypts tokens", async () => {
    const vault = new TokenVault(mockEnv);
    const payload = { access_token: "abc123", user: "test" };
    
    const encrypted = await vault.encryptToken(payload);
    const decrypted = await vault.decryptToken(encrypted);
    
    expect(decrypted).toEqual(payload);
  });
  
  it("prevents cross-tenant token access", async () => {
    const vault = new TenantAwareTokenVault(mockEnv);
    const tenant1 = { storeId: "store1", userId: "user1" };
    const tenant2 = { storeId: "store2", userId: "user1" };
    
    await vault.storeTokenForTenant(tenant1, "ebay", { token: "abc" });
    
    const result = await vault.retrieveTokenForTenant(tenant2, "ebay");
    expect(result).toBeNull();
  });
});
```

### Rollout plan
```
Week 1: Deploy TokenVault (non-blocking)
  ↓
Week 2: Migrate tokens to encrypted storage
       (backward compat: read old, write new)
  ↓
Week 3: Enable multi-tenant isolation
  ↓
Week 4: Launch rotation + observability
```

---

## Success Metrics

- ✅ Zero unencrypted tokens in KV
- ✅ All token operations logged to D1
- ✅ Token rotation succeeds 100% of time
- ✅ Cross-tenant access attempts logged/blocked
- ✅ Compliance reports generate in <5s
- ✅ No performance regression (<10ms added latency)

---

## Cost Impact

| Component | Cost |
|-----------|------|
| Encryption (CPU) | <$1/month |
| D1 audit table | <$1/month |
| Token Vault code | 1 Developer-week |
| **Total** | **~$100 (dev time)** |

vs. Fastn: $500-2000/month for same features

---

## Migration Path for Phase 8+

Once Phase 7 complete:
- Add agent-specific token scopes
- Implement schema compression (Fastn idea)
- Add context-aware tool filtering
- Prepare for multi-agent coordination

**Then: You'll have Fastn-equivalent functionality with full control.**
