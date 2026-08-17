# AI Gateway — Kiro + Google Antigravity

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Runtime Dependencies](https://img.shields.io/badge/Dependencies-0%20Runtime-blue.svg)](#features)
[![Vitest](https://img.shields.io/badge/Tested%20With-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-performance, multi-account AI Gateway bridging **AWS Kiro** (CodeWhisperer / Q Developer) and **Google Antigravity** (Cloud Code) into unified **OpenAI-** and **Anthropic-compatible** API endpoints.

---

## ✨ Features

- 🔌 **Dual API Compatibility**:
  - **OpenAI Endpoint**: `/v1/models`, `/v1/chat/completions` (streaming SSE & non-streaming JSON).
  - **Anthropic Endpoint**: `/v1/messages` (streaming SSE & non-streaming JSON), enabling seamless native integration with **Claude Code**.
- 🔄 **Intelligent Multi-Account Pooling**:
  - Pool unlimited Kiro and Antigravity accounts.
  - Transparent round-robin routing with automatic failover on rate limits (`429`), quota limits (`402` / `RESOURCE_EXHAUSTED`), and token expiration.
- 📊 **Real-Time Quota Monitoring**:
  - Live per-account quota & credit tracking (Kiro usage limits, Antigravity quota buckets).
  - Automated background refresh (every 10 minutes) and reactive refresh upon upstream error.
- 🛠️ **Full Tool Calling & Vision Support**:
  - End-to-end support for function calling and multimodal image inputs across both providers.
- 🖥️ **Built-in Web Dashboard**:
  - Single-page management UI (Vanilla JS + CSS, zero build step) for OAuth logins, device flows, account health, live quotas, server settings, and API key generation.
- 🔒 **Encrypted Account Portability**:
  - Export and import account pools with optional AES-256-GCM encryption for seamless migration between local machines and remote servers/VPS.
- ⚡ **Zero Runtime Dependencies**:
  - Built entirely with native Node.js standard library APIs (`node:http`, `node:crypto`, `node:fs`, `node:events`, `fetch`).

---

## 🏛️ Architecture & Request Flow

```
                     ┌──────────────────────────────────────────────┐
                     │ Client (Claude Code, Cursor, Cline, SDK, UI) │
                     └──────────────────────┬───────────────────────┘
                                            │ HTTP Request (Bearer sk-gw-...)
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          HTTP Router (src/server.ts)         │
                     └──────┬────────────────────────────────┬──────┘
                            │                                │
            OpenAI Format   ▼                                ▼   Anthropic Format
                 ┌──────────────────────┐        ┌──────────────────────┐
                 │    src/openai.ts     │        │   src/anthropic.ts   │
                 └──────────┬───────────┘        └──────────┬───────────┘
                            │                               │
                            └───────────────┬───────────────┘
                                            ▼
                             Unified CoreRequest Abstraction
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │           Pool Manager (src/pool.ts)         │
                     │  • Account Selection (Round-Robin)           │
                     │  • Error Cooldowns & Single-Flight Rotation  │
                     │  • Automatic Token Refresh                   │
                     └──────┬────────────────────────────────┬──────┘
                            │                                │
             Provider: Kiro ▼                                ▼ Provider: Antigravity
    ┌─────────────────────────────────┐    ┌──────────────────────────────────┐
    │       src/providers/kiro.ts     │    │   src/providers/antigravity.ts   │
    │  • AWS Binary EventStream Frame │    │  • Cloud Code Gemini Envelope    │
    │  • CodeWhisperer Upstreams      │    │  • Server-Sent Events (SSE)      │
    └────────────────┬────────────────┘    └────────────────┬─────────────────┘
                     │                                      │
                     ▼                                      ▼
           AWS CodeWhisperer API                  Google Cloud Code API
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js ≥ 22.18** (for native TypeScript type stripping) or **Node.js ≥ 20.0.0** (executed with `tsx`).
- npm or pnpm.

### 1. Installation
```bash
# Clone the repository
git clone git@github.com:Aegis-plus/ai-gateway.git
cd ai-gateway

# Install dependencies (development tools: tsx, vitest, typescript)
npm install

# Optional: configure custom OAuth credentials
cp .env.example .env
```

### 2. Start the Server
```bash
# Development mode (with live reload)
npm run dev

# Or production mode
npm start
```

### 3. Open the Dashboard
Visit **[http://127.0.0.1:8787/](http://127.0.0.1:8787/)** in your browser.

---

## 🔑 Authentication & Account Setup

In the dashboard, add accounts from one or both providers:

### Adding Kiro Accounts
- **Option A (Device Flow)**: Click **+ Kiro account**. Copy the generated user code and approve it in your browser with your AWS Builder ID.
- **Option B (Desktop Import)**: Click **Import token** and paste the JSON content from your local `~/.aws/sso/cache/kiro-auth-token.json` (created when logged into the Kiro IDE).

### Adding Google Antigravity Accounts
- Click **+ Antigravity account** and complete the Google OAuth sign-in.
- The gateway automatically onboards and configures the Cloud Code companion project on initial login.

### Creating API Keys
1. In the dashboard, navigate to **API Keys**.
2. Click **Generate key** to create a gateway key (`sk-gw-...`).
3. Use this key in your client headers as `Authorization: Bearer sk-gw-...`.

---

## 💻 Client Integration Examples

### Claude Code
Configure Claude Code to use the gateway's Anthropic-compatible endpoint:

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8787
export ANTHROPIC_AUTH_TOKEN=sk-gw-your-gateway-key   # or ANTHROPIC_API_KEY
claude --model claude-sonnet-4.5
```

### Cursor / Cline / Roo Code / Zed / Continue
- **API Base URL**: `http://127.0.0.1:8787/v1`
- **API Key**: `sk-gw-your-gateway-key`
- **Model**: `claude-sonnet-4.5`, `gemini-3.1-pro-high`, or any catalog model ID.

### cURL — OpenAI Format
```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer sk-gw-your-gateway-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "messages": [
      {"role": "user", "content": "Explain quantum computing in one sentence."}
    ],
    "stream": true
  }'
```

### cURL — Anthropic Format
```bash
curl http://127.0.0.1:8787/v1/messages \
  -H "x-api-key: sk-gw-your-gateway-key" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello world"}
    ]
  }'
```

### Python SDK (OpenAI)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8787/v1",
    api_key="sk-gw-your-gateway-key"
)

response = client.chat.completions.create(
    model="gemini-3.1-pro-high",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

---

## 🤖 Supported Models

You can use friendly catalog IDs or pass raw upstream model IDs directly with `kiro/<model>` or `antigravity/<model>`.

### Kiro Models (AWS CodeWhisperer)
| Model ID | Description |
|---|---|
| `claude-opus-5` / `claude-opus-5-thinking` | Claude Opus 5 (Standard & Extended Thinking) |
| `claude-sonnet-5` / `claude-sonnet-5-thinking` | Claude Sonnet 5 (Standard & Extended Thinking) |
| `claude-sonnet-4.5` / `claude-sonnet-4.5-thinking` | Claude Sonnet 4.5 |
| `claude-opus-4.8` / `claude-opus-4.8-thinking` | Claude Opus 4.8 |
| `claude-haiku-4.5` | Claude Haiku 4.5 |
| `gpt-5.6-sol` / `gpt-5.6-sol-thinking` | GPT 5.6 Sol (272k context) |
| `gpt-5.6-terra` / `gpt-5.6-luna` | GPT 5.6 Terra / Luna variants |
| `deepseek-3.2` | DeepSeek 3.2 |
| `qwen3-coder-next` | Qwen3 Coder Next |
| `glm-5` | GLM 5 |
| `minimax-m2.5` | MiniMax M2.5 |
| `claude-sonnet-4.5-agentic` | Claude Sonnet 4.5 (Agentic prompt profile) |

### Google Antigravity Models (Cloud Code)
| Model ID | Description |
|---|---|
| `gemini-3.1-pro-high` / `gemini-3.1-pro-low` | Gemini 3.1 Pro (High & Low agent profiles) |
| `gemini-3.7-flash-high` / `gemini-3.7-flash-medium` | Gemini 3.7 Flash |
| `gemini-3.6-flash-high` / `gemini-3.6-flash-low` | Gemini 3.6 Flash |
| `gemini-3.5-flash-high` / `gemini-3.5-flash-low` | Gemini 3.5 Flash |
| `gemini-3.1-flash-lite` | Gemini 3.1 Flash Lite |
| `gemini-2.5-flash` / `gemini-2.5-flash-thinking` | Gemini 2.5 Flash |
| `claude-sonnet-4-6` / `claude-opus-4-6-thinking` | Claude models hosted on GCP Cloud Code |
| `gpt-oss-120b-medium` | GPT-OSS 120B |

*Custom models can be added or renamed at any time in [`src/models.ts`](file:///home/aegis/Project/AI%20Gateway/src/models.ts).*

---

## ⚙️ Configuration & Environment

Configuration is stored in `data/config.json` and can be adjusted via the Dashboard **Settings** page or through environment variables.

### Configuration Options
| Setting | Env Variable | Default | Description |
|---|---|---|---|
| Port | `PORT` | `8787` | Port the HTTP gateway listens on. |
| Host | `HOST` | `127.0.0.1` | Network interface to bind (`0.0.0.0` for LAN access). |
| Public Base URL | `PUBLIC_BASE_URL` | — | Base URL required for OAuth redirects if behind a reverse proxy. |
| Dashboard Password | `ADMIN_PASSWORD` | — | Protects `/admin/api` endpoints and settings. |
| Data Directory | `GATEWAY_DATA_DIR` | `./data` | Filepath for atomic JSON account and config persistence. |
| Antigravity Client ID | `ANTIGRAVITY_OAUTH_CLIENT_ID` | — | Custom Google OAuth client ID override. |
| Antigravity Client Secret | `ANTIGRAVITY_OAUTH_CLIENT_SECRET` | — | Custom Google OAuth client secret override. |

---

## 📦 Backup, Security & Migration

- **Encrypted Account Export**: In the dashboard (**Accounts → Backup & restore**), download your full account pool protected by **AES-256-GCM** encryption.
- **Cross-Host Migration**: Import your backup on remote VPS servers or secondary development machines without repeating web OAuth or device authorization steps.
- **Deduplication**: Restoring a backup automatically merges accounts, eliminates duplicate tokens, and resets temporary error cooldowns.

---

## 📂 Project Structure

```
├── .env.example              # Environment variables template
├── data/                     # Persistent JSON storage (ignored by Git)
│   ├── accounts.json         # Account credentials, status & quota cache
│   └── config.json           # Server configuration & API keys
├── public/
│   └── index.html            # Single-page web dashboard (Vanilla HTML/CSS/JS)
├── src/
│   ├── index.ts              # Server bootstrap and lifecycle handling
│   ├── server.ts             # HTTP router (/v1/*, /admin/api/*, static dashboard)
│   ├── types.ts              # TypeScript interfaces (CoreRequest, Account, etc.)
│   ├── store.ts              # Atomic JSON persistence layer
│   ├── pool.ts               # Account pooling, rotation, and retry mechanics
│   ├── models.ts             # Model registry and resolution aliases
│   ├── quota.ts              # Background quota poller and usage updater
│   ├── openai.ts             # OpenAI protocol translation adapter
│   ├── anthropic.ts          # Anthropic protocol translation adapter
│   ├── backup.ts             # AES-256-GCM backup encryption/decryption
│   ├── auth/
│   │   ├── antigravity.ts    # Google OAuth PKCE, token refresh & project setup
│   │   └── kiro.ts           # AWS SSO device authorization & token refresh
│   └── providers/
│       ├── antigravity.ts    # Gemini SSE envelope formatting & response parsing
│       ├── kiro.ts           # CodeWhisperer request builder & event processing
│       └── eventstream.ts    # AWS binary EventStream parser
└── tests/                    # Vitest test suite (protocol conversions, parsers, backup)
```

---

## 🛠️ Development & Testing

```bash
# Type checking
npm run typecheck

# Run unit test suite
npm test

# Run tests in watch mode
npx vitest

# Run server with live reload
npm run dev:watch
```

---

## 📄 License

MIT © [Aegis](https://github.com/Aegis-plus)
