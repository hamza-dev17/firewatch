# Frontend Implementation PRD — Sentinel-Inspired Dashboard Rebuild

Status: **draft — pending user approval**

## Problem Statement

The FIREWATCH DSS frontend is currently a 795-line monolithic `App.tsx` file described in project documentation as a "working backend integration rig, not the final product interface." All feature directories (`components/`, `features/`, `pages/`, `api/`, `lib/`, `styles/`) contain only `.gitkeep` placeholders. The interface uses a generic dashboard layout that does not match the approved design direction.

A design exploration through `prototype.html` has settled the visual direction: a **Sentinel-inspired, map-first wildfire decision-support workspace** with neutral instrumentation palette, angular geometry, monospaced data typography, and an interaction model that unfolds through engagement rather than presenting everything at once.

The backend APIs are complete and working (`/api/status`, `/api/locations/search`, `/api/assessments`, `/api/weather/windows`, `/api/history`, `/api/monitoring/overview`, `/api/alerts/active`). The frontend needs to be decomposed into proper modules that consume these contracts through the approved visual language.

## Solution

Rebuild the frontend into a modular React + TypeScript component architecture that implements the Sentinel-inspired design validated in `prototype.html`. The rebuild:

- Decomposes `App.tsx` into focused, testable components organized by feature area
- Implements the approved layout: full-screen Mapbox map canvas, floating search on map, left info panel for selected location summary, right Decision Support Panel for full assessment, right rail for ambient monitoring context, bottom status bar, profile dropdown, settings drawer
- Ports the prototype's design tokens (CSS custom properties) into a structured design system
- Preserves all existing backend contracts — the frontend displays backend-owned decisions, it does not compute them
- Maintains strict Data Source Label visibility on all data surfaces
- Keeps the existing custom hooks (`useAssessment`, `useLocationSearch`, `useDashboardStatus`, `useThemeMode`) as a foundation, refactored into the new module structure

## User Stories

1. As a Forest Officer, I want the map to be the primary workspace filling my entire screen, so that I can see spatial risk context at a glance without navigating away from geographic context.
2. As a Forest Officer, I want to search for a Turkish location by name or coordinates in a floating search bar on the map, so that I can quickly find and assess any location without losing map context.
3. As a Forest Officer, I want to click a map marker and see a compact left info panel with the location's Risk Score, Risk Level, Risk Trend, key Weather Signals (temperature, wind, humidity), and condition summary, so that I can triage whether to open the full assessment.
4. As a Forest Officer, I want to click "View Full Assessment" in the left panel to open the full Decision Support Panel on the right, so that the interface unfolds detail progressively rather than overwhelming me with all data at once.
5. As a Forest Officer, I want the Decision Support Panel to show Risk Score, Risk Level, Model Confidence, Risk Trend, Forecast Window strip (NOW/24H/48H/72H), Weather Signals (distinguishing Prediction Inputs from display-only signals), Recommended Action, Monitoring Radius, and Operational Briefing Text, so that I have complete decision support in one scrollable surface.
6. As a Forest Officer, I want each data element in the Decision Support Panel to display its Data Source Label (Live, Demo, Estimated, Cached, Unavailable, Fallback), so that I always know the provenance of the information I'm acting on.
7. As a Forest Officer, I want collapsible sections in the Decision Support Panel (Weather Signals, Model & Dataset) so that I can control information density based on my needs.
8. As a Forest Officer, I want a right rail showing Risk Overview (count of regions by Risk Level), Active Risk Alerts with timestamps, Map Layer toggles, and System status badges when no location is selected, so that I have ambient operational context on the default screen.
9. As a Forest Officer, I want Active Risk Alerts to be clearly labeled as system-generated risk alerts and not confused with confirmed fires or official emergency alerts.
10. As a Forest Officer, I want a bottom status bar showing prototype label, active alert count, model health, last data refresh time, selected city name, and live clock, so that system health is always visible without taking up panel space.
11. As a Forest Officer, I want the top bar to show the FIREWATCH brand with a custom flame icon, live status indicator, settings button, and my profile avatar, so that the interface feels professional and identified.
12. As a Forest Officer, I want to click my profile avatar and see a dropdown with my name, role, assigned region, station, session status, and a sign-out button, so that my identity context is always accessible.
13. As a Forest Officer, I want a settings drawer showing display preferences (theme, map style), model configuration (selected model, feature schema, threshold version), dataset information (training data source with Transfer Limitation explanation), and integration status (Weather API Source, Groq, ML Backend, Mapbox connectivity), so that I can understand the system's configuration.
14. As a Forest Officer, I want map markers styled as rotated diamonds color-coded by Risk Level with scan animations, so that I can visually identify risk severity across the map.
15. As a Forest Officer, I want a crosshair reticle and diamond-shaped Monitoring Radius ring to appear on the selected location, and unselected markers to dim, so that my visual focus is directed to the location under inspection.
16. As a Forest Officer, I want the map to use Mapbox GL JS with satellite-style imagery centered on Türkiye, so that the geographic context is operationally grounded.
17. As a Forest Officer, I want keyboard navigation in the search dropdown (arrow keys to move, Enter to select, Escape to close) and Escape key cascade across all panels (profile → settings → DSS → left panel), so that the interface is efficient to operate.
18. As a Forest Officer, I want light and dark themes with the dark theme as default, so that the interface is comfortable for extended monitoring sessions.
19. As a Disaster Management Official, I want a national monitoring overview with clearly labeled Demo Monitoring Data showing Predicted Risk Hotspots and regional summaries, so that I can see a national picture while understanding the data is simulated.
20. As a Disaster Management Official, I want a Prediction History screen showing grouped Prediction History Records with filters by region, date range, and Risk Level, so that I can review past assessments.
21. As a Forest Officer, I want the Model and Data Status screen to show model evidence, runtime feature schema, validation metrics, threshold version, and Transfer Limitation, so that I can assess the trustworthiness of the system's outputs.
22. As a Forest Officer, I want Demo Role Selection (Forest Officer vs Disaster Management Official) without real authentication, so that different user perspectives can be demonstrated.
23. As a Forest Officer, I want all national overview Demo Monitoring Data to be visually distinct from live assessment data, so that I never mistake simulated data for real-time observations.
24. As a Forest Officer, I want the system to display Degraded Data Status when the Weather API Source or other integrations fail, and block unlabeled live assessments when weather data is unavailable, so that I'm never presented with stale data labeled as live.
25. As a Forest Officer, I want the Operational Briefing Text to read as an assessment briefing (not a chatbot), sourced from structured Assessment Payload facts only, with the narrative source label visible, so that I can trust it reflects the system's actual assessment.

