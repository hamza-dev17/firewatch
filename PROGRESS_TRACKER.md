# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- In progress

## Current Goal

- Deliver the next PRD implementation issue end-to-end using the same backend-first + dashboard integration vertical slice flow.

## Completed

- Issue #1 implemented and verified: project shell, backend health/status surfaces, frontend dashboard shell, environment documentation, and smoke checks.
- Issue #20 completed: frontend shell aligned to Apple-inspired operational direction with light/dark theme support and rounded neutral UI tokens.
- Issue #2 implemented and verified: backend `GET /api/locations/search` now resolves curated Turkish locations and direct coordinates, and dashboard search now supports selectable results with visible selected-location state.
- Issue #3 implemented and verified: backend runtime feature contract now exposes stable schema/unit/exclusion metadata in `GET /api/status`, and contract validation rejects missing, extra, or wrong-unit feature vectors before prediction.
- Issue #4 implemented and verified: backend `POST /api/weather/windows` now fetches current/forecast OpenWeather data, maps `now/24h/48h/72h` windows, normalizes canonical runtime feature inputs, separates display-only weather signals, and returns explicit degraded source labels when weather is unavailable.
- Product/design docs updated to make the Apple-inspired visual direction the source of truth.
- `CONTEXT.md` glossary updated from `Sentinel-Inspired Interface` to `Apple-Inspired Operational Interface`.
- PRD updated with light/dark theme and calm rounded UI user stories.
- Architecture docs updated so frontend owns theme selection, theme persistence, design tokens, rounded controls, and restrained risk-color presentation.

## In Progress

- None.

## Next Up

- Continue with the next PRD implementation issue after #5, keeping the same backend-first + dashboard integration vertical slice flow.
- Start by defining the next smallest testable behavior and implementing it via red-green-refactor.

## Open Questions

- Which accent color should be the default: Apple-style blue, calm green, or another restrained project accent?
- Should the initial default theme follow system preference, or should the app default to light theme for project demos?

## Architecture Decisions

- The MVP remains a map-first decision-support dashboard, not a marketing site or generic admin panel.
- The frontend visual source of truth is now the Apple-Inspired Operational Interface: neutral surfaces, rounded controls, restrained color, polished light/dark themes, and native-app interaction feel.
- Risk colors are semantic accents only. They should appear in badges, markers, rings, small charts, or status accents, not dominate whole panels or the page background.
- The old Sentinel-style direction is superseded visually, but map-first layout grammar, side rails, compact overlays, and a bottom strip may still be used when they serve the workflow.
- Issue workflow labels now use `ready-for-agent` -> `in-progress` -> `done`, and can coexist with type labels such as `bug` and `enhancement`.

## Session Notes

- Issue #20 implementation started: added a visible light/dark theme control to the dashboard chrome, persisted the selected theme in local storage, and added behavior tests for switching and restoring the theme.
- Issue #20 frontend shell redesign applied: replaced the older dark/Sentinel-style surface with theme-scoped neutral design tokens, rounded dashboard controls, compact data source labels, restrained semantic risk accents, and fuller map-first shell content across the header, side panels, map workspace, role selector, and bottom strip.
- Issue #20 review adjustment: moved Demo Role Selection out of its standalone dashboard section and into the top status header as a compact demo role control, matching the UI docs that treat role selection as dashboard chrome.
- The first issue exposed a mismatch between the documented old visual direction and the desired product feel.
- The user prefers modern Apple-like UI: rounded, calm, minimal color, and theme choices.
- GitHub issue #20 was created to repair the frontend shell design before continuing the original PRD issue sequence.
- Open GitHub issues were audited after the PRD update. Original open issues #2-#18 do not contain stale `Sentinel`, `dark`, or `command-center` visual acceptance criteria, so issue #20 is enough to bridge the PRD change.
- Before implementing more PRD issues, correct the design foundation so later dashboard work is built on the right visual system.
- Issue #2 backend tests added for curated match, direct coordinate parsing (`lat, lon`), and explicit no-result responses.
- Issue #2 frontend tests added for selectable search results and unresolved-query messaging with visible selected-location state.
- Verification run after implementation: `pytest -q backend/tests`, `npm test -- --run`, and `npm run build` all pass.
- Issue #3 backend tests added for runtime feature contract stability and vector validation behavior (accept valid vectors; reject missing, extra, and wrong-unit inputs).
- Verification run for issue #3 scope: `pytest -q backend/tests/test_runtime_feature_contract.py backend/tests/test_status_api.py` passed.
- Issue #4 backend weather integration tests added for forecast-window mapping (`now`, `24h`, `48h`, `72h`), canonical runtime feature unit outputs, prediction-input vs display-signal split, and degraded behavior for missing key, failed calls, and unusable responses.
- Issue #4 backend implementation added `POST /api/weather/windows` and an OpenWeather weather service module that fetches current + forecast weather, maps requested windows to nearest forecast timestamps, normalizes canonical prediction inputs, emits display-only weather signals, and returns explicit degraded source labels when live weather is unavailable.
- Verification run for issue #4 scope: `pytest -q backend/tests` passed.
- Issue #5 model tests added for loading `ml/artifacts/model.joblib` through the backend `PredictionService`, stable runtime prediction output shape, and exclusion of Training-Only Feature categories from the deployed schema.
- Issue #5 training implementation added `ml/training/train_runtime_model.py`, which trains deterministic candidate models on the runtime feature schema, packages the selected scikit-learn artifact, and writes model evidence to `ml/metrics/runtime_model_evidence.json`.
- Issue #5 status implementation exposes model evidence in `GET /api/status`, including selected algorithm, candidate metrics, validation metrics, confusion matrix, threshold evidence inputs, dataset role, feature/unit schema, Training-Only Feature categories, and Transfer Limitation language.
- Verification run for issue #5 scope: `python ml\training\train_runtime_model.py` and `pytest -q backend/tests` passed.
- Issue #5 completed and closed after manual verification green light.
