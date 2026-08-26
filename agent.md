# AI Gateway — Agent Guidelines & Architecture

This document provides architectural context, implementation rules, and operational guidelines for AI coding assistants working in this repository.

---

## 1. Project Philosophy & Design Principles

- **Bun First & Zero Runtime Dependencies**: The gateway runs natively on **Bun** utilizing Web and standard built-in APIs (`node:http`, `node:crypto`, `node:fs`, `node:events`, fetch/streams API). Do **not** add runtime npm dependencies.
- **TypeScript First**: Strict TypeScript configuration (`tsconfig.json`) running directly with Bun's built-in TypeScript engine and tested via `bun test`. All code must compile cleanly with `bun run typecheck`.
- **Unified Core Abstraction**: Incoming protocols (OpenAI `/v1/chat/completions`, `/v1/images/generations`, `/v1/images/edits`, Anthropic `/v1/messages`) are normalized into `CoreRequest` and streamed back as `ProviderEvent` streams, decoupling frontend clients from upstream provider schemas.
- **Single-Flight Account Rotation**: Resilient account pooling with automatic round-robin selection, preemptive token self-healing, quota cooldown tracking, and transparent rotation on pre-stream errors.
- **Atomic Persistence**: State is stored in file-backed atomic JSON files (`data/accounts.json`, `data/config.json`) managed by `src/store.ts` with dirty-marking and debounced flushing.
- **Production & Ingress Ready**: Native dual-stack `0.0.0.0` binding, configurable host/port resolution, global CORS preflight, and full compatibility with Cloudflare Tunnel, reverse proxies, and VPS deployments.

---

## 2. System Architecture & Request Lifecycle

```
[ Client: Claude Code / Cursor / Cline / Roo / OpenAI & Anthropic SDKs / Image Clients ]
                                  │
      HTTP POST (/v1/chat/completions, /v1/messages, /v1/images/generations, /v1/images/edits)
                                  ▼
                    [ src/server.ts (HTTP Router) ]
                                  │
         ├── Authenticate via Bearer Token (sk-gw-...) or X-API-Key
         ├── Normalize request into unified CoreRequest:
         │     - OpenAI chat completions: src/openai.ts
         │     - OpenAI image generation / edits: src/server.ts + src/openai.ts
         │     - Anthropic messages: src/anthropic.ts
         │
         ▼
      [ src/pool.ts (Pool Manager) ]
         ├── Resolve model ID & provider prefix (src/models.ts)
         ├── Select next healthy account (Round-Robin with cooldown filtering)
         ├── Execute stream with single-flight rotation:
         │     - AWS Kiro: streamKiro (src/providers/kiro.ts)
         │     - Google Antigravity: streamAntigravity (src/providers/antigravity.ts)
         ├── Pre-stream failure retry: Auto token-refresh on 401/403, rotate on 429/quota/upstream
         │
         ▼
  [ Stream Converter / Aggregator ]
         ├── Streaming: streamOpenAI (src/openai.ts) or streamAnthropic (src/anthropic.ts)
         └── Non-Streaming: EventAggregator (src/aggregate.ts) -> buildOpenAICompletion / buildAnthropicMessage / JSON image response
         │
         ▼
     [ Client Response Stream / JSON ]
```

---

## 3. Provider Integration Guidelines & Quirks

### A. Google Antigravity (Cloud Code)

1. **Upstream Endpoints & Multi-Base Failover**:
   - Primary Anycast: `https://cloudcode-pa.googleapis.com`
   - Fallback 1: `https://daily-cloudcode-pa.googleapis.com`
   - Fallback 2: `https://daily-cloudcode-pa.sandbox.googleapis.com`
   - Requests cycle through `ANTIGRAVITY_BASES` automatically upon receiving `429`, `404`, or `5xx` errors.

2. **Authentication Flow (`src/auth/antigravity.ts`)**:
   - OAuth 2.0 PKCE installed-app flow using official Antigravity IDE client credentials.
   - Companion Project Onboarding: Discovers/provisions the user's `cloudaicompanionProject` via `/v1internal:loadCodeAssist` and `/v1internal:onboardUser`.
   - Access tokens are refreshed automatically when within 60 seconds of expiration.

