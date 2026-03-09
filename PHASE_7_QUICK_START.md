# Phase 7 Quick Start Guide

## Setup

### 1. Generate Encryption Key
```bash
# Generate 32 random bytes, convert to 64 hex chars
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123def456... (64 chars)
```

### 2. Set Environment Variables
```bash
# In wrangler.jsonc (secrets binding)
ENCRYPTION_KEY = "abc123def456..." # Your 64-char hex key

# OAuth credentials (optional, for rotation)
EBAY_OAUTH_CLIENT_ID = "..."
EBAY_OAUTH_CLIENT_SECRET = "..."
TIKTOK_CLIENT_ID = "..."
TIKTOK_CLIENT_SECRET = "..."
PINTEREST_APP_ID = "..."
PINTEREST_APP_SECRET = "..."
```

### 3. Run Migration
```bash
wrangler migrations apply --remote  # Apply 0004_token_vault.sql
```

---

## Usage Examples

### Store & Retrieve Encrypted Token
```typescript
import { TokenVault } from "./security/TokenVault";
import { TenantContext } from "./security/types";

// Create vault
const vault = await TokenVault.create(env);

// Store token
const tenant: TenantContext = {
  storeId: "store_123",
  userId: "user_456",
  permissions: ["tokens:write"],
};

const tokenId = await vault.storeToken(tenant, "ebay", {
  access_token: "ebay_token_xyz",
  refresh_token: "ebay_refresh_xyz",
  expires_in: 3600,
});

// Retrieve (auto-decrypts)
const token = await vault.retrieveToken(tenant, "ebay");
console.log(token.access_token); // Decrypted
```

### Check & Rotate Token
```typescript
import { TokenRotationManager } from "./security/TokenRotation";

const rotationMgr = new TokenRotationManager(vault, env.DB, env);

// Check if rotation needed
const shouldRotate = await rotationMgr.shouldRotate(tenant, "ebay");

if (shouldRotate) {
  const currentToken = await vault.retrieveToken(tenant, "ebay");
  const newToken = await rotationMgr.rotateToken(
    tenant,
    "ebay",
    currentToken
  );
  console.log("Token rotated:", newToken.access_token);
}
```

### Generate Compliance Report
```typescript
import { ComplianceChecker } from "./security/ComplianceChecker";

const checker = new ComplianceChecker(env.DB);

// Generate SOC2 report
const report = await checker.generateSOC2Report(tenant, 90); // Last 90 days
console.log(report.summary); // {totalEvents, uniqueUsers, ...}

// Export as CSV
const csv = await checker.exportAuditTrailCSV(tenant, 90);
fs.writeFileSync("audit_trail.csv", csv);
```

### Get Usage Metrics
```typescript
import { TokenMetrics } from "./security/TokenMetrics";

const metrics = new TokenMetrics(env.DB);

// Platform stats
const ebayStats = await metrics.getPlatformStats(tenant, "ebay", 30);
console.log(ebayStats); // {totalCalls, successRate, avgLatency, ...}

// Cost estimation
const costs = await metrics.estimateCosts(tenant, 30);
console.log(costs); // [{platform, estimatedCost, ...}]

// Error analysis
const errors = await metrics.getErrorRates(tenant, 30);
console.log(errors); // [{platform, errorRate, topErrors}]
```

---

## API Endpoints

### Compliance Reports
```bash
# Get SOC2 report (JSON)
curl "http://localhost:8787/api/security/compliance/soc2?days=90"

# Get SOC2 report (CSV)
curl "http://localhost:8787/api/security/compliance/soc2?days=90&format=csv" \
  -o compliance_report.csv
```

### Security Incidents
```bash
# Check for incidents in last 24h
curl "http://localhost:8787/api/security/incidents?hours=24"
```

### Metrics
```bash
# Platform-specific metrics
curl "http://localhost:8787/api/security/metrics/platform/ebay?days=30"

# All platforms
curl "http://localhost:8787/api/security/metrics/store?days=30"

# Cost estimation
curl "http://localhost:8787/api/security/metrics/costs?days=30"

# Error rates
curl "http://localhost:8787/api/security/metrics/errors?days=30"

# Action breakdown
curl "http://localhost:8787/api/security/metrics/actions/ebay?days=30"
```

---

## Monitoring

### Check Audit Log
```sql
-- All token operations for a user
SELECT * FROM token_audit_log 
WHERE user_id = 'user_456' 
ORDER BY created_at DESC;

-- Failed operations
SELECT * FROM token_audit_log 
WHERE action IN ('token_expired', 'token_failed')
ORDER BY created_at DESC;

-- Rotation history
SELECT * FROM token_rotation_history
ORDER BY rotated_at DESC;
```

### Performance Check
```sql
-- Average encryption latency
SELECT AVG(duration_ms) as avg_latency_ms
FROM token_usage_metrics
WHERE created_at > datetime('now', '-24 hours');

-- Success rate by platform
SELECT platform, 
  ROUND(100.0 * SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM token_usage_metrics
WHERE created_at > datetime('now', '-7 days')
GROUP BY platform;
```

---

## Troubleshooting

### "ENCRYPTION_KEY must be 64 hex characters"
- Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Ensure exactly 64 characters (32 bytes × 2 for hex)

### "No valid eBay token found"
- Check KV: `wrangler kv:key list --binding TOKENS` (should see `vault:...` keys)
- Verify tenant context: `storeId` and `userId` must match what was stored

### Token rotation keeps failing
- Check OAuth credentials in Worker Secrets
- Verify refresh token hasn't expired
- Check D1 `token_rotation_history` for error patterns

### Performance degradation
- Run: `SELECT AVG(duration_ms) FROM token_usage_metrics`
- Expected: <25ms added latency
- If >50ms, check D1 query load

---

## Key Files

| File | Purpose | LOC |
|------|---------|-----|
| `TokenVault.ts` | Encryption/decryption | 285 |
| `TokenRotation.ts` | OAuth2 refresh | 290 |
| `ComplianceChecker.ts` | SOC2 reports | 260 |
| `TokenMetrics.ts` | Usage metrics | 340 |
| `security.ts` (API) | HTTP handlers | 280 |

---

## Phase 7 Architecture

```
┌─────────────────────────────────────────┐
│ Queue Consumer (browser/social-jobs)   │
├─────────────────────────────────────────┤
│ 1. Create TenantContext                 │
│ 2. TokenVault.retrieveToken()          │ ← Decrypts
│ 3. TokenRotationMgr.shouldRotate()     │ ← Checks expiry/usage
│ 4. If needed: rotateToken()            │ ← OAuth2 refresh
│ 5. LogDispatch (audit trail)           │
│ 6. Use token for platform API          │
└─────────────────────────────────────────┘
         ↓                    ↓
    ┌────────────┐    ┌──────────────┐
    │ KV (TOKENS)│    │ D1 (Audit)   │
    │ Encrypted  │    │ Immutable    │
    └────────────┘    └──────────────┘
         ↑                    ↑
    ┌────────────────────────────────┐
    │ Compliance/Metrics APIs         │
    │ - SOC2 reports                 │
    │ - Cost estimation              │
    │ - Error analysis               │
    └────────────────────────────────┘
```

---

## Success Metrics

- ✅ All tokens encrypted (100% coverage)
- ✅ Audit log entries for all operations
- ✅ Token rotation automatic (no manual intervention)
- ✅ Performance <25ms added latency
- ✅ Zero security incidents

---

**Ready to deploy!** → See [PHASE_7_COMPLETE.md](./PHASE_7_COMPLETE.md)
