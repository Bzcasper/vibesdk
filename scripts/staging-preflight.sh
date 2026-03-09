#!/bin/bash

# Phase 7 Staging Pre-Flight Checklist
# Run this before deploying to staging

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║  Phase 7 Staging Pre-Flight Checklist          ║"
echo "╚════════════════════════════════════════════════╝"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Helper functions
check_pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  ((FAILED++))
}

check_warning() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# 1. TypeScript compilation
echo ""
echo "1️⃣  Checking TypeScript compilation..."
if npm run type-check &>/dev/null; then
  check_pass "TypeScript compilation"
else
  check_fail "TypeScript compilation"
fi

# 2. Required files exist
echo ""
echo "2️⃣  Checking required files..."

files=(
  "worker/security/TokenVault.ts"
  "worker/security/TokenRotation.ts"
  "worker/security/ComplianceChecker.ts"
  "worker/security/TokenMetrics.ts"
  "worker/security/types.ts"
  "worker/api/security.ts"
  "migrations/0004_token_vault.sql"
  "test/security/TokenVault.test.ts"
  "test/security/TokenMetrics.test.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    check_pass "File exists: $file"
  else
    check_fail "File missing: $file"
  fi
done

# 3. Check environment variables
echo ""
echo "3️⃣  Checking environment configuration..."

if [ -z "$ENCRYPTION_KEY" ]; then
  check_warning "ENCRYPTION_KEY not set in environment"
  echo "         Run: wrangler secret put ENCRYPTION_KEY --env staging"
else
  key_len=${#ENCRYPTION_KEY}
  if [ "$key_len" -eq 64 ]; then
    check_pass "ENCRYPTION_KEY is 64 characters"
  else
    check_fail "ENCRYPTION_KEY must be 64 hex chars (got $key_len)"
  fi
fi

# 4. Check wrangler.jsonc
echo ""
echo "4️⃣  Checking wrangler configuration..."

if grep -q "staging" wrangler.jsonc 2>/dev/null; then
  check_pass "Staging environment configured in wrangler.jsonc"
else
  check_warning "Staging environment not configured in wrangler.jsonc"
  echo "         Add [env.staging] section to wrangler.jsonc"
fi

if grep -q "TOKENS" wrangler.jsonc 2>/dev/null; then
  check_pass "TOKENS KV namespace configured"
else
  check_warning "TOKENS KV namespace not configured in wrangler.jsonc"
fi

# 5. Check database migration
echo ""
echo "5️⃣  Checking database migration..."

if grep -q "token_audit_log" migrations/0004_token_vault.sql; then
  check_pass "token_audit_log table defined in migration"
else
  check_fail "token_audit_log table missing from migration"
fi

if grep -q "token_rotation_history" migrations/0004_token_vault.sql; then
  check_pass "token_rotation_history table defined in migration"
else
  check_fail "token_rotation_history table missing from migration"
fi

# 6. Check code quality
echo ""
echo "6️⃣  Checking code quality..."

# Check for console.log in production code
if grep -r "console\.log" worker/security --include="*.ts" | grep -v test | grep -v "error\|warn" >/dev/null; then
  check_warning "Found console.log in production code (review for security)"
else
  check_pass "No suspicious console.log found in security code"
fi

# Check for hardcoded secrets
if grep -r "password\|token\|secret" worker/security --include="*.ts" | grep -i "=\s*['\"]" | grep -v "refresh_token\|access_token"; then
  check_fail "Possible hardcoded secrets found in code"
else
  check_pass "No hardcoded secrets detected"
fi

# 7. Check integration
echo ""
echo "7️⃣  Checking queue consumer integration..."

if grep -q "TokenVault" worker/queues/browser-jobs.ts; then
  check_pass "TokenVault integrated in browser-jobs.ts"
else
  check_fail "TokenVault not found in browser-jobs.ts"
fi

if grep -q "TokenVault" worker/queues/social-jobs.ts; then
  check_pass "TokenVault integrated in social-jobs.ts"
else
  check_fail "TokenVault not found in social-jobs.ts"
fi

# 8. Check types
echo ""
echo "8️⃣  Checking TypeScript types..."

if grep -q "ENCRYPTION_KEY" worker/types/env.ts; then
  check_pass "ENCRYPTION_KEY type defined in env.ts"
else
  check_fail "ENCRYPTION_KEY type missing from env.ts"
fi

# 9. Verify test files
echo ""
echo "9️⃣  Checking test files..."

if [ -f "test/security/TokenVault.test.ts" ]; then
  test_count=$(grep -c "it(" test/security/TokenVault.test.ts || true)
  if [ "$test_count" -gt 0 ]; then
    check_pass "TokenVault tests ($test_count test cases)"
  else
    check_fail "TokenVault test file is empty"
  fi
else
  check_fail "TokenVault.test.ts not found"
fi

# 10. Documentation
echo ""
echo "🔟 Checking documentation..."

if [ -f "PHASE_7_COMPLETE.md" ]; then
  check_pass "PHASE_7_COMPLETE.md exists"
else
  check_fail "PHASE_7_COMPLETE.md missing"
fi

if [ -f "PHASE_7_QUICK_START.md" ]; then
  check_pass "PHASE_7_QUICK_START.md exists"
else
  check_fail "PHASE_7_QUICK_START.md missing"
fi

if [ -f "DEPLOYMENT_PHASE_7.md" ]; then
  check_pass "DEPLOYMENT_PHASE_7.md exists"
else
  check_fail "DEPLOYMENT_PHASE_7.md missing"
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  Pre-Flight Summary                            ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"

if [ "$FAILED" -eq 0 ]; then
  echo ""
  echo -e "${GREEN}🚀 Ready for staging deployment!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Set secrets: wrangler secret put ENCRYPTION_KEY --env staging"
  echo "2. Deploy: wrangler deploy --env staging"
  echo "3. Apply migration: wrangler migrations apply --remote --env staging"
  echo "4. Run smoke tests (see DEPLOYMENT_PHASE_7.md)"
  exit 0
else
  echo ""
  echo -e "${RED}⛔ Fix issues above before deploying${NC}"
  exit 1
fi
