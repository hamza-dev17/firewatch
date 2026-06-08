# Phase Two Frontend Direction

Status: **direction selected — Sentinel-Inspired Operational Interface**

Phase two treats the current frontend as a working backend integration rig, not the final product interface. The next frontend is a map-first wildfire decision-support workspace that uses the existing backend contracts, Mapbox, Groq narrative support, history, alerts, and source-label semantics with a Sentinel-inspired operational presentation.

## Product stance

FIREWATCH DSS should feel like a modern wildfire risk operations tool for Turkish forest monitoring. The map is the application, not a widget inside a generic dashboard.

The interface should answer these questions quickly:

- Where should attention go first?
- What weather-driven signals explain the risk?
- What forecast window is changing?
- What action does the rule table recommend?
- Is the information live, demo, cached, estimated, unavailable, or fallback?

## Selected direction: Sentinel-Inspired Operational Interface

After prototype exploration (four iterations of `prototype.html`), the **Sentinel-Inspired** direction was selected with a **neutral instrumentation palette**. See [ADR-0002](../adr/0002-sentinel-inspired-frontend-direction.md) for the full decision record.

### Visual grammar

- Angular geometry: 3–5px border radius, rotated diamond markers
- Neutral silver/slate accent (`#8899aa`) — no color personality competing with risk colors
- Risk colors appear ONLY where they communicate risk state (markers, badges, borders)
- JetBrains Mono for data values, coordinates, scores, badges
- Inter for UI labels and body text
- Semi-transparent panels with backdrop-filter blur
- Dark-first theme with subtle scan-line and grid overlays on map canvas
- Custom SVG flame icon with gradient brand text (FIRE in warm gradient, WATCH in neutral white)

### Validated layout

The prototype settled this layout — NOT a sidebar dashboard:

- **Full-screen Mapbox canvas** as base layer
- **Top bar** (40px): brand logo with flame icon, live status indicator, settings, profile avatar
- **Floating search** (centered on map, below topbar): search input with keyboard-navigable dropdown
- **Left info panel** (280px, slides from left): appears on location selection — Risk Score, Risk Level, Risk Trend, weather summary (temp/wind/humidity), condition, "View Full Assessment →" button
- **Right rail** (210px, fixed right): ambient context — risk overview, active alerts with timestamps, layer toggles (Prediction Inputs vs Context Layers), system status badges
- **Right Decision Support Panel** (360px, slides from right, replaces rail): full assessment — risk hero, forecast strip (NOW/24H/48H/72H with risk text), weather grid, forecast summary, recommended action, monitoring radius, briefing, collapsible weather signals and model info, and bounded **"Ask about this assessment"** support inside the panel
- **Bottom status bar** (28px): prototype label, alert count, model health, refresh time, selected city, live clock
- **Settings drawer** (340px, slides from right with overlay): display, model, dataset, integrations, profile sections
- **Profile dropdown** (260px, anchored to avatar): name, email, role, region, station, session, sign-out

### Interaction model

The interface unfolds through interaction:

1. **Default**: map canvas + right rail visible — compact ambient monitoring
2. **Location selected** (search or marker click): left info panel slides in, right rail hides, map pans/zooms, markers dim, crosshair + monitoring rings appear
3. **Full assessment**: "View Full Assessment" button opens DSS panel on right
4. **Close**: Escape cascades: profile → settings → DSS → left panel → default

### What this replaces

- The Apple-Inspired shell (Issue #20) will be superseded
- The `firewatch-dashboard.md` layout spec (left sidebar, right sidebar, bottom strip) is superseded by this layout
- The phase-two prototype variants (A/B/C in `prototypes/phaseTwoFrontend/`) are superseded by `prototype.html`

## Rebuild guardrails

- Keep backend decision ownership unchanged: the frontend displays Risk Levels, Recommended Actions, Priority Rank, and Monitoring Radius; it does not compute them.
- Keep Prediction History Records as prediction records, not incident history.
- Keep Active Risk Alerts as system-generated risk alerts, not confirmed fires or official emergency alerts.
- Keep phase-two Reviewed Outcome Entries separate from Prediction History and map visualization.
- Keep Groq as narrative support over structured assessment facts.
- Preserve visible Data Source Labels on major data elements.
- Keep the assistant bounded to one selected **Wildfire Risk Assessment** and **Forecast Window** inside the right Decision Support Panel; see [ADR-0003](../adr/0003-bounded-assessment-assistant-placement.md).

## Implementation reference

- Full PRD: [frontend-implementation-prd.md](../prd/frontend-implementation-prd.md)
- Design decision: [ADR-0002](../adr/0002-sentinel-inspired-frontend-direction.md)
- Assistant placement decision: [ADR-0003](../adr/0003-bounded-assessment-assistant-placement.md)
- Visual reference: `prototype.html` (root directory — throwaway, do not promote to production)