3. **Envelope Generation & Schema Sanitization (`src/providers/antigravity.ts`)**:
   - Endpoint: `/v1internal:streamGenerateContent?alt=sse`
   - Maps `CoreRequest` to Gemini `contents`, `systemInstruction`, and `tools`.
   - **Schema Pruning**: Gemini strictly rejects invalid JSON Schema fields (e.g. `$schema`, `additionalProperties`, unlisted `required` keys). `cleanSchemaNode()` cleans parameter definitions recursively and converts enums to string arrays.
   - **Tool Calling**: Sets `thoughtSignature: 'skip_thought_signature_validator'` on assistant tool calls to bypass internal thought validation checks.
   - **Vertex Claude Whitespace Rules**: Claude models on Cloud Code strictly reject empty or whitespace-only text blocks with `400 INVALID_ARGUMENT (messages: text content blocks must contain non-whitespace text)`. `toGeminiContents` filters empty text blocks, and `systemInstruction` is omitted unless non-whitespace text is present.
   - **Multi-Tier Quota Buckets**: Telemetry in `src/quota.ts` parses quota summaries into Gemini rolling/weekly/daily limits and separate Claude/GPT-OSS buckets.

4. **Image Models (`gemini-3.1-flash-image`) — text2img & img2img**:
   - **Envelope Configuration**:
     - `requestType: 'image_gen'`
     - `requestId: image_gen/${Date.now()}/${uuid}/12`
     - `sessionId` is omitted from `request`.
     - `generationConfig.responseModalities: ["TEXT", "IMAGE"]`
     - `generationConfig.imageConfig: { aspectRatio?, imageSize? }`
   - **Aspect Ratio & Resolution Mapping**:
     - Supported aspect ratios: `"1:1"`, `"16:9"`, `"9:16"`, `"4:3"`, `"3:4"`, `"3:2"`, `"2:3"`, `"5:4"`, `"4:5"`, `"21:9"` (also parsed from DALL-E `size` strings).
     - Supported image sizes: `"1K"`, `"2K"`, `"4K"` (also mapped from OpenAI `quality: "hd"` -> `2K`, `"standard"` -> `1K`).
   - **Response Handling**:
     - Candidate parts with `inlineData` / `inline_data` emit `{ type: 'image', mediaType, base64 }` and Markdown `![Generated Image](data:...)`.
     - Output streamed directly as OpenAI/Anthropic image blocks or converted into standard OpenAI `{ data: [{ b64_json, url }] }` responses.

---

### B. AWS Kiro (CodeWhisperer / Amazon Q Developer)

1. **Upstream Endpoints (`src/providers/kiro.ts`)**:
   - `https://codewhisperer.us-east-1.amazonaws.com`
   - `https://runtime.us-east-1.kiro.dev`
   - `https://q.us-east-1.amazonaws.com`

2. **Authentication Flow (`src/auth/kiro.ts`)**:
   - AWS SSO OIDC device-authorization flow with AWS Builder ID (`startDeviceLogin`).
   - Desktop token import from IDE cache (`~/.aws/sso/cache/kiro-auth-token.json`).
   - Profile discovery: `ListAvailableProfiles` must be invoked with an empty JSON object `{}`. Extra fields trigger `400 REQUEST_BODY_INVALID`.
   - Usage telemetry: `getUsageLimits` tracks resource breakdown, subscription tier, and monthly reset timestamps (`nextDateReset`).

3. **EventStream Streaming & Conversation Structure**:
   - Endpoint: `/generateAssistantResponse` with header `accept: application/vnd.amazon.eventstream`.
   - **Strict Message Turn Alternation**: History must strictly alternate `user` -> `assistant`. Consecutive turns are merged by `flattenHistory()`, and leading assistant messages are trimmed.
   - **Binary EventStream Parser (`src/providers/eventstream.ts`)**: Decodes binary AWS EventStream frames with CRC32 checksum verification.
   - **Token Estimation**: Kiro does not return token usage figures; input and output tokens are estimated via character counts (`Math.ceil(chars / 4)`).

---

## 4. Model Catalog & Upstream Deduplication (`src/models.ts`)

Models are maintained in a streamlined canonical catalog in `src/models.ts` with standard namespace prefixes (`agy/...` and `kiro/...`).

### Canonical Model Catalog

