# ADR-0002: Sentinel-Inspired Frontend Design Direction

**Status**: Accepted  
**Date**: 2026-05-30  
**Decision Makers**: Project owner (via prototype exploration)

## Context

The phase-two frontend direction document proposed four prototype variants for the dashboard rebuild: Operational Map Cockpit, National Fire Intelligence View, AI-Assisted Field Review, and Sentinel-Inspired Fire Ops.

A prototype exploration session (`prototype.html`) was conducted to validate the visual direction before touching production code. The exploration began with an Apple-Inspired direction (rounded, glassmorphic) which was explicitly rejected by the project owner. A Sentinel-Inspired direction was then requested, implemented, and iterated through four versions.

## Decision

The frontend will use the **Sentinel-Inspired Operational Interface** design direction with a **neutral instrumentation palette**:

- **Geometry**: Angular (3–5px border radii), rotated diamond markers and indicators
- **Palette**: Neutral silver/slate accent (`#8899aa`), risk colors (`low`/`medium`/`high`/`critical`) only where they communicate risk state
- **Typography**: Inter for UI labels, JetBrains Mono for data values/coordinates/scores/badges
- **Theme**: Dark-first, with light theme as secondary
- **Surfaces**: Semi-transparent panels with backdrop-blur, angular borders
- **Map texture**: Satellite-style with subtle grid overlay, scan-line texture, SVG country outline

### Layout (validated in prototype)

- Full-screen Mapbox canvas as base layer
- Top bar: brand, live indicator, settings, profile
- Floating search: centered on map canvas
- Left info panel: slides in on location selection (compact summary + "View Full Assessment")
- Right rail: ambient monitoring context (risk overview, alerts, layers, system status)
- Right Decision Support Panel: full assessment detail (replaces rail when open)
- Bottom status bar: prototype label, alerts, model health, clock

### Avoids

- Generic card dashboards
- Marketing landing-page structure
- Heavy red/orange wildfire branding on large surfaces
- Military, intelligence, or "top secret" language
- Chat-first AI UI
- Left sidebar navigation

## Consequences

- The `CONTEXT.md` glossary term changes from "Apple-Inspired Operational Interface" to "Sentinel-Inspired Operational Interface"
- The existing `docs/ui/firewatch-dashboard.md` layout spec (left sidebar, right sidebar, bottom strip) is superseded by the prototype layout
- The `prototype.html` file is a throwaway design artifact — components must be rebuilt in React, not promoted
- Light theme tokens need to be designed as a complementary palette during implementation
- The existing frontend shell (Issue #20, Apple-inspired) will be replaced
