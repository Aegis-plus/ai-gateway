# AI Gateway — Agent Guidelines & System Architecture

This document serves as the authoritative architectural blueprint, implementation guide, and operational reference for AI coding assistants working in this repository.

---

## 1. Project Philosophy & Design Principles

- **Bun-Native & Zero Runtime Dependencies**: The gateway executes natively on **Bun** (≥ 1.0) using modern Web Standards and Node-compatible built-in APIs (`node:http`, `node:crypto`, `node:fs`, `node:events`, Web Streams, `fetch`). **Do not add runtime npm dependencies.**
- **TypeScript First**: Strict TypeScript configuration (`tsconfig.json`) compiled and executed natively by Bun without transpile steps or bundlers. All code must pass `bun run typecheck` cleanly.
- **Unified Core Abstraction**: Protocol translations (OpenAI Chat Completions, OpenAI Images API, Anthropic Messages API) normalize all incoming payloads into a unified `CoreRequest` structure and stream back provider-agnostic `ProviderEvent` streams.
- **Resilient Account Pooling (No Artificial Cooldown Lockouts)**: Intelligent round-robin account rotation per provider. Authentication failures (401/403) trigger immediate in-flight token self-healing. Upstream transient errors rotate to the next account without imposing artificial cooldown locks that disable accounts prematurely.
- **Atomic File-Backed Persistence**: Accounts, configuration, and API keys are stored in `data/accounts.json` and `data/config.json`. The store (`src/store.ts`) implements in-memory caches with dirty-flag tracking and debounced atomic disk writes (`writeFileSync` via temporary staging).
- **Production & Ingress Ready**: Native dual-stack `0.0.0.0` binding, configurable host/port resolution, global CORS preflight, and full compatibility with Cloudflare Tunnel, reverse proxies (Nginx, Traefik, Caddy), and Docker/VPS deployments.

---

## 2. System Architecture & Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Client Applications (Claude Code, Cursor, Cline, Roo, OpenAI/Anthropic SDK) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
       POST /v1/chat/completions, /v1/messages, /v1/images/generations, /v1/images/edits
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HTTP Router (src/server.ts)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Global CORS Preflight & Security Headers                                 │
│ 2. API Key Authentication (Bearer sk-gw-... / X-API-Key)                    │
│ 3. Protocol Parser & Normalizer:                                            │
│    • OpenAI Chat: src/openai.ts -> parseOpenAIRequest()                     │
│    • OpenAI Images: src/server.ts + src/openai.ts -> parseAspectRatio()     │
│    • Anthropic: src/anthropic.ts -> parseAnthropicRequest()                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Normalized CoreRequest
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Pool Manager (src/pool.ts)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Model Resolution: src/models.ts -> resolveModel()                        │
│ 2. Account Candidate Selection: Round-Robin cursor per provider             │
│ 3. Single-Flight Stream Execution:                                          │
│    • AWS Kiro -> streamKiro() (src/providers/kiro.ts)                       │
│    • Google Antigravity -> streamAntigravity() (src/providers/antigravity.ts)│
│ 4. Pre-Stream Recovery: In-flight token refresh on 401/403, rotate on error  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ AsyncGenerator<ProviderEvent>
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Stream Converter & Aggregator                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Streaming (SSE):                                                          │
│   - OpenAI: streamOpenAI() -> data: {"choices":[{"delta":{...}}]}           │
│   - Anthropic: streamAnthropic() -> event: content_block_delta ...          │
│ • Non-Streaming:                                                            │
│   - EventAggregator (src/aggregate.ts) -> buildOpenAICompletion()           │
│   - EventAggregator (src/aggregate.ts) -> buildAnthropicMessage()            │
│   - EventAggregator (src/aggregate.ts) -> OpenAI Image JSON response        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP Response Stream / JSON
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Response                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Provider Integration Specifications

### A. Google Antigravity (Cloud Code)

1. **Multi-Base Network Failover**:
   - Primary Anycast: `https://cloudcode-pa.googleapis.com`
   - Fallback 1: `https://daily-cloudcode-pa.googleapis.com`
   - Fallback 2: `https://daily-cloudcode-pa.sandbox.googleapis.com`
   - Automatically retried across base URLs upon network/connectivity issues.

2. **Authentication Flow (`src/auth/antigravity.ts`)**:
   - OAuth 2.0 PKCE installed-application flow with Google Antigravity IDE credentials.
   - **Companion Project Provisioning**: Automatically queries `/v1internal:loadCodeAssist` and invokes `/v1internal:onboardUser` to discover or provision the user's `cloudaicompanionProject`.
   - Access tokens are automatically refreshed in the background when within 60 seconds of expiration.