| Provider | Model ID | Upstream Model Name | Modalities | Description |
|---|---|---|---|---|
| **Antigravity** | `agy/claude-opus-4.6` | `claude-opus-4-6-thinking` | Text, Image | Claude Opus 4.6 (Extended Thinking) |
| **Antigravity** | `agy/claude-sonnet-4.6` | `claude-sonnet-4-6` | Text, Image | Claude Sonnet 4.6 |
| **Antigravity** | `agy/gemini-3.7-flash` | `gemini-3.7-flash-tiered` | Text, Multimodal | Gemini 3.7 Flash (Hybrid Thinking) |
| **Antigravity** | `agy/gemini-3.6-flash` | `gemini-3.6-flash-high` | Text, Multimodal | Gemini 3.6 Flash |
| **Antigravity** | `agy/gemini-3-flash` | `gemini-3-flash` | Text, Multimodal | Gemini 3 Flash |
| **Antigravity** | `agy/gemini-3.5-flash` | `gemini-3.5-flash-low` | Text, Multimodal | Gemini 3.5 Flash |
| **Antigravity** | `agy/gemini-3.1-pro` | `gemini-3.1-pro-high` | Text, Multimodal | Gemini 3.1 Pro (High Thinking) |
| **Antigravity** | `agy/gemini-3.1-pro-low` | `gemini-3.1-pro-low` | Text, Multimodal | Gemini 3.1 Pro (Low Thinking) |
| **Antigravity** | `agy/gemini-3.1-flash-lite`| `gemini-3.1-flash-lite` | Text, Multimodal | Gemini 3.1 Flash Lite |
| **Antigravity** | `agy/gemini-3.1-flash-image`| `gemini-3.1-flash-image` | Text $\leftrightarrow$ Image | Gemini 3.1 Flash Image (text2img & img2img) |
| **Antigravity** | `agy/gpt-oss-120b` | `gpt-oss-120b-medium` | Text | OpenAI OSS 120B on Google TPU |
| **Kiro** | `kiro/claude-sonnet-4.5` | `claude-sonnet-4.5` | Text, Multimodal | Claude Sonnet 4.5 (Extended Thinking) |
| **Kiro** | `kiro/claude-haiku-4.5` | `claude-haiku-4.5` | Text, Multimodal | Claude Haiku 4.5 |
| **Kiro** | `kiro/deepseek-3.2` | `deepseek-3.2` | Text | DeepSeek V3 / R1 reasoning |
| **Kiro** | `kiro/qwen3-coder-next` | `qwen3-coder-next` | Text | Qwen 3 Coder Next |
| **Kiro** | `kiro/glm-5` | `glm-5` | Text | GLM-5 |
| **Kiro** | `kiro/minimax-m2.5` | `MiniMax-M2.5` | Text | MiniMax M2.5 |
| **Kiro** | `kiro/auto` | `auto` | Text, Multimodal | Dynamic routing cursor |

### Dynamic Upstream Deduplication Rule
`getModelCatalog()` strictly tracks seen `(provider, upstream)` pairs. Any dynamic model discovered at runtime whose `(provider, upstream)` already exists in the catalog is discarded, ensuring zero duplicate upstream entries in `/v1/models` and the dashboard.

---

## 5. Account Pool & Fault Recovery (`src/pool.ts`)

- **Candidate Selection**: Accounts are cycled via provider round-robin cursors. Expired accounts or accounts currently on cooldown are skipped. If all accounts are cooling down, the account with the nearest cooldown expiration is selected.
- **Single-Flight Rotation**: Rotation only occurs if upstream fails **before the first byte/event** is yielded to the client. Once streaming commences, the stream is committed.
- **Error Classification & Cooldowns (`ProviderError`)**:
  - `invalid_grant`: Account marked as `expired` (requires user re-authentication).
  - `quota`: Account placed on cooldown until its scheduled reset time (or default 1 hour).
  - `rate_limit`: Account placed on a short 60-second cooldown (or retry-after window).
  - `auth` (401/403): Triggers an immediate token refresh retry on the same account; if refresh fails, cooldown for 60s and rotate.
  - `upstream` (5xx/other): Placed on a 30-second cooldown and rotated.

---

## 6. Codebase Map

