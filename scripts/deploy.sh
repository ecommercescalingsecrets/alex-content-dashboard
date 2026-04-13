#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

SERVICE_ID="a9d7fe5a-72a0-4277-b7f4-9d80acddf520"
ENV_ID="db6e86e8-ecb2-4417-85ab-308d9d657dd5"
RAILWAY_TOKEN="37b6b2a2-5d04-4fb7-9e4c-c71e2bb310a9"

echo "=== Pre-deploy validation ==="
node scripts/validate.js
if [ $? -ne 0 ]; then
    echo "🚨 Validation failed. Aborting deploy."
    exit 1
fi

echo ""
echo "=== Committing & pushing ==="
git add -A
MSG="${1:-Update dashboard}"
git commit -m "$MSG" || echo "Nothing to commit"
git push origin main

SHA=$(git rev-parse HEAD)
echo ""
echo "=== Deploying $SHA ==="

DEPLOY_ID=$(python3 -c "
import requests
headers = {'Authorization': 'Bearer $RAILWAY_TOKEN', 'Content-Type': 'application/json'}
query = 'mutation { serviceInstanceDeployV2(serviceId: \"$SERVICE_ID\", environmentId: \"$ENV_ID\", commitSha: \"$SHA\") }'
r = requests.post('https://backboard.railway.com/graphql/v2', headers=headers, json={'query': query})
import json
data = json.loads(r.text)
print(data.get('data',{}).get('serviceInstanceDeployV2','FAILED'))
")

if [ "$DEPLOY_ID" = "FAILED" ]; then
    echo "🚨 Deploy trigger failed."
    exit 1
fi

echo "Deploy triggered: $DEPLOY_ID"
echo ""
echo "=== Waiting for deploy... ==="

for i in $(seq 1 30); do
    sleep 10
    STATUS=$(python3 -c "
import requests, json
headers = {'Authorization': 'Bearer $RAILWAY_TOKEN', 'Content-Type': 'application/json'}
query = '{deployments(first:1,input:{serviceId:\"$SERVICE_ID\",environmentId:\"$ENV_ID\"}){edges{node{status}}}}'
r = requests.post('https://backboard.railway.com/graphql/v2', headers=headers, json={'query': query})
print(json.loads(r.text)['data']['deployments']['edges'][0]['node']['status'])
")
    echo "  [$((i*10))s] Status: $STATUS"
    
    if [ "$STATUS" = "SUCCESS" ]; then
        echo ""
        echo "=== Post-deploy health check ==="
        sleep 5
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://web-production-c72a.up.railway.app/api/health")
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅ Deploy successful! Health check passed."
            exit 0
        else
            echo "🚨 Health check failed (HTTP $HTTP_CODE)"
            exit 1
        fi
    fi
    
    if [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CRASHED" ]; then
        echo "🚨 Deploy FAILED. Check Railway logs."
        exit 1
    fi
done

echo "⏰ Timed out waiting for deploy."
exit 1
