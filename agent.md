# AI Gateway — Agent Guidelines & Architecture

This document provides architectural context, implementation rules, and operational guidelines for AI coding assistants working in this repository.

---

## 1. Project Philosophy & Design Principles

- **Zero Runtime Dependencies**: The gateway runs entirely on native Node.js built-ins (`node:http`, `node:crypto`, `node:fs`, `node:events`, fetch/streams API). Do **not** add runtime npm dependencies.
- **TypeScript First**: Uses standard TypeScript type definitions with strict types (`tsconfig.json`). Development and testing run via `tsx` and `vitest`.
- **Unified Core Abstraction**: Incoming protocols (OpenAI, Anthropic) are normalized into `CoreRequest` and streamed back as `ProviderEvent` streams, decoupling frontend clients from upstream provider schemas.
- **Persistence via JSON Store**: State is stored in atomic JSON files (`data/accounts.json`, `data/config.json`) managed by `src/store.ts`.

---

## 2. System Architecture & Request Lifecycle

```
[ Client: Claude Code / Cursor / Cline / Roo / OpenAI SDK ]
                          │
         HTTP POST (/v1/chat/completions or /v1/messages)
                          ▼
            [ src/server.ts (HTTP Router) ]
                          │
            ├── Authenticate via Bearer Token (sk-gw-...)
            ├── Parse request into CoreRequest:
            │     - OpenAI format: src/openai.ts
            │     - Anthropic format: src/anthropic.ts
            │
            ▼
             [ src/pool.ts (Pool Manager) ]
            ├── Resolve model ID (src/models.ts)
            ├── Select next healthy account (Round-Robin)
            ├── Execute stream with single-flight rotation:
            │     - Kiro: streamKiro (src/providers/kiro.ts)
            │     - Antigravity: streamAntigravity (src/providers/antigravity.ts)
            ├── Handle transient errors & token refresh before byte flow
            │
            ▼
     [ Stream Converter (SSE / NDJSON / Chunked Buffer) ]
            │
            ▼
        [ Client Response Stream ]
```

---

## 3. Provider Integration Guidelines & Quirks

### A. Google Antigravity (Cloud Code)

1. **Upstream Endpoints**:
   - Primary: `https://daily-cloudcode-pa.googleapis.com` (Official Antigravity IDE endpoint)
   - Fallback: `https://daily-cloudcode-pa.sandbox.googleapis.com`
   - Enterprise/GCP: `https://cloudcode-pa.googleapis.com`
   > **Important**: `cloudcode-pa.googleapis.com` returns `429 RESOURCE_EXHAUSTED` for standard Antigravity consumer tokens. Always ensure `daily-cloudcode-pa` remains prioritized in `ANTIGRAVITY_BASES`.

2. **Authentication Flow**:
   - OAuth 2.0 PKCE installed-app flow (`src/auth/antigravity.ts`).
   - Companion Project Onboarding: Calls `/v1internal:loadCodeAssist` and `/v1internal:onboardUser` to discover/provision `cloudaicompanionProject`.
   - Token refresh automatically executed before expiration.

3. **Request & SSE Parsing**:
   - Endpoint: `/v1internal:streamGenerateContent?alt=sse`
   - Formatted using Gemini `contents` / `systemInstruction` / `tools` schema.
   - Extracts streaming deltas, usage metadata, remaining credit balances, and tool calls.

---

### B. AWS Kiro (CodeWhisperer / Q Developer)

1. **Upstream Endpoints**:
   - `https://codewhisperer.us-east-1.amazonaws.com`
   - `https://runtime.us-east-1.kiro.dev`
   - `https://q.us-east-1.amazonaws.com`

2. **Authentication Flow**:
   - AWS SSO OIDC device-authorization flow with AWS Builder ID (`src/auth/kiro.ts`).
   - Alternatively, desktop token import from `~/.aws/sso/cache/kiro-auth-token.json`.
   - `ListAvailableProfiles`: Must be invoked with empty JSON object `{}`. Unrecognized fields (e.g. `maxResults`) cause `400 REQUEST_BODY_INVALID`.

3. **EventStream Streaming**:
   - Requests use `/generateAssistantResponse` with `accept: application/vnd.amazon.eventstream`.
   - Binary AWS EventStream frames parsed by `AwsEventStreamParser` (`src/providers/eventstream.ts`).
   - Token estimation: Kiro does not emit token usage numbers; estimated via character count (chars / 4).

---

## 4. Codebase Map

| Path | Purpose |
|---|---|
| `src/index.ts` | Server bootstrap, port listening, graceful shutdown. |
| `src/server.ts` | HTTP request routing, CORS, admin API, dashboard serving. |
| `src/types.ts` | Canonical TypeScript interfaces (`CoreRequest`, `Account`, `ProviderEvent`, etc.). |
| `src/store.ts` | File-backed JSON store with dirty-marking and atomic persistence. |
| `src/models.ts` | Model catalog, alias mappings, and provider resolution. |
| `src/pool.ts` | Account pool, round-robin cursor, error cooldowns, stream rotation. |
| `src/quota.ts` | Background quota poller (10-minute interval) and on-demand refresh. |
| `src/openai.ts` | Bidirectional OpenAI format adapter (chat completions, streaming chunks). |
| `src/anthropic.ts` | Bidirectional Anthropic format adapter (messages API, SSE events). |
| `src/backup.ts` | Encrypted (AES-256-GCM) and plaintext account backup/restore logic. |
| `src/auth/antigravity.ts` | Google OAuth, PKCE, project onboarding, token refresh. |
| `src/auth/kiro.ts` | AWS SSO device flow, profile discovery, token refresh, usage limits. |
| `src/providers/antigravity.ts` | Gemini envelope generation, SSE streaming, error classification. |
| `src/providers/kiro.ts` | CodeWhisperer conversationState builder, event-stream parsing. |
| `src/providers/eventstream.ts` | AWS binary EventStream parser implementation. |
| `public/index.html` | Self-contained dashboard SPA (Vanilla JS + CSS). |
| `tests/` | Vitest test suite covering conversion, parsing, and backup logic. |

---

## 5. Development & Verification Rules

When making changes to this codebase, follow these rules:

1. **Verify Code Correctness**:
   ```bash
   npm run typecheck   # Must pass with 0 TypeScript errors
   npm test            # Must pass all Vitest tests
   ```

2. **Preserve Compatibility**:
   - Do not alter public model IDs in `src/models.ts` without providing backward-compatible aliases.
   - Keep error classifications (`classifyAntigravityError`, `classifyKiroError`) accurate so the pool properly distinguishes between short-term rate limits (`rate_limit`), exhausted quotas (`quota`), and authentication failures (`auth` / `invalid_grant`).

3. **No External Runtime Dependencies**:
   - Rely solely on Node.js built-in modules (`node:crypto`, `node:fs`, `node:http`, etc.).
