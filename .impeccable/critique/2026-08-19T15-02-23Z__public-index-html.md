---
target: public/index.html add mobile support and make it more modern
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-08-19T15-02-23Z
slug: public-index-html
---
## Design Health Score

| # | Heuristic | Score (0-4) | Key Finding |
|---|---|:---:|---|
| **1** | **Visibility of System Status** | **3** | Status indicator and 15s polling work, but active SSE proxy streams and OAuth popups lack live progress indicators. |
| **2** | **Match Between System & Real World** | **4** | Flawless domain terminology ("AWS Builder ID", "Google One AI Pro", "Gemini 3.7", "Claude Sonnet 4.6", "Single-Flight Cooldown"). |
| **3** | **User Control and Freedom** | **2** | Destructive actions use native browser `confirm()`; 401 uses blocking `prompt()`; no undo on account removal. |
| **4** | **Consistency and Standards** | **3** | Consistent badge semantics across Kiro and Antigravity; minor copy button text timing discrepancies. |
| **5** | **Error Prevention** | **2** | No validation on settings inputs; no passphrase strength or confirmation match on backup export. |
| **6** | **Recognition Rather Than Recall** | **3** | Excellent embedded setup snippets; model catalog lacks category filter pills (Coding, Reasoning, Multimodal). |
| **7** | **Flexibility and Efficiency of Use** | **2** | Lacks keyboard shortcuts (`Cmd+K` for model search, `1-5` tab shortcuts); no batch actions or status filters. |
| **8** | **Aesthetic and Minimalist Design** | **2** | Monotone dark boxes; multi-account setups cause vertical scroll walls; secondary text contrast `#64748b` on `#0f1422` is 3.6:1 (fails WCAG AA). |
| **9** | **Error Recognition, Diagnosis, Recovery** | **3** | Detailed upstream error tooltips; notice banner auto-dismisses abruptly after 6s even on multi-line traces. |
| **10** | **Help and Documentation** | **2** | Quick integration snippets are strong, but cooldown decay and companion project onboarding lack inline tooltips. |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Design Specificity Verdict

- **LLM Assessment**: The domain model and technical concepts are authentic to AI Gateway (AWS Builder ID, Google Cloud Code, Gemini/Claude quota separation, dual-protocol integration snippets). However, visually and structurally it resembles a dated flat admin dashboard: monotone dark panels, rigid desktop-centric forms, and lack of mobile thumb-zone ergonomics.
- **Deterministic Scan**: Ran `detect.mjs` (0 regex-fallback syntax warnings). Deep manual code inspection revealed 14+ mobile responsiveness deficiencies (missing responsive breakpoints, sub-36px touch targets, fixed 280px form widths, and top-heavy navigation on mobile).

## Overall Impression
AI Gateway has a robust, clean domain core, but currently feels desktop-tethered and visually muted. Adding responsive mobile thumb-navigation, 44px+ touch targets, modern glassmorphic surface elevation, ambient live gateway telemetry, and interactive code snippets will elevate it into a polished, developer-grade control center.

## What's Working
1. **Multi-Pool Quota Isolation**: Clean visual separation between Gemini and Claude/GPT-OSS quota headroom.
2. **Zero-Dependency Lightweight Speed**: Zero external framework bloat allows instant sub-millisecond localhost execution.
3. **Developer Setup Affordances**: Immediate copyable configuration snippets for Claude Code and Cursor.

## Priority Issues
- **[P0] Mobile Ergonomics & Responsive Breakpoints**: Top navigation unreachable on phone viewports; action buttons are sub-36px touch targets; fixed-width form rows overflow on 320px–375px screens.
- **[P1] Modern Surface Craft & Live Telemetry**: Missing specular border radiance, layered glassmorphic depth, and real-time visual pulse for active proxy streams.
- **[P2] Accessibility & Keyboard Navigation**: Secondary text `#64748b` fails contrast (3.6:1); model cards lack `<button>` keyboard focus; missing `Cmd+K` quick model search.
- **[P3] Progressive Disclosure & Quota Scalability**: 3+ accounts generate overwhelming vertical walls of 20+ progress bars without a collapsed view or status filters.

## Persona Red Flags
- **Casey (Distracted Mobile User on Phone)**: Top nav requires two hands; tiny 28px `Remove` / `↻ Quota` buttons risk accidental deletion.
- **Alex (Power User)**: No keyboard shortcuts (`Cmd+K`, `1-5` tab keys); no account status filter (Active / Cooldown / Depleted).
- **Jordan (First-Timer)**: Native `window.prompt()` for password feels like an error; empty state lacks a 3-step setup walkthrough.
- **Sam (Accessibility User)**: `#64748b` fails 4.5:1 text contrast; navigation tabs and notices lack proper WAI-ARIA roles.

## Minor Observations
- Notification banner vanishes after 6s regardless of error message length.
- Model search input lacks an instant clear (`✕`) button.
- Device login polling has no retry/timeout recovery button.

## Questions to Consider
1. What if the mobile layout featured a sleek bottom navigation bar and touch-friendly cards for effortless one-handed monitoring on phones?
2. What if the overview included a unified "Headroom HUD" showing total available requests across all connected accounts at a glance?
