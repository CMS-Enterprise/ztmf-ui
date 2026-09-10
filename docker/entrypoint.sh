#!/bin/sh
# Writes config.js with an HS256 bearer token for TEST_USER_EMAIL, signed with
# AUTH_HS256_SECRET (same recipe as `make generate-jwt` in ztmf). Runs from
# /docker-entrypoint.d after the stock envsubst step renders the nginx template.
set -eu

: "${AUTH_HS256_SECRET:?AUTH_HS256_SECRET is required}"
: "${TEST_USER_EMAIL:=Grand.Moff@DeathStar.Empire}"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

header=$(printf '%s' '{"alg":"HS256"}' | b64url)
payload=$(printf '{"email":"%s"}' "$TEST_USER_EMAIL" | b64url)
signature=$(printf '%s.%s' "$header" "$payload" \
  | openssl dgst -sha256 -hmac "$AUTH_HS256_SECRET" -binary | b64url)

cat > /usr/share/nginx/html/config.js <<JS
// Generated at container start for ${TEST_USER_EMAIL}
window.ZTMF_RUNTIME_CONFIG = { authToken: "${header}.${payload}.${signature}" }
JS
echo "ztmf: wrote config.js for ${TEST_USER_EMAIL}; prefix='${PR_PATH_PREFIX:-}'"
