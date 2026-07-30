#!/bin/bash
# Deploy the dashboard to Railway.
# Reads secrets from ~/.hermes/.env — NEVER hardcode tokens in this file.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Load env
if [ -f "$HOME/.hermes/.env" ]; then
    set -a
    source "$HOME/.hermes/.env"
    set +a
fi
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

: "${RAILWAY_TOKEN:?RAILWAY_TOKEN not set — add to ~/.hermes/.env}"
: "${RAILWAY_SERVICE_ID:=a9d7fe5a-72a0-4277-b7f4-9d80acddf520}"
: "${RAILWAY_ENV_ID:=db6e86e8-ecb2-4417-85ab-308d9d657dd5}"
BASE_URL="${BASE_URL:-https://web-production-c72a.up.railway.app}"

echo "=== Pre-deploy validation ==="
node scripts/validate.js

echo ""
echo "=== Committing & pushing ==="
git add -A
MSG="${1:-Update dashboard}"
git commit -m "$MSG" || echo "Nothing to commit"
git push origin main

SHA=$(git rev-parse HEAD)
echo ""
echo "=== Deploying $SHA ==="

# Dedup guard: skip trigger if this SHA is already queued/building/deploying
EXISTING=$(python3 - <<PY
import os, requests, json
h = {'Authorization': f'Bearer {os.environ["RAILWAY_TOKEN"]}', 'Content-Type': 'application/json'}
q = '{deployments(first:5,input:{serviceId:"%s",environmentId:"%s"}){edges{node{status meta}}}}' % (os.environ["RAILWAY_SERVICE_ID"], os.environ["RAILWAY_ENV_ID"])
r = requests.post('https://backboard.railway.com/graphql/v2', headers=h, json={'query': q}, timeout=20)
sha = os.environ['SHA']
for e in r.json().get('data',{}).get('deployments',{}).get('edges',[]):
    n = e['node']
    if n['status'] in ('QUEUED','INITIALIZING','BUILDING','DEPLOYING') and (n.get('meta') or {}).get('commitHash','').startswith(sha[:8]):
        print('ALREADY_QUEUED'); break
else:
    print('OK')
PY
)
export SHA
if [ "$EXISTING" = "ALREADY_QUEUED" ]; then
    echo "⚠️  Deploy for $SHA already queued on Railway. Skipping duplicate trigger — will just wait for it."
else
    DEPLOY_RESULT=$(python3 - <<PY
import os, requests, json
h = {'Authorization': f'Bearer {os.environ["RAILWAY_TOKEN"]}', 'Content-Type': 'application/json'}
q = 'mutation { serviceInstanceDeployV2(serviceId: "%s", environmentId: "%s", commitSha: "%s") }' % (os.environ["RAILWAY_SERVICE_ID"], os.environ["RAILWAY_ENV_ID"], os.environ["SHA"])
r = requests.post('https://backboard.railway.com/graphql/v2', headers=h, json={'query': q}, timeout=30)
d = r.json()
print(d.get('data',{}).get('serviceInstanceDeployV2') or 'FAILED')
PY
)
    if [ "$DEPLOY_RESULT" = "FAILED" ]; then
        echo "🚨 Deploy trigger failed."
        exit 1
    fi
    echo "Deploy triggered: $DEPLOY_RESULT"
fi

echo ""
echo "=== Waiting for deploy (up to 10 min)... ==="
for i in $(seq 1 60); do
    sleep 10
    STATUS=$(python3 - <<PY
import os, requests, json
h = {'Authorization': f'Bearer {os.environ["RAILWAY_TOKEN"]}', 'Content-Type': 'application/json'}
q = '{deployments(first:1,input:{serviceId:"%s",environmentId:"%s"}){edges{node{status}}}}' % (os.environ["RAILWAY_SERVICE_ID"], os.environ["RAILWAY_ENV_ID"])
r = requests.post('https://backboard.railway.com/graphql/v2', headers=h, json={'query': q}, timeout=20)
print(r.json()['data']['deployments']['edges'][0]['node']['status'])
PY
)
    echo "  [$((i*10))s] Status: $STATUS"

    if [ "$STATUS" = "SUCCESS" ]; then
        echo ""
        echo "=== Post-deploy health check ==="
        sleep 5
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
        if [ "$HTTP_CODE" != "200" ]; then
            echo "🚨 Health check failed (HTTP $HTTP_CODE)"
            exit 1
        fi
        echo "✅ Health OK"

        echo ""
        echo "=== Post-deploy smoke test ==="
        BASE_URL="$BASE_URL" node scripts/smoke.js
        exit $?
    fi

    if [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CRASHED" ]; then
        echo "🚨 Deploy FAILED. Check Railway logs."
        exit 1
    fi
done

echo "⏰ Timed out waiting for deploy (10 min)."
exit 1
