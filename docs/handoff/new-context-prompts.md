# New Context Prompts

Use these prompts when opening a fresh Codex window.

## Recommended Workflow

1. Use the grilled architecture baseline as the implementation reference.
2. Reopen architecture questions only when implementation reveals a real conflict.
3. Create ADRs only for decisions that are hard to reverse, surprising without context, and based on a real trade-off.
4. Use the approved PRD as the product baseline.
5. Reopen PRD scope only when implementation reveals a real conflict.
6. Break the approved PRD into implementation issues.

## Architecture Follow-Up Prompt

```text
Use $grill-with-docs.

I want to review or extend the grilled FIREWATCH DSS architecture baseline. Read:

- CONTEXT.md
- docs/ui/firewatch-dashboard.md
- docs/architecture/firewatch-architecture.md

Goal: challenge only decisions affected by the new work, give your recommended answer, and update the architecture doc or CONTEXT.md as decisions are resolved. Offer ADRs only when the decision is hard to reverse, surprising without context, and a real trade-off.

Start with the biggest implementation risk created by the new work.
```

## PRD Follow-Up Prompt

```text
Use $grill-with-docs.

I want to review or extend the approved FIREWATCH DSS PRD. Read:

- CONTEXT.md
- docs/ui/firewatch-dashboard.md
- docs/architecture/firewatch-architecture.md
- docs/prd/firewatch-dss-prd.md

Goal: challenge only product decisions affected by the new work, give your recommended answer, and update the PRD or CONTEXT.md as decisions are resolved.

Start with the biggest product risk created by the new work.
```

## Issue Breakdown Prompt

```text
Use $to-issues.

I want to break the approved FIREWATCH DSS PRD into small implementation issues. Read:

- CONTEXT.md
- docs/ui/firewatch-dashboard.md
- docs/architecture/firewatch-architecture.md
- docs/prd/firewatch-dss-prd.md

Create independently grabbable tracer-bullet issues that build the MVP end-to-end first, then add enhancements. Keep each issue small enough for an agent to implement and test.
```
