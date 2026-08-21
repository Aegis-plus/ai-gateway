# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Solo developers and power users managing personal multi-provider accounts (Google Antigravity / Google One AI Premium and AWS Kiro / CodeWhisperer Builder ID) to drive local AI coding tools and agents (Claude Code CLI, Cursor, Cline, Roo Code, Python SDK) with uninterrupted uptime and zero vendor lock-in.

## Product Purpose
Provide a high-performance, self-hosted, lightweight AI gateway that bridges upstream multi-account AI subscriptions into standard OpenAI and Anthropic API endpoints with intelligent account rotation, multi-tier quota isolation, credential self-healing, and encrypted portable state backups.

## Positioning
A zero-dependency local proxy that turns fragmented subscription accounts (Antigravity Google One Pro / Enterprise and AWS CodeWhisperer/Kiro) into robust, unified OpenAI and Anthropic endpoints with automatic single-flight account rotation and zero telemetry leakage.

## Operating Context
- Local developer workstation running agentic coding workflows (Claude Code, Cursor, Cline, Roo Code).
- Gateway runs as a lightweight daemon/service on localhost (default port 8787).
- Admin dashboard served directly as a self-contained web SPA at root `/` for visual account management, model discovery, API key generation, and backup/restore.

## Capabilities and Constraints
- Dual-protocol translation: Standard OpenAI (`/v1/chat/completions`, `/v1/models`) and Anthropic (`/v1/messages`) endpoints with streaming SSE and tool calling.
- Multi-provider support:
  - Antigravity (Google Cloud Code): OAuth 2.0 PKCE, companion project onboarding, Gemini 3.7/3.6/3.5/3.1, Claude 4.6 Sonnet/Opus, GPT-OSS 120B, distinct quota bucket categorization (Gemini vs Claude/Open pools).
  - Kiro (AWS CodeWhisperer / Amazon Q): OIDC device code login, Desktop IDE token import, single-flight token refresh, multi-endpoint usage telemetry.
- Intelligent single-flight account pool with automatic cooldown rotation on 429 / quota exhaustion.
- Encrypted JSON configuration backup and restore (AES-GCM / PBKDF2).
- Zero heavy framework lock-in: Pure Node.js / TypeScript runtime, vanilla HTML5/CSS3/JS dashboard.

## Brand Commitments
- Name: AI Gateway
- Voice: Technical, clean, developer-first, resilient, transparent.
- Aesthetics: High-craft glassmorphic dark theme, responsive, fast, zero external CSS/JS CDN dependencies.

## Evidence on Hand
- Complete Node.js / TypeScript gateway implementation in `src/` with 42+ unit tests passing in Vitest.
- Production-ready dark theme single-page application in `public/index.html`.
- Dynamic model catalog supporting 50+ frontier models across Google and AWS upstreams.

## Product Principles
1. Transparent Protocol Fidelity — Request and response translation between OpenAI/Anthropic and upstreams must be byte-precise, preserving streaming chunks, reasoning/thinking content, and tool calls.
2. Resilient Account Pool & Cooldowns — Quota exhaustion or upstream 429s on one account must immediately and gracefully rotate to the next healthy account without failing client requests.
3. Self-Contained & Minimalist Footprint — Zero external database or heavyweight runtime dependencies; lightweight, portable execution with encrypted local state persistence.
4. Quota Transparency — Clear visual isolation and tracking between independent upstream quota pools (e.g. Gemini vs Claude/GPT-OSS).
