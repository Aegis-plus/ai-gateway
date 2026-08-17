# AI Gateway — Kiro + Antigravity

A lightweight multi-account gateway for **Kiro** and **Google Antigravity** with:

- **OpenAI-compatible API** — `/v1/models`, `/v1/chat/completions` (streaming + non-streaming)
- **Anthropic-compatible API** — `/v1/messages` (streaming + non-streaming), so Claude Code can use it directly
- **Multi-account pooling** — add any number of Kiro and Google accounts, round-robin with automatic rotation on rate limits and quota errors
- **Quota checking** — live per-account usage (Kiro usage limits, Antigravity quota buckets), refreshed every 10 minutes and after errors
- **Dashboard** — log in to Kiro/Antigravity, manage accounts, view quotas, create API keys
- **Tool calling & images** — end-to-end on both providers

Zero runtime dependencies (Node built-ins only). State is two JSON files in `data/`.

## Quick start

Requires **Node.js ≥ 22.18** (type stripping) — or any Node 20+ if you run it through `tsx`.

```bash
npm install
npm run dev          # or: npm start
```

Open the dashboard at **http://127.0.0.1:8787/**.

### Add accounts

- **Kiro** — click *"+ Kiro account"*; a device code appears; approve it at the link with your AWS Builder ID. Alternatively, paste the contents of `~/.aws/sso/cache/kiro-auth-token.json` from a machine where the Kiro IDE is signed in (*Import token*).
- **Antigravity** — click *"+ Antigravity account"*; sign in with Google in the popup. The gateway automatically onboards the Cloud Code companion project on first login.

### Create an API key

In the dashboard → **API Keys** → *Generate key*. Use the `sk-gw-…` key with any OpenAI-compatible client:

```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer sk-gw-…" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-5","messages":[{"role":"user","content":"hi"}],"stream":true}'
```

**Claude Code:**

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8787
export ANTHROPIC_AUTH_TOKEN=sk-gw-…   # or ANTHROPIC_API_KEY
claude --model claude-sonnet-4-5
```

**Cline / Cursor / Roo / Zed:** base URL `http://127.0.0.1:8787/v1`, API key from the dashboard, any model below.

## Models

Friendly ids (edit `src/models.ts` to change them). Raw upstream ids also work with a `kiro/…` or `antigravity/…` prefix.

| Model id | Provider | Notes |
|---|---|---|
| `claude-sonnet-4-5` | kiro | Claude Sonnet 4.5 |
| `claude-sonnet-4` | kiro | Claude Sonnet 4 |
| `claude-3-7-sonnet` | kiro | Claude 3.7 Sonnet |
| `claude-3-5-haiku` | kiro | auto-routed by Kiro |
| `gemini-3-pro`, `gemini-3-pro-high` | antigravity | Gemini 3 Pro |
| `gemini-3-flash` | antigravity | Gemini 3 Flash |
| `gemini-2.5-flash`, `gemini-2.5-pro` | antigravity | Gemini 2.5 family |
| `claude-sonnet-4-5-gcp` | antigravity | Claude Sonnet 4.5 via Antigravity |
| `gpt-oss-120b` | antigravity | GPT-OSS 120B |

## How it works

```
client (OpenAI or Anthropic format)
        │  Bearer sk-gw-…
        ▼
 src/openai.ts / src/anthropic.ts ──► CoreRequest (unified)
        ▼
 src/pool.ts ── round-robin over healthy accounts,
        │        retry on 429/402/401 before the first token,
        │        cooldown + rotate on quota errors
        ▼
 src/providers/kiro.ts          src/providers/antigravity.ts
 AWS event-stream ◄──────────►   Gemini SSE (v1internal)
 codewhisperer.us-east-1         cloudcode-pa.googleapis.com
```

- **Kiro auth**: AWS SSO device flow (`oidc.us-east-1.amazonaws.com`) → CodeWhisperer profile + `getUsageLimits` quota. Refresh via OIDC (device-login accounts) or `prod.us-east-1.auth.desktop.kiro.dev` (imported IDE tokens).
- **Antigravity auth**: Google OAuth + PKCE with the Antigravity IDE client → `loadCodeAssist`/`onboardUser` project bootstrap → `streamGenerateContent?alt=sse`. Quota from `retrieveUserQuotaSummary` buckets and in-stream `remainingCredits`.

## Layout

```
src/index.ts        entry point
src/server.ts       HTTP routing (/v1/*, /admin/api/*, dashboard)
src/store.ts        JSON persistence (data/accounts.json, data/config.json)
src/models.ts       model catalog — edit this to add models
src/pool.ts         account selection, cooldowns, rotation
src/quota.ts        periodic quota refresh
src/openai.ts       OpenAI ⇄ core conversion
src/anthropic.ts    Anthropic ⇄ core conversion
src/auth/kiro.ts    device login, refresh, import, getUsageLimits
src/auth/antigravity.ts  OAuth PKCE, refresh, project bootstrap, quota
src/providers/kiro.ts    Kiro request/response + event-stream parser
src/providers/antigravity.ts  Gemini conversion + SSE parsing
public/index.html   dashboard (vanilla JS, no build step)
tests/              vitest unit tests
```

## Backup & restore

Dashboard → **Accounts** → *Backup & restore*:

- **Download backup** — saves all accounts (tokens included) as one JSON file. Optionally enter a passphrase to encrypt it (AES-256-GCM); an unencrypted backup contains raw refresh tokens, so store it somewhere safe.
- **Restore backup** — pick a backup file (and its passphrase if encrypted). Accounts are merged: duplicates (same provider + email, or same refresh token) are skipped, and cooldowns/stats are reset. This is the easy way to move accounts to another machine (e.g. your VPS) without re-doing the Google/AWS logins.

API equivalents: `POST /admin/api/backup` (`{passphrase?}`) and `POST /admin/api/restore` (`{content, passphrase?}`).

## Configuration

Dashboard → **Settings** (stored in `data/config.json`):

| Setting | Default | Purpose |
|---|---|---|
| Port | `8787` | listen port (restart to apply) |
| Bind host | `127.0.0.1` | use `0.0.0.0` to expose on LAN (restart to apply) |
| Public base URL | — | required for the Antigravity OAuth callback when the dashboard is reached via a non-localhost URL |
| Dashboard password | — | optional; protects `/admin/api` |

Environment variables: `GATEWAY_DATA_DIR` (state directory, default `./data`), `ANTIGRAVITY_OAUTH_CLIENT_ID` / `ANTIGRAVITY_OAUTH_CLIENT_SECRET` (override the bundled Antigravity OAuth client).

## Notes

- The upstream endpoints are the IDEs' internal APIs and can change without notice; provider code is isolated in `src/providers/` and `src/auth/` so fixes stay local.
- Use with your own accounts. Both IDEs' free tiers are meant for interactive use — heavy automated traffic may risk your accounts.
- Kiro does not report token usage; the gateway estimates it (chars ÷ 4) in API responses.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run (30 tests: parsers, conversions, error classification)
npm run dev         # run with tsx (works on Node 20+)
```
