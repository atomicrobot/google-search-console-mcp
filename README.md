# GSC BigQuery MCP Server — Technical Specification

## Overview

An MCP (Model Context Protocol) server that exposes Google Search Console data stored in BigQuery as structured tools. Team members interact with their SEO data through natural language via Claude Code, Claude.ai, or custom MCP clients.

---

## Architecture

```
MCP Client (Claude Code / Claude.ai / Custom)
  │
  ├── OAuth 2.0 (Google as IdP, Workspace domain restriction)
  │
  ▼
MCP Server (Bun + TypeScript, Cloud Run)
  │
  ├── Streamable HTTP transport (/mcp)
  │
  ├──► Google BigQuery API → GSC BigQuery Dataset
  │
  └──► Cloud Firestore (oauth database) → Refresh token storage
```

---

## Tech Stack

- **Language:** TypeScript (Bun)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **BigQuery client:** `@google-cloud/bigquery`
- **Firestore client:** `@google-cloud/firestore`
- **Runtime:** Cloud Run
- **Auth:** OAuth 2.0 with Google as identity provider

---

## Configuration (Environment Variables)

| Variable | Description | Required | Default |
|---|---|---|---|
| `GCP_PROJECT_ID` | GCP project containing the BigQuery dataset | Yes | — |
| `BQ_DATASET` | BigQuery dataset name | No | `searchconsole` |
| `BQ_TABLE` | GSC table name | No | `searchdata_url_impression` |
| `MAX_BYTES_BILLED` | BigQuery cost cap per query in bytes | No | `1000000000` (1 GB) |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth 2.0 client ID (web application type) | Yes | — |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth 2.0 client secret | Yes | — |
| `ALLOWED_DOMAIN` | Workspace domain to restrict access (e.g. `yourcompany.com`) | Yes | — |
| `SERVER_URL` | Public URL of the Cloud Run service (for OAuth redirect) | Yes | — |
| `JWT_SECRET` | Secret for signing access token JWTs (store in Secret Manager) | Yes | — |
| `TOKEN_TTL_SECONDS` | Access token expiry in seconds | No | `3600` (1 hour) |
| `FIRESTORE_OAUTH_DATABASE` | Firestore database ID for refresh token storage | Yes | — |
| `DATA_AVAILABLE_FROM` | Earliest date data is available (YYYY-MM-DD) | No | — |
| `PORT` | Server listening port | No | `8080` |

All queries use the fully-qualified table `{GCP_PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}`.

---

## Authentication & Authorization

### Flow

The server implements the MCP OAuth specification (based on RFC 8414), delegating identity verification to Google:

1. **Discovery:** Client hits `GET /.well-known/oauth-authorization-server` and receives OAuth metadata (authorization endpoint, token endpoint, supported grant types, etc.).
2. **Authorization:** Client redirects user to `GET /authorize`. The server builds a Google OAuth URL with:
   - `scope: openid email profile`
   - `hd={ALLOWED_DOMAIN}` (hint to Google to show only Workspace accounts)
   - `redirect_uri={SERVER_URL}/oauth/callback`
   - A `state` param encoding the client's original redirect URI and a CSRF token.
3. **Callback:** Google redirects to `GET /oauth/callback` with an authorization code. The server exchanges the code for a Google ID token.
4. **Domain validation:** The server verifies the `hd` (hosted domain) claim on the Google ID token matches `ALLOWED_DOMAIN`. If it doesn't, reject with 403.
5. **Token minting:** The server mints a signed JWT (access token) and a refresh token, then redirects the client back with both tokens. The refresh token is stored in Firestore.
6. **Authenticated requests:** All MCP tool calls include the JWT. The server validates the signature and expiry on every request via middleware.
7. **Token refresh:** When the access token expires, the client uses the refresh token to obtain a new access token without re-authenticating. The server rotates the refresh token on each use (deletes the old one, issues a new one).

### Token design

Access tokens are stateless JWTs. The server mints a signed JWT containing the user's email, domain, and expiry. On each request, the auth middleware validates the JWT signature and expiry.

- Access token TTL: 1 hour (configurable via `TOKEN_TTL_SECONDS` env var)
- JWT signing key: randomly generated secret stored in Secret Manager (`gsc-mcp-jwt-secret`)
- Refresh tokens are stored in Cloud Firestore with a 30-day TTL (auto-deleted by Firestore TTL policy)
- Refresh token rotation: on each refresh, the old token is deleted and a new one is issued

### Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/.well-known/oauth-authorization-server` | GET | OAuth metadata discovery |
| `/authorize` | GET | Start OAuth flow → redirect to Google |
| `/oauth/callback` | GET | Google redirects here → validate → mint token → redirect to client |
| `/token` | POST | Token exchange (authorization_code and refresh_token grants) |
| `/mcp` | POST | Streamable HTTP MCP transport (authenticated) |
| `/health` | GET | Health check (unauthenticated, for Cloud Run) |

---

## Transport

The server uses **Streamable HTTP** (`POST /mcp`) as its only transport. Each request is a self-contained MCP JSON-RPC message. Simpler than SSE, no long-lived connections required. Compatible with Claude Code, Claude.ai, and custom MCP clients.

---

## Tools (8 total)

Every tool that accepts a date range should default to the **last 28 days** if no date range is provided. All date parameters use `YYYY-MM-DD` format.

All BigQuery queries must include `maximumBytesBilled` set to the `MAX_BYTES_BILLED` env var.

### 1. `search_performance`

The core flexible query tool. Returns aggregated GSC metrics with optional dimensions and filters.

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `start_date` | string | No | 28 days ago | Start date (YYYY-MM-DD) |
| `end_date` | string | No | yesterday | End date (YYYY-MM-DD) |
| `dimensions` | string[] | No | `[]` | Group by: `query`, `page`, `country`, `device`, `date` |
| `filters` | object[] | No | `[]` | Array of `{ dimension, operator, expression }` — see filter spec below |
| `order_by` | string | No | `clicks` | Metric to sort by: `clicks`, `impressions`, `ctr`, `position` |
| `order_direction` | string | No | `desc` | `asc` or `desc` |
| `row_limit` | number | No | `100` | Max rows to return (cap at 10,000) |

**Filter spec:**

```json
{
  "dimension": "query | page | country | device",
  "operator": "equals | contains | regex | not_contains | not_equals",
  "expression": "string value"
}
```

The `operator` is always explicit — no auto-detection. Claude picks the right operator based on the user's intent.

**Returns:** Array of rows with the requested dimensions + `clicks`, `impressions`, `ctr`, `position`.

### 2. `top_pages`

Shortcut for top-performing pages by a given metric.

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `start_date` | string | No | 28 days ago | Start date |
| `end_date` | string | No | yesterday | End date |
| `metric` | string | No | `clicks` | `clicks`, `impressions`, `ctr`, `position` |
| `limit` | number | No | `20` | Number of pages |
| `url_filter` | string | No | — | Optional URL pattern to scope results |
| `url_match_type` | string | No | `contains` | `equals`, `contains`, or `regex` |

**Returns:** Ranked list of pages with all four metrics.

### 3. `top_queries`

Shortcut for top search queries.

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `start_date` | string | No | 28 days ago | Start date |
| `end_date` | string | No | yesterday | End date |
| `metric` | string | No | `clicks` | `clicks`, `impressions`, `ctr`, `position` |
| `limit` | number | No | `20` | Number of queries |
| `url_filter` | string | No | — | Optional: only queries that led to this URL pattern |
| `url_match_type` | string | No | `contains` | `equals`, `contains`, or `regex` |
| `query_filter` | string | No | — | Optional: filter queries containing this string |

**Returns:** Ranked list of queries with all four metrics.

### 4. `compare_date_ranges`

Compare two time periods side by side with absolute and percentage deltas.

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `period1_start` | string | Yes | — | First period start |
| `period1_end` | string | Yes | — | First period end |
| `period2_start` | string | Yes | — | Second period start |
| `period2_end` | string | Yes | — | Second period end |
| `dimensions` | string[] | No | `[]` | Group by dimensions |
| `filters` | object[] | No | `[]` | Filters (same spec as search_performance) |
| `metric` | string | No | `clicks` | Primary metric for sorting deltas |
| `row_limit` | number | No | `50` | Max rows |

**Returns:** Rows with metrics for each period + absolute delta + percentage change. Sorted by the absolute delta of the primary metric (biggest changes first).

### 5. `list_dimensions_metrics`

Discovery tool — returns the schema of what's available so Claude knows what it can query. This is a static response (no BigQuery call) — just returns hardcoded schema information.

**Parameters:** None.

