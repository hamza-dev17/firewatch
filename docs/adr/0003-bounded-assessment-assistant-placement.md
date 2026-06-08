# ADR-0003: Bounded Assessment Assistant Placement

**Status**: Accepted
**Date**: 2026-06-08
**Decision Makers**: Project owner (HITL review before implementation)

## Context

FIREWATCH DSS includes an **LLM Advisory Layer** that can generate or explain **Narrative Explanations** from an approved **Assessment Payload**. The dashboard also contains high-priority operational surfaces: the **Mapbox Map Workspace**, selected-location panels, **Active Risk Alerts**, data source status, and the right **Decision Support Panel**.

The assistant interaction must preserve the map-first workspace and avoid implying that FIREWATCH DSS has an unrestricted chatbot, an independent risk model, or an operational command agent. It should help a **Forest Officer** or **Disaster Management Official** understand one selected **Wildfire Risk Assessment** and one selected **Forecast Window**.

## Decision

The assistant will be implemented as a bounded assessment support surface inside the right **Decision Support Panel**, labeled **"Ask about this assessment"**.

The assistant is contextual to:

- the selected **Location Search Result**
- the selected **Forecast Window**
- the single **Wildfire Risk Assessment** shown in the panel
- the approved **Assessment Payload** for that assessment

The assistant must not appear as a global floating chatbot bubble, global launcher, or map-overlay conversation widget.

## Desktop Behavior

On desktop, the assistant sits at the bottom of the right **Decision Support Panel** after the operational assessment content: risk hero, forecast strip, weather signals, recommended action, monitoring radius, briefing, and model or data sections.

The default state is compact: a labeled prompt row or collapsed section titled **"Ask about this assessment"**. Expanding it opens an inline panel inside the existing right panel. The expansion must stay within the panel's scrollable surface and must not cover:

- the **Mapbox Map Workspace**
- map markers or monitoring rings
- **Active Risk Alerts**
- top status controls
- bottom status bar content
- settings or profile controls

The assistant answer area should make the selected **Forecast Window** visible near the prompt, so users understand which assessment they are asking about. Switching the forecast strip changes the assistant context and clears or clearly separates prior responses from another **Forecast Window**.

## Mobile Behavior

On mobile, the assistant remains attached to the selected **Wildfire Risk Assessment** rather than becoming a floating chat launcher.

When the **Decision Support Panel** is already presented as a constrained mobile panel or bottom sheet, **"Ask about this assessment"** opens as a nested constrained bottom sheet or equivalent panel above the assessment content. It should use a clear header, preserve an obvious close action, and avoid overlapping cramped controls. The mobile assistant surface must not cover persistent alert or status controls in a way that prevents dismissal or assessment review.

If vertical space is limited, the assistant opens in a single-purpose sheet with the selected location and **Forecast Window** summarized in the header, then returns to the assessment panel when closed.

## Labeling and Copy Rules

Preferred UI label:

- **Ask about this assessment**

Acceptable compact label where space is constrained:

- **Assessment assistant**

Avoid labels that imply an unrestricted chatbot or independent decision maker:

- Chat
- AI chatbot
- Ask anything
- Fire command assistant
- Dispatch assistant

Assistant responses must use **Operational Briefing Text**: concise, factual, non-alarmist, and grounded in the visible **Wildfire Risk Assessment**. The assistant may explain weather signals, model limitations, data source labels, and the approved **Recommended Action**. It must not change the **Risk Score**, **Risk Level**, **Risk Alert**, **Recommended Action**, or **Monitoring Radius**.

## Consequences

- The assistant is part of the **Decision Support Panel**, not a global application affordance.
- Future implementation should treat the selected **Forecast Window** as required assistant context.
- Conversation or response history is scoped to one selected **Wildfire Risk Assessment** and **Forecast Window** unless the UI explicitly separates prior context.
- The map-first operational workspace remains primary; assistant expansion is secondary explanation support.
- The assistant pattern preserves the ADR-0002 decision to avoid chat-first AI UI.
