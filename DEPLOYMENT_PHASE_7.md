# Phase 7 Deployment Guide

**Target:** Staging (Mar 9-10) → Production (Mar 10-16)

---

## Pre-Deployment Checklist

### 1. Environment Setup

```bash
# Generate encryption key (32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123def456abc123def456abc123def456abc123def456abc123def456abc1
```

### 2. Secrets Configuration

Add to `wrangler.jsonc` (staging):

```json
{
  "name": "listing-factory-staging",
  "env": {
    "staging": {
      "vars": {
        "ENVIRONMENT": "staging",
        "STORE_NAME": "Test Store"
      },
      "kv_namespaces": [
        { "binding": "TOKENS", "id": "kv_staging_tokens_id" }
      ]
    }
  },
  "secrets": [
    "ENCRYPTION_KEY",
    "EBAY_OAUTH_CLIENT_ID",
    "EBAY_OAUTH_CLIENT_SECRET",
    "ETSY_OAUTH_CLIENT_ID",
    "ETSY_OAUTH_CLIENT_SECRET",
    "TIKTOK_CLIENT_ID",
    "TIKTOK_CLIENT_SECRET",
    "PINTEREST_APP_ID",
    "PINTEREST_APP_SECRET"
  ]
}
```

### 3. Set Secrets

```bash
# Encryption key (required)
wrangler secret put ENCRYPTION_KEY --env staging
# Paste: abc123def456...

# OAuth credentials (optional, for testing rotation)
wrangler secret put EBAY_OAUTH_CLIENT_ID --env staging
wrangler secret put EBAY_OAUTH_CLIENT_SECRET --env staging
# ... etc for other platforms
```

### 4. Run D1 Migration

```bash
# Apply token vault schema
wrangler migrations apply --remote --env staging

# Verify tables created
wrangler d1 execute listing-factory-db --env staging \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'token%';"
```

---

## Deployment Steps

### Stage 1: Staging Deployment

```bash
# 1. Verify code compiles
npm run type-check

# 2. Run unit tests
npm run test

# 3. Deploy to staging
wrangler deploy --env staging

# 4. Verify deployment
curl https://listing-factory-staging.worker.dev/api/health
# Should return 200 OK
```

### Stage 2: Smoke Tests (Staging)

```bash
# Test token encryption/decryption flow
curl -X POST https://listing-factory-staging.worker.dev/api/security/test/vault \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_encryption",
    "payload": {
      "access_token": "test_ebay_token",
      "refresh_token": "test_ebay_refresh"
    }
  }'

# Test audit logging
curl https://listing-factory-staging.worker.dev/api/security/compliance/soc2?days=1

# Test metrics
curl https://listing-factory-staging.worker.dev/api/security/metrics/store?days=1
```

### Stage 3: Integration Testing

```bash
# Run full integration test suite
npm run test:integration

# Monitor logs
wrangler tail --env staging

# Watch for:
# ✅ Token encryption succeeding
# ✅ D1 audit entries being written
# ✅ No unencrypted tokens in KV
```

### Stage 4: Load Testing (Optional)

```bash
# Simulate 100 token operations
for i in {1..100}; do
  curl -X POST https://listing-factory-staging.worker.dev/api/security/test/operation \
    -H "Content-Type: application/json" \
    -d '{"platform": "ebay", "action": "retrieve_token"}' &
done
wait

# Check metrics
curl https://listing-factory-staging.worker.dev/api/security/metrics/store
```

---

## Staging Validation

### 1. Encryption Working

```bash
# Query D1 for encrypted tokens
wrangler d1 execute listing-factory-db --env staging \
  --command "SELECT id, platform, encryptedPayload FROM token_audit_log LIMIT 1;"

# Verify encryptedPayload is base64 (not JSON plaintext)
```

### 2. Audit Logging Working

```bash
wrangler d1 execute listing-factory-db --env staging \
  --command "SELECT COUNT(*) as total FROM token_audit_log;"

# Should have entries from smoke tests
```

### 3. Token Rotation Ready

```bash
wrangler d1 execute listing-factory-db --env staging \
  --command "SELECT * FROM token_rotation_history LIMIT 5;"

# Should be empty (no tokens to rotate yet), but table exists
```

### 4. Compliance Reports Generating

```bash
# Verify SOC2 report endpoint
curl https://listing-factory-staging.worker.dev/api/security/compliance/soc2

# Should return JSON with:
# {
#   "reportId": "uuid",
#   "summary": { "totalEvents": N, ... },
#   "signature": "hash"
# }
```

---

## Production Deployment

### Pre-Production Checklist

- [ ] All staging tests passed
- [ ] Security review completed
- [ ] Encryption key backed up securely
- [ ] D1 backups enabled
- [ ] Monitoring/alerting configured
- [ ] Rollback plan tested

### Production Deployment

```bash
# 1. Deploy to production
wrangler deploy --env production

# 2. Set production secrets
wrangler secret put ENCRYPTION_KEY --env production
# Use SAME key as staging (don't regenerate)

# 3. Apply D1 migration (production)
wrangler migrations apply --remote --env production

# 4. Verify production deployment
curl https://listing-factory.worker.dev/api/health
```

### Post-Production Validation

```bash
# Monitor first 24 hours
wrangler tail --env production --format json | grep -E "encryption|audit|rotation"

# Key metrics to watch:
# ✅ Encryption CPU impact <5%
# ✅ D1 audit log growing (new entries every operation)
# ✅ Token operations completing <50ms
# ✅ Zero decryption failures
```

---

## Monitoring Setup

### CloudFlare Dashboards

