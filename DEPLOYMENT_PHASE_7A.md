# Phase 7A Deployment Guide

## Prerequisites

✅ All code compiled and type-checked
✅ D1 database initialized
✅ Cloudflare Workers CLI (wrangler) installed
✅ Access to production/staging Cloudflare account

---

## Step 1: Generate Encryption Key

```bash
# Generate 32 random bytes, convert to hex (64 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: a1b2c3d4e5f6... (64 characters)
```

**Save this value - you'll need it for Worker Secrets.**

---

## Step 2: Add Worker Secrets

```bash
# Add encryption key to Worker secrets
wrangler secret put ENCRYPTION_KEY

# When prompted, paste the 64-character hex string from Step 1

# Verify it's set
wrangler secret list
```

**Output should show:**
```
ENCRYPTION_KEY (defined)
```

---

## Step 3: Deploy D1 Migration

```bash
# Run migration to create audit tables
npx wrangler d1 migrations apply your-database-name --remote

# Verify tables created
npx wrangler d1 execute your-database-name --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

**Expected output includes:**
```
token_audit_log
token_rotation_history
token_usage_metrics
workspace_settings
compliance_checkpoints
```

---

## Step 4: Deploy Updated Worker

```bash
# Build the project
npm run build

# Deploy to Cloudflare
wrangler publish

# Verify deployment
wrangler deployments list
```

**Check logs for no errors:**
```bash
wrangler tail
```

---

## Step 5: Verify Vault Initialization

Test the vault with a simple curl:

```bash
# Create a test listing
curl -X POST https://your-domain.workers.dev/api/listings \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Item",
    "sku": "TEST-001",
    "platforms": ["ebay"]
  }'
```

Check logs for vault initialization:
```bash
wrangler tail --follow
```

**Look for messages like:**
```
TokenVault initialized successfully
token_audit_log entry created: token_stored
```

---

## Step 6: Monitor First Hour

```bash
# Watch real-time logs
wrangler tail --follow

# Check D1 audit log growth
npx wrangler d1 execute your-database-name --remote \
  --command "SELECT COUNT(*) as audit_count FROM token_audit_log;"
```

**Expected:** Entries appearing as tokens are stored/retrieved.

---

## Step 7: Backup Verification

Ensure D1 backups are enabled:

```bash
# Check backup status via dashboard
# https://dash.cloudflare.com/

# Expected: Backups enabled, frequency: daily
```

---

## Rollback Plan (If Needed)

If issues occur, revert to Phase 6:

```bash
# Option 1: Rollback deployment
wrangler rollbacks list
wrangler deployments rollback --message="Rollback Phase 7A"

# Option 2: Remove ENCRYPTION_KEY to disable vault
wrangler secret delete ENCRYPTION_KEY
# Workers will fall back to old KV access pattern
```

---

## Verification Checklist

- [ ] ENCRYPTION_KEY set in Worker Secrets
- [ ] D1 migration tables created (5 new tables)
- [ ] Worker deployed without errors
- [ ] Audit logs appearing in D1
- [ ] Token retrieval/storage working
- [ ] No performance degradation (<25ms latency)
- [ ] Compliance team notified
- [ ] Backup verification complete

---

## Post-Deployment Tasks

### Week 1: Monitoring

```bash
# Daily checks
1. Review audit log growth: 
   SELECT COUNT(*) FROM token_audit_log WHERE created_at > datetime('now', '-1 day');

2. Check for rotation events:
   SELECT COUNT(*) FROM token_rotation_history WHERE rotated_at > datetime('now', '-1 day');

3. Monitor error rate in logs:
   wrangler tail --status "error"
```

### Week 2: User Migration

- Email users about security enhancement
- Monitor token auth failures
- Support team on-call for issues

### Week 3: Stability

- Reduce monitoring frequency
- Prepare for Phase 7B (Social queue integration)

---

## Security Audit Checklist

- [ ] Encryption key securely stored (Worker Secrets)
- [ ] Encryption key rotation plan defined (quarterly)
- [ ] Audit log access restricted (team only)
- [ ] Multi-tenant isolation verified
- [ ] Token expiration working correctly
- [ ] Failed auth attempts logged
- [ ] HTTPS only (Worker domains default)

---

## Performance Monitoring

```bash
# Add to worker index to measure latency
const startTime = Date.now();
// ... vault operations ...
const duration = Date.now() - startTime;

// Target: <25ms per operation
// Alert if: >50ms
```

**Expected performance:**
- Encryption: <5ms
- KV store: ~10ms
- D1 audit: ~10ms
- **Total: <25ms**

---

## Compliance Documentation

Create a document for your compliance team:

```markdown
# Token Vault Security Implementation

## Controls Implemented
- AES-256-GCM encryption at rest
- Immutable audit log (D1)
- Multi-tenant isolation
- Automatic token rotation
- Non-repudiation (all actions logged)

## Audit Trail
- Table: token_audit_log
- Retention: 90+ days (configurable)
- Queryable: By store, user, platform
- Searchable: By action, timestamp

## Compliance Ready For
- SOC2 Type II (audit trail requirement)
- GDPR (data processing agreements)
- Standard audit requirements
```

---

## Support & Escalation

**Issues during deployment:**
1. Check wrangler logs: `wrangler tail`
2. Verify D1 connection: `npx wrangler d1 execute ... --command "SELECT 1;"`
3. Review ENCRYPTION_KEY format (must be 64 hex chars)
4. Rollback if needed (see rollback section)

**Contact:**
- Cloudflare Support: https://dash.cloudflare.com/support
- Team Slack: `#infrastructure`

---

## Success Criteria

After 1 week in production:
- ✅ 0 authentication failures
- ✅ Audit log > 1000 entries
- ✅ Token rotation automatic (no manual intervention)
- ✅ <25ms latency impact
- ✅ No performance regressions
- ✅ Compliance team sign-off

---

## Next Steps (Phase 7B)

Once Phase 7A is stable:
1. Apply vault to social-jobs.ts
2. Implement TikTok/Pinterest OAuth2 refresh
3. Extended audit logging for social operations
4. Compliance report generation

**Estimated timeline:** 1 week after Phase 7A stabilizes

---

## Emergency Contacts

- **On-call:** 24/7 Cloudflare Support
- **Product Lead:** @[team]
- **Security Lead:** @[team]
- **Compliance:** @[team]

---

**Deployment initiated:** [timestamp]
**Expected completion:** [timestamp + 1 hour]
**Status page:** https://dash.cloudflare.com/
