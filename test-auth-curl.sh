#!/bin/bash
# RetailStack Auth API - cURL Testing Examples
# Run individual commands to test endpoints without Postman

BASE_URL="http://localhost:3000/api/auth"

echo "================================"
echo "RetailStack Auth API - cURL Tests"
echo "================================"
echo "Base URL: $BASE_URL"
echo ""

# ============================================================================
# 1. PUBLIC ENDPOINTS (No Authentication Required)
# ============================================================================

echo "=== 1. PUBLIC ENDPOINTS ==="
echo ""

# 1.1 Onboard (Create Account)
echo "1.1 Onboarding new user..."
ONBOARD_RESPONSE=$(curl -s -X POST "$BASE_URL/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@retailstack.com",
    "password": "SecurePass123!",
    "tenantName": "My Retail Store",
    "phoneNumber": "+1234567890",
    "ownerName": "John Doe"
  }')

echo "$ONBOARD_RESPONSE" | jq .
VERIFICATION_TOKEN=$(echo "$ONBOARD_RESPONSE" | jq -r '.verificationLink // empty' | grep -oP 'token=\K[^&]*')
echo "Verification Token: $VERIFICATION_TOKEN"
echo ""

# 1.2 Verify Email
if [ ! -z "$VERIFICATION_TOKEN" ]; then
  echo "1.2 Verifying email..."
  curl -s -X GET "$BASE_URL/verify-email/$VERIFICATION_TOKEN" | jq .
  echo ""
fi

# 1.3 Login
echo "1.3 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@retailstack.com",
    "password": "SecurePass123!"
  }')

echo "$LOGIN_RESPONSE" | jq .
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.data.accessToken // empty')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.data.refreshToken // empty')
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.data.user.id // empty')
TENANT_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.data.user.tenantId // empty')

echo "Access Token: $ACCESS_TOKEN"
echo "Refresh Token: $REFRESH_TOKEN"
echo "User ID: $USER_ID"
echo "Tenant ID: $TENANT_ID"
echo ""

# 1.4 Refresh Token
echo "1.4 Refreshing token..."
curl -s -X POST "$BASE_URL/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq .
echo ""

# 1.5 Forgot Password
echo "1.5 Requesting password reset..."
FORGOT_RESPONSE=$(curl -s -X POST "$BASE_URL/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@retailstack.com"}')

echo "$FORGOT_RESPONSE" | jq .
RESET_TOKEN=$(echo "$FORGOT_RESPONSE" | jq -r '.resetLink // empty' | grep -oP 'token=\K[^&]*')
echo "Reset Token: $RESET_TOKEN"
echo ""

# 1.6 Verify Reset Token
if [ ! -z "$RESET_TOKEN" ]; then
  echo "1.6 Verifying reset token..."
  curl -s -X GET "$BASE_URL/verify-reset-token/$RESET_TOKEN" | jq .
  echo ""
fi

# 1.7 Reset Password
if [ ! -z "$RESET_TOKEN" ]; then
  echo "1.7 Resetting password..."
  curl -s -X POST "$BASE_URL/reset-password" \
    -H "Content-Type: application/json" \
    -d "{
      \"token\": \"$RESET_TOKEN\",
      \"password\": \"NewSecurePass456!\",
      \"confirmPassword\": \"NewSecurePass456!\"
    }" | jq .
  echo ""
fi

# ============================================================================
# 2. PROTECTED ENDPOINTS (Authentication Required)
# ============================================================================

echo "=== 2. PROTECTED ENDPOINTS ==="
echo ""

if [ ! -z "$ACCESS_TOKEN" ]; then
  # 2.1 Logout
  echo "2.1 Logging out..."
  curl -s -X POST "$BASE_URL/logout" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq .
  echo ""

  # 2.2 Unlock Account (requires OWNER/MANAGER role)
  echo "2.2 Unlocking user account (requires OWNER role)..."
  curl -s -X POST "$BASE_URL/unlock-account" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"$USER_ID\"}" | jq .
  echo ""

  # 2.3 Login History
  echo "2.3 Getting login history..."
  curl -s -X GET "$BASE_URL/login-history?limit=10" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
  echo ""

  # 2.4 Tenant Login History
  echo "2.4 Getting tenant login history (requires OWNER role)..."
  curl -s -X GET "$BASE_URL/tenant/login-history?limit=10" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
  echo ""

  # 2.5 Tenant Audit Logs
  echo "2.5 Getting tenant audit logs (requires OWNER role)..."
  curl -s -X GET "$BASE_URL/tenant/audit-logs?limit=10" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
  echo ""

  # 2.6 Suspicious Activity
  echo "2.6 Getting suspicious activity (requires OWNER role)..."
  curl -s -X GET "$BASE_URL/tenant/suspicious-activity?minutes=30" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
  echo ""
else
  echo "❌ Could not extract access token. Login may have failed."
fi

echo "================================"
echo "Testing Complete!"
echo "================================"
