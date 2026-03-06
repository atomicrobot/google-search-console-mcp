# GSC BigQuery MCP Server

MCP server exposing Google Search Console data (via BigQuery bulk export) as tools. Supports OAuth 2.0 with Google, Streamable HTTP transport, and 8 query tools.

## Tech Stack

- Bun (runs TypeScript natively, resolves tsconfig path aliases)
- Express 5.x, `@modelcontextprotocol/sdk`
- `@google-cloud/bigquery`, `google-auth-library`, `winston`
- bun:test for testing, ESLint (flat config) + Prettier

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start dev server with --watch
bun run start            # Run server
bun run test             # Run tests with bun:test
bun run lint             # ESLint check
bun run lint:fix         # ESLint fix
bun run format           # Prettier format
bun run format:check     # Prettier check
```

## Code Conventions

- Files: kebab-case (`date-utils.ts`, `oauth-routes.ts`)
- Imports: Use `@` path aliases — `@config`, `@auth/*`, `@lib/*`, `@tools/*`, `@transport/*`
  - Configured in tsconfig.json `paths`, resolved natively by Bun (runtime + test runner)
  - NEVER use relative imports like `../auth/` or `./jwt` — always use aliases
- Logging: Use `winston` logger from `@lib/logger` — log WHO (user email) is requesting WHAT (tool name)
- Error handling: Catch BigQuery/auth errors, return user-friendly MCP error messages
- All BQ queries use parameterized queries (never string interpolation for user input)
- Position formula: `SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1`
- Single table: `{GCP_PROJECT_ID}.{BQ_DATASET}.{BQ_TABLE}`
- Use `server.registerTool()` (not deprecated `server.tool()`) for MCP tool registration
- Use `StreamableHTTPServerTransport` (not deprecated `SSEServerTransport`)
- NEVER use `any` types — use proper types, generics, or `unknown` with type narrowing
- NEVER add `eslint-disable` comments without explicit user permission

## Testing

- Co-located test files (`*.test.ts`)
- bun:test — `mock.module("@lib/bigquery-client", ...)` for BigQuery I/O mocking
- BigQuery split: `bigquery-client.ts` (I/O) + `bigquery-utils.ts` (pure), barrel re-exported from `bigquery.ts`
- Run single test: `bun run test src/path/to/file.test.ts`

## Quality Checks

- After making changes to any `.ts` file, ALWAYS call `getDiagnostics` on the changed files to verify there are no TypeScript errors before moving on

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `GCP_PROJECT_ID` | Yes | — |
| `BQ_DATASET` | No | `searchconsole` |
| `BQ_TABLE` | No | `searchdata_url_impression` |
| `MAX_BYTES_BILLED` | No | `1000000000` |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes | — |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes | — |
| `ALLOWED_DOMAIN` | Yes | — |
| `SERVER_URL` | Yes | — |
| `JWT_SECRET` | Yes | — |
| `FIRESTORE_OAUTH_DATABASE` | Yes | — |
| `TOKEN_TTL_SECONDS` | No | `3600` |
| `PORT` | No | `8080` |
| `DATA_AVAILABLE_FROM` | No | — |

In production, `JWT_SECRET` and `GOOGLE_OAUTH_CLIENT_SECRET` come from Secret Manager (see `deploy.sh`).

## Local Development

1. `gcloud auth application-default login` for BigQuery credentials
2. Create `.env` from `.env.example`
3. Add `http://localhost:8080/oauth/callback` to GCP OAuth redirect URIs
4. `bun run dev`

## Allowed Commands

- bun *
- docker *
- gcloud *
