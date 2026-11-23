# Changelog

## 1.0.1 — 2026-11-23

- Project memory is now a thin index: `MEMO.md` (target ≤ 40 lines / 2KB) plus on-demand `ENV.md` / `RUNBOOK.md` / `PITFALLS.md` / `DECISIONS.md` / `LOG.md`.
- Shipped templates and the memory workflow were rewritten to match, including a wrap-up checklist with a MEMO budget check and cleanup of stale notes.
- Startup mode now creates only `MEMO.md` + `ENV.md` before asking for confirmation; the rest are created when needed.
- Continuation and established-session hints now point at the MEMO's environment summary (section 0) and progress (section 2).
- Subagent hint no longer names specific memory files; it defers to the main session.
- Added a self-hosted plugin market index (`market/index.json`).

## 1.0.0 — 2026-11-10

- Initial release.
- Injects live-editable safety rules and a project-memory workflow into every DSH conversation.
- Three conversation modes: new project (ask three questions, then create memory files), continuation (MEMO.md exists), and established session.
- Automatically reads the project's `MEMO.md` and attaches it to the system prompt as data.
- Skips the user-facing bootstrap for delegated subagents.
- Seeds policy files under `$DSH_HOME/safety-memory` and never overwrites existing edits.