**Returns:**
- Available dimensions with descriptions and example values
- Available metrics with descriptions
- Notes about the data: ~16 months of history, delayed ~3 days from Google

This tool should be called by Claude at the start of a conversation to understand what's available. Make the tool description encourage this.

### 6. `page_performance`

Deep dive on a specific page or URL pattern over time.

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `url` | string | Yes | — | URL or URL pattern |
| `url_match_type` | string | No | `contains` | `equals`, `contains`, or `regex` |
| `start_date` | string | No | 90 days ago | Start date (longer default for trends) |
| `end_date` | string | No | yesterday | End date |

**Returns:**
- Daily time series of clicks, impressions, CTR, position
- Summary stats: totals, averages, min/max position

To get top queries for a page, Claude calls `top_queries` with the same `url_filter` — the tools compose.

### 7. `trending_queries`

Find queries with the biggest changes in performance — surfaces what's gaining or losing momentum.

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `comparison` | string | No | `wow` | `wow` (week-over-week) or `mom` (month-over-month) |
| `metric` | string | No | `clicks` | Metric to measure change: `clicks`, `impressions` |
| `direction` | string | No | `both` | `rising`, `falling`, or `both` |
| `min_impressions` | number | No | `10` | Minimum impressions in current period (filters noise) |
| `limit` | number | No | `25` | Number of queries to return |
| `url_filter` | string | No | — | Optional: scope to queries for this URL pattern |
| `url_match_type` | string | No | `contains` | `equals`, `contains`, or `regex` |

For custom date range comparisons, use `compare_date_ranges` instead.

**Returns:** Queries ranked by absolute change, showing both periods' metrics + absolute and percentage deltas. If `direction` is `both`, return two sections: top risers and top fallers.

### 8. `cannibalization_check`

Find queries where multiple pages on the site are competing for the same search term.

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `start_date` | string | No | 28 days ago | Start date |
| `end_date` | string | No | yesterday | End date |
| `min_pages` | number | No | `2` | Minimum number of pages ranking for the same query |
| `min_impressions` | number | No | `10` | Minimum total impressions for the query (filters noise) |
| `query_filter` | string | No | — | Optional: only check queries matching this pattern |
| `query_match_type` | string | No | `contains` | `equals`, `contains`, or `regex` |
| `url_filter` | string | No | — | Optional: only check pages matching this URL pattern |
| `url_match_type` | string | No | `contains` | `equals`, `contains`, or `regex` |
| `limit` | number | No | `25` | Max number of cannibalized queries to return |

**Returns:** For each cannibalized query:
- The query text
- Number of competing pages
- Total impressions across all pages
- For each competing page: URL, clicks, impressions, CTR, average position
- Pages sorted by impressions within each query group

---

## BigQuery Query Construction

### Common query patterns

All queries target `{GCP_PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}` and should:
- Use parameterized queries (never string interpolation for user input)
- Include `OPTIONS(max_bytes_billed={MAX_BYTES_BILLED})`
- Filter by date range using partition pruning: `WHERE data_date BETWEEN @start_date AND @end_date`
- Aggregate metrics as: `SUM(clicks)`, `SUM(impressions)`, `SAFE_DIVIDE(SUM(clicks), SUM(impressions))` for CTR, `AVG(position)` for position

### URL matching implementation

The `match_type` parameter maps directly to SQL:

```sql
-- equals
WHERE url = @url_filter

-- contains
WHERE url LIKE CONCAT('%', @url_filter, '%')

-- regex
WHERE REGEXP_CONTAINS(url, @url_filter)
```

No auto-detection. Claude picks the right match type based on what the user asks for.

---

## Project Structure

