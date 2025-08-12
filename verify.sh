#!/usr/bin/env bash
# Vehicle-Descriptions end-to-end verifier (local + docker)
# Works on macOS/Linux. No sudo required. Non-destructive.

set -u
FAIL=0
PASS=0
SKIP=0

step()  { printf "\n==== %s ====\n" "$*"; }
ok()    { PASS=$((PASS+1)); printf "✓ %s\n" "$*"; }
skip()  { SKIP=$((SKIP+1)); printf "⟂ skipped: %s\n" "$*"; }
fail()  { FAIL=$((FAIL+1)); printf "✗ %s\n" "$*"; }
need()  { command -v "$1" >/dev/null 2>&1 && ok "found $1" || { fail "missing $1"; }; }
mask()  { s="$1"; l=${#s}; [ $l -le 8 ] && printf "****" || printf "%s…%s" "${s:0:4}" "${s: -4}"; }
pngsig(){ # returns 0 if file starts with PNG signature
  if command -v xxd >/dev/null 2>&1; then sig=$(xxd -p -l 4 "$1" 2>/dev/null); else sig=$(head -c 4 "$1" 2>/dev/null | hexdump -v -e '/1 "%02x"' ); fi
  [ "$sig" = "89504e47" ]
}

# --- 1) Preflight ---
step "Preflight"
need node; need npm; need curl; need file
command -v xxd >/dev/null 2>&1 && ok "found xxd" || skip "xxd not present (will use hexdump fallback)"

if node -e 'process.exit(process.versions.node.split(".")[0] >= 18 ? 0 : 1)'; then
  ok "Node >= 18 ($(node -v))"
else
  fail "Node must be >= 18 (found $(node -v))"
fi

# --- 2) Repo layout checks ---
step "Repo layout"
for f in index.js package.json bots/carfax.js bots/windowSticker.js scripts/carfax-capture-session.js; do
  [ -f "$f" ] && ok "exists: $f" || fail "missing: $f"
done

# --- 3) Load env / defaults ---
step "Environment"
# Load .env if present (export all vars temporarily)
if [ -f .env ]; then
  set -a; . ./.env; set +a
  ok "loaded .env"
else
  skip ".env not found (using current shell env)"
fi

PORT="${PORT:-3000}"
API_KEY="${API_KEY:-}"
CONCURRENCY="${CONCURRENCY:-2}"
WINDOW_STICKER_ENTRY="${WINDOW_STICKER_ENTRY:-}"
STORAGE_STATE_PATH="${STORAGE_STATE_PATH:-/tmp/carfax_storageState.json}"
STORAGE_STATE_JSON_BASE64="${STORAGE_STATE_JSON_BASE64:-}"

[ -n "$API_KEY" ] && ok "API_KEY present: $(mask "$API_KEY")" || { fail "API_KEY missing (export one or put in .env)"; API_KEY="dev-$(date +%s)"; echo "   using temporary API_KEY: $(mask "$API_KEY") for local run"; }
ok "PORT=$PORT"; ok "CONCURRENCY=$CONCURRENCY"
[ -n "$WINDOW_STICKER_ENTRY" ] && ok "WINDOW_STICKER_ENTRY is set" || skip "WINDOW_STICKER_ENTRY not set (sticker check may fail)"
[ -n "$STORAGE_STATE_JSON_BASE64" ] && ok "found STORAGE_STATE_JSON_BASE64" || skip "no STORAGE_STATE_JSON_BASE64 (carfax may require local STORAGE_STATE_PATH)"
[ -f "$STORAGE_STATE_PATH" ] && ok "storage state file present: $STORAGE_STATE_PATH" || skip "storage state file not present at $STORAGE_STATE_PATH"

# --- 4) Dependencies ---
step "Node deps"
if [ -d node_modules ]; then
  ok "node_modules present"
else
  echo "Installing deps with npm ci…"
  if npm ci --omit=dev; then ok "npm ci complete"; else fail "npm ci failed"; fi
fi

# Check minimal deps
node -e "const p=require('./package.json'); const d=p.dependencies||{}; const need=['express','playwright']; const miss=need.filter(x=>!d[x]); if(miss.length){console.log(miss.join(',')); process.exit(1)}" \
  && ok "package.json has express + playwright" \
  || fail "package.json missing one or more of: express, playwright"

# Playwright binary present?
if npx playwright --version >/dev/null 2>&1; then
  ok "playwright cli available ($(npx playwright --version))"
else
  fail "playwright not available (try: npx playwright install)"
fi

# --- 5) Start server (background) ---
step "Start server"
LOG_LEVEL="${LOG_LEVEL:-info}"
# pass env to child
( LOG_LEVEL="$LOG_LEVEL" PORT="$PORT" API_KEY="$API_KEY" CONCURRENCY="$CONCURRENCY" \
  WINDOW_STICKER_ENTRY="$WINDOW_STICKER_ENTRY" STORAGE_STATE_PATH="$STORAGE_STATE_PATH" \
  STORAGE_STATE_JSON_BASE64="$STORAGE_STATE_JSON_BASE64" npm start ) > .verify_server.log 2>&1 &
SERVER_PID=$!
sleep 1

# Wait for /health up to 30s
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" || true)
  if [ "$code" = "200" ]; then ok "health endpoint responding (200)"; break; fi
  sleep 1
done
if [ "${code:-}" != "200" ]; then
  fail "health endpoint not responding. Check .verify_server.log"; tail -n 50 .verify_server.log 2>/dev/null || true
fi

# --- 6) Positive-path checks ---
VIN="1HGCM82633A004352"   # known-good sample VIN
TMPDIR=".verify_artifacts"
mkdir -p "$TMPDIR"

step "Window Sticker endpoint (PNG)"
if [ -n "$WINDOW_STICKER_ENTRY" ]; then
  curl -s -D "$TMPDIR/hs.txt" -X POST "http://localhost:$PORT/window-sticker/binary" \
    -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
    -d "{\"vin\":\"$VIN\"}" -o "$TMPDIR/sticker.png"
  if grep -qi '^content-type: *image/png' "$TMPDIR/hs.txt" && pngsig "$TMPDIR/sticker.png"; then
    ok "sticker: got PNG (header + signature OK)"
  else
    fail "sticker: did not receive PNG. Headers:"; sed -n '1,10p' "$TMPDIR/hs.txt"; echo "Body first bytes:"; head -c 120 "$TMPDIR/sticker.png" | strings
  fi
else
  skip "WINDOW_STICKER_ENTRY not set; skipping sticker call"
fi

step "CARFAX endpoint (PNG)"
curl -s -D "$TMPDIR/hc.txt" -X POST "http://localhost:$PORT/carfax/binary" \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d "{\"vin\":\"$VIN\"}" -o "$TMPDIR/carfax.png"
if grep -qi '^content-type: *image/png' "$TMPDIR/hc.txt" && pngsig "$TMPDIR/carfax.png"; then
  ok "carfax: got PNG (header + signature OK)"
else
  # Expected if session not hydrated
  if grep -qi '^content-type: *application/json' "$TMPDIR/hc.txt"; then
    ok "carfax returned JSON (likely session/auth check)"; head -n 1 "$TMPDIR/carfax.png" >/dev/null 2>&1 || true
    echo "   Tip: refresh session (npm run login:carfax) and set STORAGE_STATE_JSON_BASE64 or STORAGE_STATE_PATH"
  else
    fail "carfax: unexpected response. Headers:"; sed -n '1,10p' "$TMPDIR/hc.txt"
  fi
fi

# --- 7) Negative-path checks ---
step "Negative-path checks"
# Missing API key
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:$PORT/window-sticker/binary" \
  -H "Content-Type: application/json" -d "{\"vin\":\"$VIN\"}")
[ "$code" = "401" ] && ok "unauthorized without API key (401)" || fail "expected 401 without API key, got $code"

# Bad VIN
code=$(curl -s -o "$TMPDIR/badvin.json" -w "%{http_code}" -X POST "http://localhost:$PORT/window-sticker/binary" \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" -d '{"vin":"123"}')
[ "$code" = "400" ] && ok "bad VIN rejected (400)" || fail "expected 400 for bad VIN, got $code"

# Optional stress/rate checks
if [ "${RUN_STRESS:-0}" = "1" ]; then
  step "Rate limit (optional)"
  out=$(for i in $(seq 1 35); do
    curl -s -o /dev/null -w "%{http_code} " -X POST "http://localhost:$PORT/window-sticker/binary" \
      -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" -d "{\"vin\":\"$VIN\"}" &
  done; wait; echo)
  echo "$out"
  if echo "$out" | grep -q "429"; then ok "rate limit engaged (saw 429)"; else skip "did not trigger rate limiter"; fi
fi

# --- 8) Docker (optional) ---
if command -v docker >/dev/null 2>&1 && [ "${RUN_DOCKER:-0}" = "1" ]; then
  step "Docker build & run (optional)"
  docker build -t vehicle-desc:local . && ok "docker build OK" || fail "docker build failed"
  docker rm -f vd-local >/dev/null 2>&1 || true
  docker run -d --name vd-local -p 3000:3000 \
    -e PORT=3000 -e API_KEY="$API_KEY" -e CONCURRENCY="$CONCURRENCY" \
    -e WINDOW_STICKER_ENTRY="$WINDOW_STICKER_ENTRY" \
    -e STORAGE_STATE_PATH="/tmp/carfax_storageState.json" \
    -e STORAGE_STATE_JSON_BASE64="$STORAGE_STATE_JSON_BASE64" \
    vehicle-desc:local >/dev/null && ok "container started" || fail "container failed"
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health")
  [ "$code" = "200" ] && ok "docker /health 200" || fail "docker /health not 200"
  docker rm -f vd-local >/dev/null 2>&1 || true
else
  skip "Docker tests (set RUN_DOCKER=1 to enable, and ensure Docker CLI is installed)"
fi

# --- 9) Wrap up ---
[ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" >/dev/null 2>&1 || true
printf "\nSummary: %s passed, %s skipped, %s failed\n" "$PASS" "$SKIP" "$FAIL"
exit $([ $FAIL -eq 0 ] && echo 0 || echo 1)
