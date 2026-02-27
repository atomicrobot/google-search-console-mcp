# Deployment Guide

## Prerequisites

### CLI Tools

Install the following before proceeding:

- **[Bun](https://bun.sh/)** — JavaScript runtime (used locally and in Docker)
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **[gcloud CLI](https://cloud.google.com/sdk/docs/install)** — Google Cloud SDK
- **[Docker](https://docs.docker.com/get-docker/)** — for local container testing (optional; Cloud Run builds from source)

### Authenticate the gcloud CLI

```bash
# Log in with your Google account
gcloud auth login

# Set your default project
gcloud config set project YOUR_PROJECT_ID

# Authenticate for local BigQuery access (development only)
gcloud auth application-default login
```

Verify you're authenticated and on the correct project:

```bash
gcloud config get-value project
gcloud auth list
```

---

## Initial GCP Setup

These steps only need to be done once per project.

### 1. Enable Required APIs

```bash
gcloud services enable \
  bigquery.googleapis.com \
  secretmanager.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 2. Create a Service Account

The Cloud Run service runs as this identity. It needs BigQuery read access and Secret Manager access.

```bash
export GCP_PROJECT_ID=$(gcloud config get-value project)

gcloud iam service-accounts create gsc-mcp-sa \
  --display-name="GSC MCP Server"

# Read BigQuery data
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:gsc-mcp-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

# Run BigQuery queries
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:gsc-mcp-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Read secrets at runtime
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:gsc-mcp-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Configure OAuth Consent Screen

In the [GCP Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent):

1. Select **Internal** user type (restricts to your Google Workspace domain)
2. Fill in the required fields (app name, support email)
3. Save — no scope configuration is needed here

> The app requests scopes (`openid`, `email`, `profile`) at runtime during the OAuth flow. For an Internal app, these are non-sensitive scopes and don't require verification.
>
> **Internal** means only users in your Workspace domain can authenticate. This aligns with the `ALLOWED_DOMAIN` check in the app.

### 4. Create OAuth 2.0 Credentials

In the [GCP Console → Credentials](https://console.cloud.google.com/apis/credentials):

1. Click **Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Add **Authorized redirect URIs**:
   - `http://localhost:8080/oauth/callback` (local development)
   - Production URI will be added after first deploy (step 8)
4. Note the **Client ID** and **Client Secret**

### 5. Create Secrets in Secret Manager

```bash
# Store the OAuth client secret
echo -n "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" | \
  gcloud secrets create gsc-mcp-oauth-secret --data-file=-

# Generate and store a JWT signing secret
openssl rand -base64 32 | \
  gcloud secrets create gsc-mcp-jwt-secret --data-file=-
```

### 6. Set Up BigQuery Bulk Export from Search Console

This is the data source the MCP server queries against.

In [Google Search Console](https://search.google.com/search-console):

1. Select your property
2. Go to **Settings → Bulk data export**
3. Enable export to BigQuery, selecting your GCP project
4. The export creates a dataset (default: `searchconsole`) with table `searchdata_url_impression`

> Data starts flowing within ~48 hours of enabling. Verify the table exists:
> ```bash
> bq ls ${GCP_PROJECT_ID}:searchconsole
> ```

---

## Deploy to Cloud Run

### 7. First Deploy

```bash
export GCP_PROJECT_ID=$(gcloud config get-value project)
export ALLOWED_DOMAIN=atomicrobot.com
export GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Use a placeholder for SERVER_URL on first deploy
export SERVER_URL=https://placeholder.run.app

./deploy.sh
```

Note the Cloud Run service URL from the deploy output.

### 8. Update OAuth Redirect URI and Redeploy

1. Copy the Cloud Run URL from the deploy output (e.g., `https://gsc-mcp-xxxxx-ue.a.run.app`)
2. In [GCP Console → Credentials](https://console.cloud.google.com/apis/credentials), edit your OAuth client and add:
   ```
   https://YOUR-CLOUD-RUN-URL/oauth/callback
   ```
3. Redeploy with the real URL:
   ```bash
   export SERVER_URL=https://gsc-mcp-xxxxx-ue.a.run.app
   ./deploy.sh
   ```

---

## Auth Architecture

Cloud Run is configured with `--allow-unauthenticated` so that the OAuth flow endpoints (`/authorize`, `/oauth/callback`, `/token`) are reachable by browsers. The app itself enforces authentication:

- **OAuth routes** are public — they handle the Google sign-in redirect flow
- **`/mcp` endpoint** requires a valid JWT Bearer token (enforced by `authMiddleware`)
- **Domain restriction** — only users from `ALLOWED_DOMAIN` can obtain a token
- **`/health`** is public for load balancer health checks

This means Cloud Run IAM is not the security boundary — the app's OAuth + JWT layer is.

---

## Local Development

```bash
# 1. Authenticate for local BigQuery access
gcloud auth application-default login

# 2. Create .env from the example
cp .env.example .env
# Edit .env with your OAuth client ID, secret, allowed domain, etc.

# 3. Ensure localhost redirect URI is configured (step 4 above)

# 4. Install dependencies and start
bun install
bun run dev
```

---

## Environment Variables Reference

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GCP_PROJECT_ID` | Yes | — | Your GCP project ID |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes | — | From OAuth credentials |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes | — | From Secret Manager in production |
| `ALLOWED_DOMAIN` | Yes | — | Google Workspace domain for access control |
| `SERVER_URL` | Yes | — | Public URL (e.g., Cloud Run URL) |
| `JWT_SECRET` | Yes | — | From Secret Manager in production |
| `BQ_DATASET` | No | `searchconsole` | BigQuery dataset name |
| `BQ_TABLE` | No | `searchdata_url_impression` | BigQuery table name |
| `MAX_BYTES_BILLED` | No | `1000000000` | BigQuery cost guard (~1 GB) |
| `TOKEN_TTL_SECONDS` | No | `3600` | JWT token lifetime |
| `PORT` | No | `8080` | Server listen port |