3. **Envelope Generation & Vertex Rules (`src/providers/antigravity.ts`)**:
   - Endpoint: `/v1internal:streamGenerateContent?alt=sse`
   - Translates `CoreRequest` into Gemini `contents`, `systemInstruction`, and `tools`.
   - **Strict Schema Sanitization (`cleanGeminiSchema`)**:
     - Strips unsupported schema keywords (`$schema`, `additionalProperties`, unlisted `required` keys).
     - Converts JSON schema union types (`["string", "null"]` $\rightarrow$ `"string"`).
     - Converts `const` values and enum definitions into strict string array enumerations.
   - **Tool Calling Thought Bypass**: Sets `thoughtSignature: 'skip_thought_signature_validator'` on assistant `functionCall` turns.
   - **Vertex Claude Whitespace Rule**: Anthropic Vertex Claude strictly rejects empty or whitespace-only text parts with `400 INVALID_ARGUMENT (messages: text content blocks must contain non-whitespace text)`. `toGeminiContents` filters empty text blocks, and `systemInstruction` is omitted unless non-whitespace characters are present.

4. **Image Generation & Editing (`gemini-3.1-flash-image`)**:
   - **Envelope Configuration**:
     - `requestType: "image_gen"`
     - `requestId: "image_gen/${Date.now()}/${uuid}/12"`
     - `request.sessionId` is omitted for image models.
     - `generationConfig.responseModalities: ["TEXT", "IMAGE"]`
     - `generationConfig.imageConfig: { aspectRatio?, imageSize? }`
   - **Aspect Ratio & Resolution Handling**:
     - Parses aspect ratio from direct `aspect_ratio`, `aspectRatio`, `image_config.aspect_ratio`, or infers it from DALL-E `size` strings (e.g. `1024x1024` $\rightarrow$ `1:1`, `1792x1024` $\rightarrow$ `16:9`, `1024x1792` $\rightarrow$ `9:16`).
     - Parses image resolution (`1K`, `2K`, `4K`) from `image_size`, `resolution`, or maps `quality: "hd"` $\rightarrow$ `2K`, `"standard"` $\rightarrow$ `1K`.
   - **Multimodal Delivery**:
     - Upstream `inlineData` / `inline_data` base64 parts emit `{ type: 'image', mediaType, base64 }` and Markdown `![Generated Image](data:...)` so standard chat interfaces render images inline.

---

### B. AWS Kiro (CodeWhisperer / Amazon Q Developer)

1. **Endpoints & Failover (`src/providers/kiro.ts`)**:
   - `https://codewhisperer.us-east-1.amazonaws.com`
   - `https://runtime.us-east-1.kiro.dev`
   - `https://q.us-east-1.amazonaws.com`

2. **Authentication Flow (`src/auth/kiro.ts`)**:
   - AWS SSO OIDC device-authorization flow with AWS Builder ID (`startDeviceLogin`).
   - Desktop IDE token import (`~/.aws/sso/cache/kiro-auth-token.json`).
   - Profile resolution: `ListAvailableProfiles` is invoked with an exact empty JSON body `{}` (extra fields cause `400 REQUEST_BODY_INVALID`).
   - Telemetry & Quota: `getUsageLimits` tracks monthly resource allocations and reset dates.

3. **EventStream Protocol & Framing**:
   - Endpoint: `/generateAssistantResponse` with `accept: application/vnd.amazon.eventstream`.
   - **Binary EventStream Parser (`src/providers/eventstream.ts`)**: Decodes AWS binary EventStream frames with CRC32 integrity verification.
   - **Strict Turn Alternation**: Messages must alternate `user` $\rightarrow$ `assistant`. `flattenHistory` merges consecutive turns with linebreaks and removes any leading assistant messages.
   - **Usage Estimation**: Kiro does not report token counts; input/output tokens are estimated via character counts (`Math.ceil(chars / 4)`).

---

## 4. Canonical Model Catalog & Deduplication

