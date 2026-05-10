## Agent skills

### Issue tracker

GitHub Issues in this repository. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with a root `CONTEXT.md`. See `docs/agents/domain.md`.

### Issue completion workflow

When an agent finishes implementation for a GitHub issue and all relevant tests pass, it must give the user a concise manual test checklist for the issue acceptance criteria. The agent must wait for the user's green light before moving the issue to `done` or closing it.