**KV Metrics:**
```
TOKENS namespace:
- Read latency: <15ms
- Write latency: <20ms
- Key count: Should grow gradually
```

**D1 Metrics:**
```
token_audit_log table:
- Row count: Growing steadily
- Query latency: <100ms
- Storage size: <100MB for 90 days
```

**Worker Metrics:**
```
- Error rate: <0.1%
- CPU time: <10% increase vs Phase 6
- Requests/sec: Unchanged
```

### Logging Setup

Create `wrangler.tail` monitor:

```bash
# Watch for errors
wrangler tail --env production | grep -i error

# Watch for encryption operations
wrangler tail --env production | grep -i "encrypt\|decrypt"

# Watch for rotation
wrangler tail --env production | grep -i "rotation"
```

---

## Rollback Plan

### If Encryption Fails

```bash
# Disable vault and fall back to plaintext (temporary)
# In browser-jobs.ts, social-jobs.ts: catch vault.create() and continue

# Steps:
# 1. Deploy version with vault disabled
# 2. Investigate encryption error in logs
# 3. Fix crypto key or rotation logic
# 4. Re-enable and redeploy
```

### If D1 Audit Logging Fails

```bash
# D1 audit is non-blocking, so operations continue
# Fallback: Log to Worker stderr instead

# Monitor:
# wrangler tail | grep "Audit log failed"

# Fix:
# - Check D1 quota
# - Verify schema migration applied
# - Check permissions on D1 binding
```

### If Token Rotation Fails

```bash
# Tokens continue to work (rotation is optional)
# Fallback: Users must manually rotate if token expires

# Monitor:
# wrangler d1 execute ... --command "SELECT COUNT(*) FROM token_rotation_history;"

# Fix:
# - Verify OAuth credentials set correctly
# - Check platform API endpoints
# - Check refresh token validity
```

---

## Testing Checklist

### Unit Tests

```bash
npm run test -- test/security/TokenVault.test.ts
npm run test -- test/security/TokenMetrics.test.ts
```

Expected results:
- ✅ Encrypt/decrypt roundtrips work
- ✅ Multi-tenant isolation enforced
- ✅ Metrics aggregation correct
- ✅ Error handling graceful

### Integration Tests (Staging Only)

```bash
# Full flow: store → encrypt → retrieve → decrypt
npm run test:integration

# Verify:
# ✅ Token stored encrypted in KV
# ✅ Audit log entry created in D1
# ✅ Retrieved token decrypts correctly
# ✅ Rotation history tracked
```

### Manual Tests

```bash
# 1. Store a token
curl -X POST https://staging.worker.dev/api/tokens/store \
  -d '{"platform": "ebay", "access_token": "xyz"}'

# 2. Retrieve it
curl https://staging.worker.dev/api/tokens/retrieve?platform=ebay

# 3. Check audit log
curl https://staging.worker.dev/api/security/compliance/soc2

# 4. Check metrics
curl https://staging.worker.dev/api/security/metrics/store
```

---

## Success Criteria

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Encryption success rate | 100% | >99.5% |
| Audit log creation | 100% | >95% |
| Decryption latency | <5ms | <25ms |
| Total operation latency | <50ms | <100ms |
| D1 migration applied | ✅ | ✅ |
| Compliance report generation | <1s | <5s |
| Error rate | <0.1% | <1% |

---

## Troubleshooting

### "ENCRYPTION_KEY must be 64 hex characters"

```bash
# Check key format
wrangler secret list --env staging | grep ENCRYPTION_KEY

# Expected: 64 character hex string
# Example: abc123def456...
```

### "Failed to create TokenVault"

```bash
# Check KV binding
wrangler kv:key list --binding TOKENS

# Check D1 binding
wrangler d1 execute listing-factory-db --env staging --command "SELECT 1;"
```

### "Audit log not being written"

```bash
# Check D1 permissions
wrangler d1 execute listing-factory-db --env staging \
  --command "SELECT COUNT(*) FROM token_audit_log;"

# Check table exists
wrangler migrations apply --remote --env staging
```

### Decryption errors in logs

```bash
# Enable debug logging
// In TokenVault.ts, add console.error for decryption failures

wrangler tail --env staging | grep "decrypt\|error"

# Common causes:
# - Encryption key changed
# - Nonce corruption
# - Token expired
```

---

## Deployment Timeline

| Date | Task | Duration |
|------|------|----------|
| Mar 9 AM | Staging setup + tests | 2h |
| Mar 9 PM | Smoke tests + validation | 2h |
| Mar 10 AM | Production deployment | 1h |
| Mar 10 PM | First 24h monitoring | Continuous |
| Mar 11-16 | Stability monitoring | Daily |

---

## Team Handoff

### DevOps
- [ ] Secrets configured in staging & production
- [ ] D1 migration applied
- [ ] Monitoring dashboards created
- [ ] Alerting rules set up

### Security
- [ ] Encryption key securely backed up
- [ ] Key rotation policy documented
- [ ] Audit trail verified
- [ ] Compliance report generation tested

### Engineering
- [ ] Integration tests passing
- [ ] Code review completed
- [ ] Rollback plan tested
- [ ] Documentation updated

---

## References

- [PHASE_7_COMPLETE.md](./PHASE_7_COMPLETE.md) - Phase summary
- [PHASE_7_QUICK_START.md](./PHASE_7_QUICK_START.md) - API usage
- [PHASE_7_SECURITY_ROADMAP.md](./PHASE_7_SECURITY_ROADMAP.md) - Architecture

---

**Ready to Deploy:** ✅ Mar 9, 2026