## Implementation Decisions

### Design Direction — Settled

The prototype exploration compared Apple-Inspired vs Sentinel-Inspired directions. The **Sentinel-Inspired Neutral Instrumentation** direction was selected:

- Dark-first theme with neutral silver/slate accent (`#8899aa`)
- Risk colors (`low`/`medium`/`high`/`critical`) appear ONLY where they communicate risk state
- JetBrains Mono for data values, coordinates, scores, badges; Inter for UI labels and body text
- Angular geometry (3–5px border radius), rotated diamond markers
- Panels use backdrop-filter blur with semi-transparent backgrounds
- Scan-line and grid overlays on the map canvas for satellite-console texture

### Design System Tokens

The prototype established these CSS custom properties as the design system foundation:

```css
/* Backgrounds */
--bg-deep: #0a0d11;
--bg-panel: rgba(12, 16, 21, 0.94);
--bg-panel-solid: #0d1117;
--bg-elevated: rgba(16, 21, 28, 0.96);
--bg-cell: rgba(255,255,255,0.02);

/* Text hierarchy */
--text-primary: rgba(225, 232, 240, 0.95);
--text-secondary: rgba(165, 180, 195, 0.72);
--text-tertiary: rgba(120, 140, 158, 0.5);
--text-data: rgba(200, 215, 230, 0.85);

/* Borders */
--border-base: rgba(140, 160, 180, 0.08);
--border-active: rgba(140, 160, 180, 0.18);
--border-focus: rgba(180, 195, 210, 0.35);

/* Risk semantic colors */
--risk-low: #3ecf8e;
--risk-medium: #e2b340;
--risk-high: #e8723a;
--risk-critical: #e5484d;

/* Accent (neutral instrumentation) */
--accent: #8899aa;
--accent-bright: #a0b4c8;

/* Typography */
--font-ui: 'Inter', sans-serif;
--font-data: 'JetBrains Mono', monospace;

/* Motion */
--transition-fast: 0.15s ease;
--transition-panel: 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
```

### Layout Architecture — Settled

The prototype validated this layout (NOT a sidebar dashboard):

- **Full-screen Mapbox canvas** as the base layer
- **Top bar** (40px): brand logo, spacer, live indicator, settings, profile avatar
- **Floating search** (centered on map, below topbar): search input with dropdown
- **Left info panel** (280px, slides from left): appears on location selection — shows Risk Score, Risk Level, weather summary, condition, "View Full Assessment" button
- **Right rail** (210px, fixed): ambient monitoring context — risk overview, active alerts, layer toggles, system status — hides when DSS panel opens
- **Right Decision Support Panel** (360px, slides from right): full assessment detail — risk hero, forecast strip, weather grid, forecast summary, recommended action, monitoring radius, briefing, collapsible signals, model info, and bounded **"Ask about this assessment"** support scoped to the selected Wildfire Risk Assessment and Forecast Window
- **Bottom status bar** (28px): prototype label, alert count, model status, refresh time, selected city, clock
- **Settings drawer** (340px, slides from right with overlay)
- **Profile dropdown** (260px, anchored to avatar)

