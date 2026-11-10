# Changelog

## 1.0.0 — 2026-11-10

- Initial release.
- Injects live-editable safety rules and a project-memory workflow into every DSH conversation.
- Three conversation modes: new project (ask three questions, then create memory files), continuation (MEMO.md exists), and established session.
- Automatically reads the project's `MEMO.md` and attaches it to the system prompt as data.
- Skips the user-facing bootstrap for delegated subagents.
- Seeds policy files under `$DSH_HOME/safety-memory` and never overwrites existing edits.
