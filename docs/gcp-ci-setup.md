# CI/CD Setup

GitHub Actions deploys to Cloud Run on every push to `main`. Authentication uses **Workload Identity Federation** (WIF) — no service account keys needed.

## Pipeline

```
push to main
    ├── Lint & Type Check     (no GCP auth, parallel)
    ├── Unit Tests            (no GCP auth, parallel)
    ├── Integration Tests     (needs lint + unit, authenticates via WIF, runs against real BigQuery)
    └── Deploy to Cloud Run   (needs integration tests)
```

Defined in `.github/workflows/deploy.yml`.

## GCP Setup (one-time)

### Prerequisites

- `gcloud` CLI authenticated with owner/admin permissions
- APIs enabled: Cloud Run, BigQuery, Secret Manager, IAM, Cloud Build, Artifact Registry
- Existing runtime service account `gsc-mcp-sa` (used by Cloud Run at runtime)
- Secrets already in Secret Manager: `gsc-mcp-oauth-secret`, `gsc-mcp-jwt-secret`

### Run the setup script

```bash
export GCP_PROJECT_ID=my-project
export GITHUB_REPO=your-org/google-search-console-mcp
./setup-gcp-ci.sh
```

This script:

1. **Creates a dedicated deploy service account** (`gsc-mcp-deploy`) — separate from the runtime SA, scoped to CI/CD only
2. **Grants roles to the deploy SA:**

   | Role | Purpose |
   |---|---|
   | `roles/run.developer` | Deploy to Cloud Run |
   | `roles/bigquery.jobUser` | Run BQ queries (integration tests) |
   | `roles/bigquery.dataViewer` | Read BQ data (integration tests) |
   | `roles/secretmanager.secretAccessor` | Access secrets during deploy |
   | `roles/cloudbuild.builds.editor` | Build container (`--source` deploy) |
   | `roles/storage.admin` | Push build artifacts to GCS |
   | `roles/artifactregistry.writer` | Push container images |

3. **Grants `iam.serviceAccountUser`** on `gsc-mcp-sa` so the deploy SA can assign it as the Cloud Run runtime SA
4. **Creates a Workload Identity Federation pool and OIDC provider** with an attribute condition restricting it to your GitHub repo
5. **Binds the GitHub repo** to the deploy SA via WIF

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