### Module Decomposition

The monolithic `App.tsx` will be decomposed into these deep modules:

**1. Design System Module** (`frontend/src/styles/`)
- `tokens.css` — all CSS custom properties from the prototype
- `typography.css` — font declarations, text utility classes
- `components.css` — reusable component patterns (cards, badges, buttons, toggles, rows)
- `animations.css` — keyframes (marker-scan, live-blink), transitions

**2. Layout Shell** (`frontend/src/app/`)
- `AppShell.tsx` — top-level layout orchestrator, panel state management
- `TopBar.tsx` — brand, live indicator, settings button, profile avatar
- `BottomBar.tsx` — status bar with alert count, model health, clock
- `MapCanvas.tsx` — Mapbox GL JS container, marker management

**3. Search Feature** (`frontend/src/features/search/`)
- `MapSearch.tsx` — floating search input with dropdown
- `SearchDropdown.tsx` — filterable location list with keyboard navigation
- Reuses existing `useLocationSearch` hook

**4. Location Info Panel** (`frontend/src/features/location-info/`)
- `LocationInfoPanel.tsx` — left panel with risk banner, weather summary, condition, "View Full Assessment" button
- `RiskBanner.tsx` — risk score ring, risk badge, trend, confidence

**5. Decision Support Panel** (`frontend/src/features/decision-support/`)
- `DecisionSupportPanel.tsx` — scrollable container with header and sections
- `RiskHero.tsx` — score ring, level badge, trend arrow, confidence
- `ForecastStrip.tsx` — NOW/24H/48H/72H window selector with risk text
- `WeatherGrid.tsx` — 2×2 weather observation cells
- `ActionBox.tsx` — recommended action with risk-colored border
- `MonitoringRadius.tsx` — radius indicator with diamond icon
- `BriefingBlock.tsx` — narrative text with source label
- `CollapsibleSection.tsx` — reusable collapsible with chevron toggle
- Reuses existing `useAssessment` hook

**6. Monitoring Rail** (`frontend/src/features/monitoring-rail/`)
- `MonitoringRail.tsx` — right rail container
- `RiskOverview.tsx` — region counts by risk level
- `ActiveAlerts.tsx` — alert rows with timestamps
- `LayerToggles.tsx` — prediction input vs context layer switches
- `SystemStatus.tsx` — integration status badges

**7. Map Feature** (`frontend/src/features/map/`)
- `MapMarkers.tsx` — diamond markers with risk colors, scan animations
- `MapOverlays.tsx` — crosshair reticle, monitoring rings
- `mapStyles.ts` — Mapbox style configuration

**8. Profile & Settings** (`frontend/src/features/settings/`)
- `ProfileDropdown.tsx` — avatar-anchored dropdown with user info
- `SettingsDrawer.tsx` — drawer with display, model, dataset, integrations sections

**9. Shared UI Components** (`frontend/src/components/`)
- `DataSourceTag.tsx` — compact source label badge (Live, Demo, etc.)
- `RiskDot.tsx` — small diamond indicator
- `Toggle.tsx` — on/off switch
- `CloseButton.tsx` — consistent close control

**10. API Layer** (`frontend/src/api/`)
- `client.ts` — base fetch/axios wrapper with error handling
- `assessments.ts` — POST /api/assessments
- `locations.ts` — GET /api/locations/search
- `status.ts` — GET /api/status
- `history.ts` — GET /api/history
- `alerts.ts` — GET /api/alerts/active
- `monitoring.ts` — GET /api/monitoring/overview

**11. Types** (`frontend/src/types/`)
- Migrate from `dashboard/types.ts` — same interfaces, better organized

### API Contracts — Unchanged

The frontend consumes existing backend APIs without modification:

| Endpoint | Method | Frontend Usage |
|---|---|---|
| `GET /api/status` | GET | System status, model evidence, feature contract |
| `GET /api/locations/search?q=` | GET | Search dropdown results |
| `POST /api/assessments` | POST | On-Demand Assessment creation |
| `GET /api/history` | GET | Prediction History screen |
| `GET /api/monitoring/overview` | GET | National overview (demo) |
| `GET /api/alerts/active` | GET | Active alerts in rail and bottom bar |

### Interaction State Machine

The prototype validated this state flow:

