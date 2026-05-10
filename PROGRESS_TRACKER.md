# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- In progress

## Current Goal

- Realign the MVP frontend direction before continuing implementation: keep the map-first wildfire risk workflow, but replace the earlier dark/Sentinel-style visual treatment with an Apple-inspired operational interface that supports light and dark themes.

## Completed

- Issue #1 implemented and verified: project shell, backend health/status surfaces, frontend dashboard shell, environment documentation, and smoke checks.
- Product/design docs updated to make the Apple-inspired visual direction the source of truth.
- `CONTEXT.md` glossary updated from `Sentinel-Inspired Interface` to `Apple-Inspired Operational Interface`.
- PRD updated with light/dark theme and calm rounded UI user stories.
- Architecture docs updated so frontend owns theme selection, theme persistence, design tokens, rounded controls, and restrained risk-color presentation.

## In Progress

- Issue #20: align the already-implemented frontend shell from issue #1 with the revised Apple-inspired design direction.

## Next Up

- Refactor the existing frontend shell to add light/dark theme support, neutral design tokens, rounded native-app controls, and restrained risk colors.
- Verify the redesigned shell visually in both themes before building deeper dashboard features.
- Continue issue #2 after issue #20 is complete.

## Open Questions

- Which accent color should be the default: Apple-style blue, calm green, or another restrained project accent?
- Should the initial default theme follow system preference, or should the app default to light theme for project demos?

## Architecture Decisions

- The MVP remains a map-first decision-support dashboard, not a marketing site or generic admin panel.
- The frontend visual source of truth is now the Apple-Inspired Operational Interface: neutral surfaces, rounded controls, restrained color, polished light/dark themes, and native-app interaction feel.
- Risk colors are semantic accents only. They should appear in badges, markers, rings, small charts, or status accents, not dominate whole panels or the page background.
- The old Sentinel-style direction is superseded visually, but map-first layout grammar, side rails, compact overlays, and a bottom strip may still be used when they serve the workflow.

## Session Notes

- The first issue exposed a mismatch between the documented old visual direction and the desired product feel.
- The user prefers modern Apple-like UI: rounded, calm, minimal color, and theme choices.
- GitHub issue #20 was created to repair the frontend shell design before continuing the original PRD issue sequence.
- Open GitHub issues were audited after the PRD update. Original open issues #2-#18 do not contain stale `Sentinel`, `dark`, or `command-center` visual acceptance criteria, so issue #20 is enough to bridge the PRD change.
- Before implementing more PRD issues, correct the design foundation so later dashboard work is built on the right visual system.