| Path | Purpose |
|---|---|
| `src/index.ts` | Gateway entry point, environment loading, dual-stack host/port binding, quota loop initialization, graceful shutdown. |
| `src/server.ts` | Core HTTP router, CORS handling, protocol dispatch (`/v1/chat/completions`, `/v1/messages`, `/v1/images/generations`, `/v1/images/edits`), admin REST API, dashboard serving. |
| `src/types.ts` | Canonical TypeScript interfaces (`CoreRequest`, `Account`, `ProviderEvent`, `AccountQuota`, `ProviderError`). |
| `src/store.ts` | File-backed JSON store with dirty tracking, debounced writes, and atomic persistence (`accounts.json`, `config.json`). |
| `src/models.ts` | Model catalog, alias mappings, dot/hyphen normalization, upstream deduplication, and dynamic model routing. |
| `src/pool.ts` | Account candidate selector, round-robin cursor, error state application, and single-flight stream rotation. |
| `src/quota.ts` | Background quota poller (10-minute interval), on-demand refresh, and multi-tier bucket classifier. |
| `src/aggregate.ts` | EventAggregator collecting stream events (text, images, tool calls, usage) into synchronous completion responses. |
| `src/openai.ts` | Bidirectional OpenAI format converter (chat completions, image config parsing, streaming SSE chunks, stream usage options). |
| `src/anthropic.ts` | Bidirectional Anthropic format converter (messages API requests, image content blocks, SSE event streams). |
| `src/backup.ts` | Encrypted (AES-256-GCM with scrypt key derivation) and plaintext account backup/restore logic. |
| `src/auth/antigravity.ts` | Google OAuth 2.0 PKCE, companion project onboarding, quota summary fetching, token refresh. |
| `src/auth/kiro.ts` | AWS SSO OIDC device code login, desktop IDE token import, profile resolution, token refresh, usage limit queries. |
| `src/providers/antigravity.ts` | Gemini & Image envelope builder, schema sanitization, SSE stream consumer, error classification. |
| `src/providers/kiro.ts` | CodeWhisperer conversationState builder, message flattener, tool specification adapter, event-stream consumer. |
| `src/providers/eventstream.ts` | AWS binary EventStream parser (prelude decoding, CRC32 verification, header/payload extraction). |
| `public/index.html` | Self-contained dark-mode single-page dashboard (Vanilla JS + CSS, zero CDN dependencies). |
| `tests/` | Bun test suite covering format conversions, image generation/editing, AWS eventstream framing, encrypted backups, and API keys. |

---

## 7. API Key Management & Lifecycle

- **Bearer Key Format**: Prefix `sk-gw-` followed by 48 random hex characters.
- **Key Identity & Metadata**: Each key is identified by a unique `id` (`key_...`), user-defined `name`, `createdAt` timestamp, optional `expiresAt` timestamp, `requests` count, and `lastUsedAt` timestamp.
- **Masking & Sanitization**: Raw secrets are returned **only once** upon key creation. In list and state endpoints, keys are masked into `keyPreview` (`sk-gw-1234...5678`).
- **Revocation & Cooldown**: Revoking a key (`revoked: true`) immediately rejects incoming requests with `401 Unauthorized` without deleting audit metadata or usage stats.
- **Admin REST Endpoints**:
  - `GET /admin/api/keys` — List all sanitized API keys with stats.
  - `POST /admin/api/keys` — Generate a new bearer key (`{ name, expiresAt? }`).
  - `POST /admin/api/keys/:id/revoke` — Revoke access for an API key.
  - `POST /admin/api/keys/:id/activate` — Reactivate a revoked key.
  - `POST /admin/api/keys/:id/toggle` — Toggle revoked state.
  - `DELETE /admin/api/keys/:id` — Permanently delete an API key by ID or raw string.

---

## 8. Configuration & Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `GATEWAY_PORT` | `8787` (or `config.port`) | HTTP listening port. |
| `HOST` / `BIND_HOST` | `0.0.0.0` (or `config.host`) | Network interface to bind. Defaults to `0.0.0.0` for container / VPS / Cloudflare Tunnel access. |
| `GATEWAY_DATA_DIR` | `./data` | Directory where `accounts.json` and `config.json` reside. |
| `ANTIGRAVITY_OAUTH_CLIENT_ID` | *(Built-in)* | Custom Google OAuth client ID override. |
| `ANTIGRAVITY_OAUTH_CLIENT_SECRET` | *(Built-in)* | Custom Google OAuth client secret override. |

---

## 9. Development & Verification Rules

When making changes to this codebase, follow these rules:

1. **Verify Code Correctness**:
   ```bash
   bun run typecheck   # Must pass with 0 TypeScript errors
   bun test            # Must pass all unit tests
   ```

2. **Preserve Compatibility**:
   - Do not remove or alter public model IDs in `src/models.ts` without ensuring backward-compatible aliases.
   - Keep error classifications (`classifyAntigravityError`, `classifyKiroError`) accurate so the pool properly distinguishes between short-term rate limits (`rate_limit`), exhausted quotas (`quota`), and authentication failures (`auth` / `invalid_grant`).
   - Maintain multi-protocol parity: any new feature or tool enhancement must function seamlessly across OpenAI, Anthropic, and image endpoint formats.

3. **No External Runtime Dependencies**:
   - Rely on native built-in modules (`node:crypto`, `node:fs`, `node:http`, `node:events`, Web streams, etc.). Do not add runtime dependencies to `package.json`.
