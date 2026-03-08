# CI/CD Setup

GitHub Actions deploys to Cloud Run on every push to `main`. Authentication uses **Workload Identity Federation** (WIF) — no service account keys needed.

## Pipeline

```
push to main
    ├── Lint & Format check
    ├── Unit tests
    ├── Authenticate to GCP (WIF)
    ├── Integration tests (real BigQuery)
    └── Deploy to Cloud Run
```

Defined in `.github/workflows/deploy.yml`.

## GCP Setup (one-time)

### Prerequisites

- `gcloud` CLI authenticated with owner/admin permissions
- APIs enabled: Cloud Run, BigQuery, Secret Manager, IAM, Cloud Build, Artifact Registry
- Existing runtime service account `gsc-mcp-sa` (used by Cloud Run at runtime)
- Secrets already in Secret Manager: `gsc-mcp-oauth-secret`, `gsc-mcp-jwt-secret`

### 1. Create the deploy service account

```bash
gcloud iam service-accounts create gsc-mcp-deploy \
  --project="$GCP_PROJECT_ID" \
  --display-name="GitHub Actions Deploy"
```

### 2. Grant roles to the deploy SA

```bash
DEPLOY_SA="gsc-mcp-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

ROLES=(
  roles/run.developer                  # Deploy to Cloud Run
  roles/bigquery.jobUser               # Run BQ queries (integration tests)
  roles/bigquery.dataViewer            # Read BQ data (integration tests)
  roles/secretmanager.secretAccessor   # Access secrets during deploy
  roles/cloudbuild.builds.editor       # Build container (--source deploy)
  roles/storage.admin                  # Push build artifacts to GCS
  roles/artifactregistry.writer        # Push container images
  roles/serviceusage.serviceUsageConsumer  # Required for Cloud Build to use project services
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$DEPLOY_SA" \
    --role="$ROLE" \
    --quiet
done
```

### 3. Allow deploy SA to act as the runtime SA

```bash
gcloud iam service-accounts add-iam-policy-binding \
  gsc-mcp-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:$DEPLOY_SA"
```

### 4. Create Workload Identity Federation pool and OIDC provider

```bash
gcloud iam workload-identity-pools create github \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${GITHUB_REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### 5. Bind the GitHub repo to the deploy SA

```bash
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format="value(projectNumber)")

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}"
```

## GitHub Setup

After running `setup-gcp-ci.sh`, add the following as **repository variables** (not secrets) at **Settings → Secrets and variables → Actions → Variables tab**:

| Variable | Value | Notes |
|---|---|---|
| `GCP_PROJECT_ID` | Your GCP project ID | Printed by setup script |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/932675571149/locations/global/workloadIdentityPools/github/providers/github-provider` | Printed by setup script |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `gsc-mcp-deploy@atomic-robot-website-prod.iam.gserviceaccount.com` | Printed by setup script |
| `ALLOWED_DOMAIN` | Your Google Workspace domain | |
| `GOOGLE_OAUTH_CLIENT_ID` | Your OAuth 2.0 client ID | |
| `SERVER_URL` | Your Cloud Run service URL | |
| `FIRESTORE_OAUTH_DATABASE` | Your Firestore database name | |
| `GCP_REGION` | Cloud Run region | Optional, defaults to `us-east1` |
| `BQ_DATASET` | BigQuery dataset name | Optional, defaults to `searchconsole` |
| `BQ_TABLE` | BigQuery table name | Optional, defaults to `searchdata_url_impression` |

No GitHub secrets are needed. WIF handles authentication, and app secrets (`JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`) stay in GCP Secret Manager.

## How it works

1. GitHub Actions requests an OIDC token from GitHub's token endpoint
2. The `google-github-actions/auth` action exchanges that token with GCP's Security Token Service
3. GCP validates the token against the WIF pool/provider and checks the attribute condition (repo must match)
4. GCP issues short-lived credentials for the `gsc-mcp-deploy` service account
5. Those credentials are used for integration tests (BigQuery) and deployment (Cloud Run)

No long-lived keys exist anywhere — credentials expire after the workflow run.