Models are maintained in [`src/models.ts`](file:///home/aegis/Project/AI%20Gateway/src/models.ts).

### Canonical Model Catalog (18 Models)

| Provider | Model ID | Upstream Model Name | Modalities | Capabilities / Description |
|---|---|---|---|---|
| **Antigravity** | `agy/claude-opus-4.6` | `claude-opus-4-6-thinking` | Text, Image | Claude Opus 4.6 (Extended Thinking) |
| **Antigravity** | `agy/claude-sonnet-4.6` | `claude-sonnet-4-6` | Text, Image | Claude Sonnet 4.6 |
| **Antigravity** | `agy/gemini-3.7-flash` | `gemini-3.7-flash-tiered` | Text, Multimodal | Gemini 3.7 Flash (Hybrid Thinking) |
| **Antigravity** | `agy/gemini-3.6-flash` | `gemini-3.6-flash-high` | Text, Multimodal | Gemini 3.6 Flash |
| **Antigravity** | `agy/gemini-3-flash` | `gemini-3-flash` | Text, Multimodal | Gemini 3 Flash |
| **Antigravity** | `agy/gemini-3.5-flash` | `gemini-3.5-flash-low` | Text, Multimodal | Gemini 3.5 Flash |
| **Antigravity** | `agy/gemini-3.1-pro` | `gemini-3.1-pro-high` | Text, Multimodal | Gemini 3.1 Pro (High Thinking) |
| **Antigravity** | `agy/gemini-3.1-pro-low` | `gemini-3.1-pro-low` | Text, Multimodal | Gemini 3.1 Pro (Low Thinking) |
| **Antigravity** | `agy/gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | Text, Multimodal | Gemini 3.1 Flash Lite |
| **Antigravity** | `agy/gemini-3.1-flash-image` | `gemini-3.1-flash-image` | Text $\leftrightarrow$ Image | Gemini 3.1 Flash Image (text2img & img2img) |
| **Antigravity** | `agy/gpt-oss-120b` | `gpt-oss-120b-medium` | Text | OpenAI OSS 120B on Google TPU |
| **Kiro** | `kiro/claude-sonnet-4.5` | `claude-sonnet-4.5` | Text, Multimodal | Claude Sonnet 4.5 (Extended Thinking) |
| **Kiro** | `kiro/claude-haiku-4.5` | `claude-haiku-4.5` | Text, Multimodal | Claude Haiku 4.5 |
| **Kiro** | `kiro/deepseek-3.2` | `deepseek-3.2` | Text | DeepSeek V3 / R1 reasoning |
| **Kiro** | `kiro/qwen3-coder-next` | `qwen3-coder-next` | Text | Qwen 3 Coder Next |
| **Kiro** | `kiro/glm-5` | `glm-5` | Text | GLM-5 |
| **Kiro** | `kiro/minimax-m2.5` | `MiniMax-M2.5` | Text | MiniMax M2.5 |
| **Kiro** | `kiro/auto` | `auto` | Text, Multimodal | Dynamic routing cursor |

### Upstream Deduplication Engine
When the server fetches dynamic remote models (`fetchAntigravityModelEntries` / `syncModelsFromRemote`), raw upstream IDs (e.g. `gemini-3.7-flash-tiered`, `claude-opus-4-6-thinking`) are returned.
`getModelCatalog()` maintains a `seenUpstreams` set of `${provider}:${upstream}` pairs. Any dynamic model matching an existing upstream target is **strictly discarded**, preventing duplicate models in `/v1/models` and dashboard views.

### 6-Stage Model Resolution Cascade (`resolveModel`)
1. **Explicit Alias Map**: Checks `ALIAS_MAP` (e.g. `dall-e-3`, `imagen-3`, `claude-3.7-sonnet`, `gemini-3.7-flash-high`).
2. **Direct Canonical ID Match**: Exact public `id` match (`agy/gemini-3.7-flash`, `kiro/claude-sonnet-4.5`).
3. **Prefix Normalization**: Aliases `antigravity/*` $\rightarrow$ `agy/*`.
4. **Dot/Hyphen Variant Normalization**: Matches `kiro/claude-sonnet-4-5` to `kiro/claude-sonnet-4.5`.
5. **Bare Name Lookup**: Matches unprefixed names (`gemini-3.7-flash`, `claude-sonnet-4.5`) to default catalog entries.
6. **Dynamic Provider Inference**: Regex patterns route uncataloged model IDs (`/^gemini|gpt-oss/i` $\rightarrow$ Antigravity, `/^claude|gpt|deepseek|qwen|glm|minimax/i` $\rightarrow$ Kiro).

---

## 5. API Endpoints & Routes

### Client AI APIs
- `GET /v1/models`: Returns list of available models with ownership, context length, modalities, and thinking parameters.
- `POST /v1/chat/completions`: OpenAI-compatible chat completions (streaming SSE and non-streaming JSON).
- `POST /v1/messages`: Anthropic-compatible messages API (streaming SSE and non-streaming JSON).
- `POST /v1/images/generations` & `POST /images/generations`: OpenAI-compatible text-to-image generation.
- `POST /v1/images/edits` & `POST /images/edits`: OpenAI-compatible image editing (img2img).

### Admin REST API & Management
- `GET /` & `GET /index.html`: Web Dashboard UI.
- `GET /admin/api/state`: Full state snapshot (accounts with quotas, config, key counts).
- `GET /admin/api/keys`: List all sanitized API keys (`sk-gw-1234...5678`) with usage statistics.
- `POST /admin/api/keys`: Create a new API key (`{ name, expiresAt? }`).
- `POST /admin/api/keys/:id/revoke`: Revoke an API key immediately.
- `POST /admin/api/keys/:id/activate`: Reactivate a revoked API key.
- `DELETE /admin/api/keys/:id`: Permanently delete an API key.
- `POST /admin/api/backup/export`: Export account pool (plaintext or AES-256-GCM encrypted).
- `POST /admin/api/backup/import`: Restore account pool from backup.
- `POST /admin/api/kiro/login`: Start AWS SSO device code login.
- `GET /admin/api/antigravity/login`: Start Google OAuth PKCE login.

---

## 6. Codebase Map

| File Path | Description & Responsibilities |
|---|---|
| `src/index.ts` | Application entry point, environment loading, dual-stack host/port binding, store initialization, quota loop startup, and graceful shutdown. |
| `src/server.ts` | HTTP server router, CORS handling, API authentication, OpenAI/Anthropic/Image routing, admin REST endpoints, and dashboard serving. |
| `src/types.ts` | Core domain interfaces (`CoreRequest`, `CoreContent`, `ProviderEvent`, `Account`, `AccountQuota`, `ApiKey`, `ProviderError`). |
| `src/store.ts` | Atomic JSON disk store (`data/accounts.json`, `data/config.json`) with dirty tracking, debounced flushing, and API key management. |
| `src/models.ts` | Canonical model catalog (18 models), alias maps, upstream deduplication logic, and 6-stage model resolution cascade. |
| `src/pool.ts` | Multi-account pool manager, round-robin candidate selector, error state bookkeeping, in-flight token refresh, and stream rotation. |
| `src/quota.ts` | Background quota poller (10-min interval), reactive quota refresher, and multi-tier Antigravity/Kiro bucket parser. |
| `src/aggregate.ts` | `EventAggregator` collecting streaming events (text, images, tool calls, token usage, credits) into synchronous response structures. |
| `src/openai.ts` | Bidirectional OpenAI format converter (chat requests, image config extraction, streaming SSE chunks, non-streaming completion builder). |
| `src/anthropic.ts` | Bidirectional Anthropic format converter (messages requests, image content blocks, SSE event streams, non-streaming message builder). |
| `src/backup.ts` | Account pool backup and restore engine with optional AES-256-GCM encryption and scrypt key derivation. |
| `src/auth/antigravity.ts` | Google OAuth 2.0 PKCE, companion project discovery/provisioning, quota telemetry, token refresh, dynamic model fetching. |
| `src/auth/kiro.ts` | AWS SSO OIDC device code flow, desktop IDE token cache import, profile discovery, token refresh, usage limit telemetry. |
| `src/providers/antigravity.ts` | Google Cloud Code adapter, Gemini/Image envelope builder, schema sanitization, Vertex Claude formatting, SSE stream parser. |
| `src/providers/kiro.ts` | AWS CodeWhisperer adapter, conversation state builder, message flattener, tool spec adapter, binary event-stream consumer. |
| `src/providers/eventstream.ts` | AWS binary EventStream parser (prelude decoding, CRC32 verification, header and payload extraction). |
| `public/index.html` | Self-contained, responsive dark-mode management dashboard (Vanilla JS + CSS, zero CDN dependencies). |
| `tests/` | Comprehensive Bun test suite (`tests/formats.test.ts`, `tests/models.test.ts`, `tests/keys.test.ts`, `tests/eventstream.test.ts`, `tests/backup.test.ts`). |

---

## 7. Configuration & Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `GATEWAY_PORT` | `8787` (or `config.port`) | HTTP listening port for the gateway. |
| `HOST` / `BIND_HOST` | `0.0.0.0` (or `config.host`) | Network binding address (`0.0.0.0` for all interfaces). |
| `GATEWAY_DATA_DIR` | `./data` | Filepath where persistent JSON state files reside. |
| `ANTIGRAVITY_OAUTH_CLIENT_ID` | *(Built-in)* | Optional Google OAuth Client ID override. |
| `ANTIGRAVITY_OAUTH_CLIENT_SECRET` | *(Built-in)* | Optional Google OAuth Client Secret override. |

---

## 8. Development, Testing & Verification Rules

When developing or refactoring code in this repository:

1. **Verification Commands**:
   ```bash
   bun run typecheck   # Must pass with 0 TypeScript compilation errors
   bun test            # Must pass all unit test suites
   ```

2. **Preserve Multi-Protocol Parity**:
   - Any new model, tool, or modality feature must work seamlessly across OpenAI Chat Completions, Anthropic Messages, and Image API endpoints.
   - Preserve backward compatibility for model aliases in `src/models.ts`.

3. **No External Runtime Dependencies**:
   - Strictly adhere to Bun and Node built-in standard library APIs. Never add runtime npm dependencies.

