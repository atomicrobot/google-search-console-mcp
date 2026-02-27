#!/bin/bash
# deploy.sh — Deploy the GSC MCP server to Google Cloud Run
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP project with BigQuery, Secret Manager, and Cloud Run APIs enabled
#   - Service account with BigQuery Data Viewer and Secret Manager Secret Accessor roles
#   - Secrets created in Secret Manager:
#       gcloud secrets create gsc-mcp-oauth-secret --data-file=-
#       gcloud secrets create gsc-mcp-jwt-secret --data-file=-
#   - OAuth redirect URI added in GCP console: {SERVER_URL}/oauth/callback
#
# Required environment variables:
#   GCP_PROJECT_ID        — GCP project ID
#   ALLOWED_DOMAIN        — Google Workspace domain allowed to authenticate
#   GOOGLE_OAUTH_CLIENT_ID — OAuth 2.0 client ID
#   SERVER_URL            — Public URL of the deployed service
#
# Optional environment variables:
#   REGION                — Cloud Run region (default: us-east1)
#   BQ_DATASET            — BigQuery dataset name (default: searchconsole)
#   BQ_TABLE              — BigQuery table name (default: searchdata_url_impression)
#
# Usage:
#   export GCP_PROJECT_ID=my-project ALLOWED_DOMAIN=example.com ...
#   ./deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load deploy env vars from .env.production if it exists
if [ -f "$SCRIPT_DIR/.env.production" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.env.production"
  set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${REGION:-us-east1}"
SERVICE_NAME="gsc-mcp"
SERVICE_ACCOUNT="gsc-mcp-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --service-account "$SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --timeout 3600 \
  --session-affinity \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},BQ_DATASET=${BQ_DATASET:-searchconsole},BQ_TABLE=${BQ_TABLE:-searchdata_url_impression},ALLOWED_DOMAIN=${ALLOWED_DOMAIN},GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID},SERVER_URL=${SERVER_URL}" \
  --set-secrets "GOOGLE_OAUTH_CLIENT_SECRET=gsc-mcp-oauth-secret:latest,JWT_SECRET=gsc-mcp-jwt-secret:latest"
