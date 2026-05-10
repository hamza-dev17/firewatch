# Triage Labels

The skills speak in terms of canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

## Skill Role Mapping

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role, use the corresponding label string from this table.

## Workflow State Labels

These labels track implementation state:

- `ready-for-agent`: ready to start
- `in-progress`: work has started
- `done`: implementation complete and issue closed

Preferred transitions:

1. Start work: remove `ready-for-agent`, add `in-progress`.
2. Finish work: remove `in-progress`, add `done`, close issue.

## Type Labels And State Labels

State labels and type labels can coexist.

Examples:

- `enhancement` + `in-progress`
- `bug` + `done`

Rule: keep one workflow state label at a time, while allowing any relevant type labels (`bug`, `enhancement`, `documentation`, and so on).