```
gsc-mcp-server/
├── src/
│   ├── index.ts                  # Entry point: create server, register tools, start transports
│   ├── server.ts                 # MCP server setup and tool registration
│   ├── config.ts                 # Environment variable parsing and validation
│   │
│   ├── auth/
│   │   ├── middleware.ts         # Express middleware to validate access tokens
│   │   ├── oauth-routes.ts       # OAuth endpoints (/authorize, /callback, /token, /.well-known)
│   │   ├── google.ts             # Google OAuth helpers (build auth URL, exchange code, verify token)
│   │   └── jwt.ts                # JWT minting and verification (stateless, no server-side storage)
│   │
│   ├── transport/
│   │   └── streamable-http.ts    # Streamable HTTP transport setup
│   │
│   ├── tools/
│   │   ├── search-performance.ts # search_performance tool
│   │   ├── top-pages.ts          # top_pages tool
│   │   ├── top-queries.ts        # top_queries tool
│   │   ├── compare-ranges.ts     # compare_date_ranges tool
│   │   ├── list-schema.ts        # list_dimensions_metrics tool
│   │   ├── page-performance.ts   # page_performance tool
│   │   ├── trending-queries.ts   # trending_queries tool
│   │   └── cannibalization.ts    # cannibalization_check tool
│   │
│   └── lib/
│       ├── bigquery.ts           # Barrel re-export for BigQuery modules
│       ├── bigquery-client.ts    # BigQuery client singleton and query execution (I/O)
│       ├── bigquery-utils.ts     # Pure BigQuery query helpers (filters, metrics SQL)
│       ├── firestore.ts          # Barrel re-export for Firestore modules
│       ├── firestore-client.ts   # Firestore client singleton (I/O)
│       ├── firestore-utils.ts    # Refresh token save/consume logic
│       ├── logger.ts             # Winston logger setup and request logger factory
│       ├── trace.ts              # Cloud trace context parsing
│       └── date-utils.ts         # Date range defaults and period calculations
│
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions CI/CD pipeline
├── docs/
│   └── gcp-ci-setup.md           # Full CI/CD setup guide
├── Dockerfile
├── docker-compose.yml            # Local development with env vars
├── deploy.sh                     # Manual Cloud Run deployment script
├── setup-gcp-ci.sh               # One-time GCP setup for GitHub Actions CI/CD
├── .env.example                  # Template for env vars
├── tsconfig.json
├── package.json
└── README.md                     # Setup, deploy, and Claude Code configuration instructions
```

---

## Deployment

### Dockerfile

- Base: `oven/bun:1`
- Non-root user
- `CMD ["bun", "src/index.ts"]`

### Cloud Run deploy script (`deploy.sh`)

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load deploy env vars from .env.production if it exists
if [ -f "$SCRIPT_DIR/.env.production" ]; then
  set -a
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
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},BQ_DATASET=${BQ_DATASET:-searchconsole},BQ_TABLE=${BQ_TABLE:-searchdata_url_impression},ALLOWED_DOMAIN=${ALLOWED_DOMAIN},GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID},SERVER_URL=${SERVER_URL},FIRESTORE_OAUTH_DATABASE=${FIRESTORE_OAUTH_DATABASE}" \
  --set-secrets "GOOGLE_OAUTH_CLIENT_SECRET=gsc-mcp-oauth-secret:latest,JWT_SECRET=gsc-mcp-jwt-secret:latest"
```

### Required IAM roles for the Cloud Run service account

- `roles/bigquery.dataViewer` (on the dataset)
- `roles/bigquery.jobUser` (on the project)
- `roles/datastore.user` (for Firestore refresh token storage)

### Firestore setup (one-time)

Create the Firestore database for refresh token storage:

```bash
gcloud firestore databases create --database=oauth --location=us-east1 --type=firestore-native
```

Enable the TTL policy for automatic refresh token expiration:

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=refreshTokens \
  --database=oauth \
  --enable-ttl
```

### Google OAuth setup (one-time)

1. Go to GCP Console → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (type: Web Application)
3. Set authorized redirect URI to `{SERVER_URL}/oauth/callback`
4. Store client secret in Secret Manager as `gsc-mcp-oauth-secret`

---

## Client Configuration

### Claude Code (Local)

1. Create a `.env` file from the template and fill in your values:

   ```bash
   cp .env.example .env
   ```

2. Start the local dev server:

   ```bash
   bun run dev
   ```

3. Add the MCP server to Claude Code:

   ```bash
   claude mcp add gsc-mcp-local \
     --transport streamable-http \
     --url http://localhost:8080/mcp
   ```

4. Start a new Claude Code session. On first use, Claude Code will open your browser for Google OAuth login. After authenticating, the MCP tools are available immediately.

### Claude Code (Production)

```bash
claude mcp add gsc-mcp \
  --transport streamable-http \
  --url https://gsc-mcp-HASH-ue.a.run.app/mcp
```

Claude Code will handle the OAuth flow automatically (opens a browser for Google login on first use).

### Claude.ai MCP Connector

Add as a custom MCP integration pointing to the server URL. The Claude.ai connector handles OAuth flows natively.

### Custom clients