```
DEFAULT (map + right rail visible)
  │
  ├─ [search/click marker] → LOCATION_SELECTED
  │     (left panel opens, right rail hides, map pans/zooms,
  │      markers dim, crosshair + rings appear)
  │     │
  │     ├─ [click "View Full Assessment"] → DSS_OPEN
  │     │     (DSS panel slides in from right)
  │     │     │
  │     │     └─ [close DSS / Escape] → LOCATION_SELECTED
  │     │
  │     └─ [close left panel / Escape] → DEFAULT
  │           (map resets, markers undim, rail returns)
  │
  ├─ [settings button] → SETTINGS_OPEN (overlay + drawer)
  │     └─ [close / Escape / overlay click] → previous state
  │
  └─ [profile avatar] → PROFILE_OPEN (dropdown)
        └─ [close / Escape / outside click] → previous state
```

### Data Honesty Rules — Enforced in UI

1. Every data surface must display a Data Source Label
2. Demo Monitoring Data must be clearly labeled — never implies live national coverage
3. Demo overview hotspots must NOT create Active Risk Alerts
4. Degraded Data Status must be visible when integrations fail
5. Model Confidence must be distinguished from real-world fire probability
6. Risk assessment described as "Prototype Relative Wildfire Risk"
7. Groq narratives sourced from structured Assessment Payload facts only
8. Recommendations are advisory — do not replace official emergency protocols
9. Prediction History Records are not confirmed wildfire incident records
10. Transfer Limitation (Morocco proxy dataset) must be explained in settings and model info

### Mapbox Integration

- Mapbox GL JS for 2D satellite-style map centered on Türkiye
- Access token from environment variable (`VITE_MAPBOX_ACCESS_TOKEN`)
- Primary search uses Curated Turkish Location Index; Mapbox geocoding is optional supplement
- Custom marker rendering (rotated diamonds, not default pins)
- Crosshair and monitoring ring overlays as DOM elements positioned by map coordinates

## Testing Decisions

### What Makes a Good Test

Tests should verify external behavior from the user's perspective, not implementation details. A good test answers: "If a user does X, does the interface show Y?" Tests should not assert internal state, CSS classes, or hook return values in isolation.

### Modules to Test

1. **Search feature** — typing produces filtered results, keyboard navigation works, selecting a result triggers location selection
2. **Location info panel** — opens on selection, shows correct Risk Level/Score/weather, "View Full Assessment" button opens DSS
3. **Decision Support Panel** — displays all assessment fields from API response, collapsible sections toggle, Data Source Labels visible
4. **Monitoring rail** — shows risk counts, alert rows, layer toggles work
5. **Profile dropdown** — opens on click, shows user info, closes on outside click/Escape
6. **Panel state transitions** — DEFAULT → LOCATION_SELECTED → DSS_OPEN cascade and cleanup
7. **Data honesty** — source labels render for every data surface, demo data is visually distinct

### Prior Art

The existing `App.test.tsx` (44 KB) contains comprehensive integration tests using Vitest + Testing Library. These tests mock API responses and assert rendered output. The same pattern should be continued for the decomposed components, with test files co-located in feature directories.

## Out of Scope

- SHAP model explanations (phase two)
- Reviewed Outcome Entries and Prediction Outcome Comparisons (phase two)
- Model Tuning Datasets (phase two)
- Operational layers: response stations, water sources, vegetation dryness, historical fire areas (phase two)
- Response-station routing (phase two)
- Real authentication, authorization, RBAC (phase two)
- PostgreSQL migration (phase two)
- 3D globe mode (phase two)
- Active fire detection, satellite imagery, drone monitoring (phase two)
- Fire-spread simulation, burn-area prediction, evacuation-radius prediction (phase two)
- Backend API changes — frontend consumes existing contracts
- Mobile-native applications
- Offline mode

## Further Notes

- The `prototype.html` file is a throwaway design artifact — it validates visual direction and interaction patterns but should NOT be promoted as production code. Components should be rebuilt from scratch in React using the prototype as a visual reference.
- The existing `dashboard/types.ts` TypeScript interfaces match backend API contracts and should be migrated directly into the new `types/` module.
- The existing hooks (`useAssessment`, `useLocationSearch`, `useDashboardStatus`, `useThemeMode`) are well-structured and can be refactored into feature-specific locations.
- The prototype uses km/h for wind display but the backend serves m/s (`wind_speed_mps`). The frontend must convert using `dashboard/formatters.ts` or new formatting utilities.
- Light theme tokens are not yet defined in the prototype — they will need to be created as a complementary palette during implementation.
- Responsive breakpoints at 1100px and 900px adjust panel widths (validated in prototype CSS).
