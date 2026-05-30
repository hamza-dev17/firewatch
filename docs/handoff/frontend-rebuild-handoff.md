# Frontend Rebuild Handoff

Status: **ready for implementation**

This document summarizes the decisions and documents needed to rebuild the FIREWATCH DSS frontend from the current monolithic `App.tsx` into a modular, Sentinel-inspired dashboard.

## What Happened

1. A design prototype exploration (`prototype.html`) was conducted to validate the visual direction before touching production code
2. Four iterations were produced: Apple-inspired (rejected) → Sentinel-inspired (accepted) → neutral palette refinement → layout restructure (left panel, search on map)
3. The prototype settled the visual taste, layout structure, interaction model, and design tokens
4. These decisions are now documented and ready for implementation

## Documents Updated / Created

| Document | Status | Purpose |
|---|---|---|
| [Frontend Implementation PRD](../prd/frontend-implementation-prd.md) | **NEW** | Full rebuild plan: user stories, modules, API contracts, testing, interaction state machine |
| [ADR-0002](../adr/0002-sentinel-inspired-frontend-direction.md) | **NEW** | Decision record: why Sentinel-inspired over Apple-inspired |
| [Phase Two Frontend Direction](../ui/phase-two-frontend-direction.md) | **UPDATED** | Now reflects the selected direction with validated layout and visual grammar |
| [CONTEXT.md](../../CONTEXT.md) | **UPDATED** | "Apple-Inspired Operational Interface" → "Sentinel-Inspired Operational Interface" throughout |
| [Dashboard UI Spec](../ui/firewatch-dashboard.md) | **UPDATED** | Superseded warning added; data honesty rules and MVP scope still valid |

## Visual Reference

`prototype.html` (root directory) — open in browser to see the validated design:

- Click markers to see left info panel
- Click "View Full Assessment" for the full DSS panel
- Click the avatar for the profile dropdown
- Click ⚙ for the settings drawer
- Type in the search bar for filtered results with keyboard nav
- Press Escape to cascade-close panels

**Do NOT promote prototype code to production.** Rebuild from scratch in React using the prototype as visual reference.

## What To Build (Module Summary)

1. **Design system** — CSS tokens, typography, animations from prototype
2. **App shell** — TopBar, BottomBar, MapCanvas, panel state orchestration
3. **Search** — floating on map, keyboard-navigable dropdown
4. **Location info panel** — left slide-in with risk summary + "View Full Assessment"
5. **Decision Support Panel** — right slide-in with full assessment
6. **Monitoring rail** — right side ambient context (risk overview, alerts, layers, system)
7. **Map markers** — diamond markers, crosshair, monitoring rings
8. **Profile & settings** — dropdown + drawer
9. **Shared components** — DataSourceTag, RiskDot, Toggle, CloseButton
10. **API layer** — typed fetch wrappers for all backend endpoints
11. **Types** — migrated from `dashboard/types.ts`

## What NOT To Touch

- Backend APIs — all contracts unchanged
- ML model and training — unchanged
- Backend services — unchanged
- `dashboard/types.ts` — migrate to `types/`, don't delete until refactor complete
- `dashboard/` hooks — refactor into feature modules, don't delete until new hooks work

## Key Risks

1. **Light theme tokens** are not yet defined — the prototype is dark-only. Light theme must be designed during implementation.
2. **Wind unit mismatch** — prototype shows km/h, backend serves m/s. Formatters must convert.
3. **Monitoring radius values** — prototype uses different values (10/15/25/35 km) than the original dashboard spec (5/10/20/30 km). The backend-owned Recommendation Rule Table is authoritative.
4. **Existing tests** — `App.test.tsx` (44 KB) tests the monolithic app. Tests will need to be decomposed along with the components.