Any MCP client that implements the MCP OAuth spec (RFC 8414-based discovery) will work. Point it at the server URL, and it will discover the auth endpoints automatically.

---

## Tool Description Guidelines

Each tool's MCP `description` field should be detailed and include:
- What the tool does in plain language
- When to use it vs other tools
- Example natural language questions it can answer
- Valid enum values for parameters (e.g., device: MOBILE, DESKTOP, TABLET)
- Notes about defaults and behavior

Example for `search_performance`:

```
Query Google Search Console performance data from BigQuery. This is the most flexible tool — use it when other specialized tools don't fit.

Use this for questions like:
- "How many clicks did we get last month?"
- "Show impressions for mobile in Germany"
- "What's our average position for queries containing 'pricing'?"

Dimensions: query, page, country, device, date
Metrics returned: clicks, impressions, ctr, position
Device values: MOBILE, DESKTOP, TABLET
Country values: 3-letter ISO codes (e.g., USA, GBR, DEU)

Default date range: last 28 days. Data is delayed ~3 days from Google.
```

---

## Error Handling

- **BigQuery errors:** Catch and return user-friendly messages. Common: bytes billed exceeded, table not found, invalid regex.
- **Auth errors:** Return standard MCP error codes. 401 for missing/invalid token, 403 for wrong domain.
- **Query timeouts:** BigQuery queries should have a job timeout of 30 seconds.
- **Validation errors:** Validate all tool inputs with Zod schemas. Return clear messages about what's wrong.

---

## CI/CD

GitHub Actions auto-deploys to Cloud Run on every push to `main`. Authentication uses **Workload Identity Federation** (WIF) — no service account keys needed.

### Pipeline

```
push to main
    ├── Lint & Type Check     (parallel)
    ├── Unit Tests            (parallel)
    ├── Integration Tests     (needs lint + unit, authenticates via WIF, runs against real BigQuery)
    └── Deploy to Cloud Run   (needs integration tests)
```

Defined in `.github/workflows/deploy.yml`.

### Setup

1. **GCP setup (one-time):** Run the setup script to create the deploy service account, grant roles, and configure WIF:

   ```bash
   export GCP_PROJECT_ID=my-project
   export GITHUB_REPO=your-org/google-search-console-mcp
   ./setup-gcp-ci.sh
   ```

2. **GitHub setup:** Add the following as **repository variables** (not secrets) at **Settings → Secrets and variables → Actions → Variables tab**:

   | Variable | Value | Notes |
   |---|---|---|
   | `GCP_PROJECT_ID` | Your GCP project ID | Printed by setup script |
   | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-provider` | Printed by setup script |
   | `GCP_DEPLOY_SERVICE_ACCOUNT` | `gsc-mcp-deploy@PROJECT_ID.iam.gserviceaccount.com` | Printed by setup script |
   | `ALLOWED_DOMAIN` | Your Google Workspace domain | |
   | `GOOGLE_OAUTH_CLIENT_ID` | Your OAuth 2.0 client ID | |
   | `SERVER_URL` | Your Cloud Run service URL | |
   | `FIRESTORE_OAUTH_DATABASE` | Your Firestore database name | |
   | `GCP_REGION` | Cloud Run region | Optional, defaults to `us-east1` |
   | `BQ_DATASET` | BigQuery dataset name | Optional, defaults to `searchconsole` |
   | `BQ_TABLE` | BigQuery table name | Optional, defaults to `searchdata_url_impression` |

   No GitHub secrets are needed. WIF handles authentication, and app secrets (`JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`) stay in GCP Secret Manager.

See `docs/gcp-ci-setup.md` for full details on what the setup script does and how WIF works.

---

## Future Considerations (Not in v1)

These are explicitly **out of scope** for v1 but worth keeping in mind:

- **Caching:** In-memory or Redis cache with ~1 hour TTL for identical queries. GSC data is append-only and delayed, so caching is very effective.
- **Rate limiting:** Per-user query limits to prevent accidental BQ cost spikes.
- **Raw SQL tool:** Guarded escape hatch with read-only access, table allowlist, and byte limit.
- **`explain_query` tool:** Returns the SQL + estimated bytes scanned without executing. Good for trust-building.
- **`export_csv` tool:** Dump results to a downloadable file.
- **Anomaly detection:** Flag statistical outliers in metrics.
- **Multi-site support:** Site selector parameter on all tools.