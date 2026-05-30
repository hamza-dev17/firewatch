# Reviewed Outcome Entry foundations

Status: approved phase-two foundation policy; implementation not started

This document defines the source, review, matching, and evaluation rules that must exist before FIREWATCH DSS implements **Reviewed Outcome Entries** or **Prediction Outcome Comparisons**.

## Decision summary

- **Reviewed Outcome Entries** are separate reviewed records of later observed wildfire outcomes. They are not generated from **Prediction History Records**, **Risk Alerts**, map markers, or **Predicted Risk Hotspots**.
- The approved source strategy is to accept only official or reviewer-confirmed outcome evidence. Demo data may be used for UI development only when clearly labeled as demo and excluded from evaluation.
- The **Outcome Matching Window** uses explicit temporal and spatial rules that are independent of the predicted **Risk Level**.
- **Prediction Outcome Comparisons** are offline evaluation inputs. They must not trigger live model self-learning, automatic threshold updates, or operational accuracy claims.
- Existing **Prediction History Record** semantics remain unchanged: history records store what FIREWATCH DSS predicted from selected-location assessment inputs, not what later happened.

## Outcome source strategy

FIREWATCH DSS may create a **Reviewed Outcome Entry** only from one of these approved source paths:

| Source path | Accepted use | Required evidence |
| --- | --- | --- |
| Trusted incident source import | Preferred for later evaluation when a reliable agency, municipal, academic, or official incident source is available. | Source name, source record identifier or citation, reported location, reported time, source retrieval date, and source confidence or precision when provided. |
| Authorized manual review | Acceptable when a project reviewer enters an outcome from a cited report, field log, or official communication. | Reviewer identifier, review timestamp, source citation, reviewer note, reported location, reported time, and review status. |
| Demo reviewed outcomes | Acceptable only for UI and API development fixtures. | Demo label, synthetic source note, and exclusion from evaluation and tuning exports. |

The following are not accepted outcome sources:

- **Weather API Source** values.
- Map visualization, heat color, **Predicted Risk Hotspots**, or **Monitoring Radius** overlays.
- **Risk Alerts** or **Active Risk Alerts** created by FIREWATCH DSS.
- Unverified social posts, news snippets, screenshots, or hearsay.
- Any source that lacks enough time and location precision to satisfy the matching rules below.

## Review workflow expectations

A **Reviewed Outcome Entry** must have an explicit review status:

- `draft`: captured but not eligible for matching or evaluation.
- `approved`: reviewed evidence is sufficient for matching.
- `rejected`: evidence is insufficient, duplicate, outside project scope, or not a wildfire occurrence.
- `needs_more_evidence`: retained for follow-up but excluded from comparisons.

Only `approved` entries can participate in **Prediction Outcome Comparisons**. A reviewer may record a negative outcome only when the source strategy supports the absence claim for the relevant area and time window; otherwise the system should treat "no matching approved outcome" as unknown, not proof that no wildfire occurred.

## Outcome Matching Window

The matching policy compares each **Reviewed Outcome Entry** to a single **Assessment Window Result** inside a **Prediction History Record**.

### Temporal rules

The temporal window is calculated from the **Prediction History Record** assessment timestamp and the **Forecast Window** offset.

| Forecast Window | Matching interval |
| --- | --- |
| `now` | Assessment timestamp through assessment timestamp plus 6 hours. |
| `24h` | Assessment timestamp plus 18 hours through plus 30 hours. |
| `48h` | Assessment timestamp plus 42 hours through plus 54 hours. |
| `72h` | Assessment timestamp plus 66 hours through plus 78 hours. |

Additional temporal rules:

- Use the observed ignition time when available. Otherwise use the first reliable report time and mark the comparison with lower temporal precision.
- Date-only outcome reports may be stored, but they are not eligible for tuning exports unless a reviewer approves the expanded day-level uncertainty for a specific evaluation.
- Outcomes reported before the assessment timestamp cannot validate that assessment.
- When an outcome spans multiple forecast intervals, link it to the earliest eligible interval unless a reviewer explicitly records a different rationale.

### Spatial rules

The spatial window is calculated from the selected location stored on the **Prediction History Record**, not from the predicted **Monitoring Radius**.

- Primary match: the outcome point, incident centroid, or fire perimeter intersects a 10 km radius around the assessed location.
- Spatial precision requirement: the outcome must have coordinate precision or reviewer-estimated location uncertainty of 5 km or better.
- Boundary case: an approved outcome between 10 km and 20 km may be marked `nearby_review`, but it is not a primary match and is excluded from tuning exports unless a reviewer documents the exception.
- Administrative-only reports may be stored as reviewed outcomes, but they are not comparison-eligible until geocoded or reviewed to meet the precision requirement.
- If multiple approved outcomes satisfy the same window, choose the closest spatial match. If distance ties, choose the earliest observed time. Additional matches may be linked as secondary context, not duplicate proof of accuracy.

### Match result labels

Each **Prediction Outcome Comparison** must record one explicit result:

- `matched`: temporal and spatial rules both pass.
- `nearby_review`: the outcome is near the assessed location but outside the primary spatial window.
- `outside_window`: evidence exists but fails temporal or spatial rules.
- `insufficient_precision`: evidence exists but lacks required time or location precision.
- `no_approved_outcome`: no approved reviewed outcome was available for the window; this is unknown unless a trusted source explicitly supports a negative outcome.

## Separation from predictions

Reviewed outcomes must remain separate from prediction and visualization surfaces.

- A **Prediction History Record** is immutable prediction evidence for one completed **On-Demand Assessment**.
- A **Reviewed Outcome Entry** is later observed evidence with its own source, reviewer, review status, and precision metadata.
- A map layer may display reviewed outcomes in phase two, but displaying a reviewed outcome must not rewrite or relabel the original prediction.
- **Predicted Risk Hotspots**, **Risk Alerts**, and **Monitoring Radius** overlays are never evidence that a wildfire occurred.

## Offline comparison and tuning rules

**Prediction Outcome Comparisons** may be used for:

- Offline evaluation reports.
- Threshold review.
- Candidate model analysis.
- Curated **Model Tuning Dataset** exports after reviewer approval.

They must not be used for:

- Live automatic model retraining.
- Automatic **Operational Risk Threshold** changes.
- Updating live **Risk Levels** after an outcome is entered.
- Claiming that one matched outcome proves operational accuracy across Turkiye.

Any future tuning export must include source labels, review status, matching interval, spatial distance, temporal distance, model version, threshold version, and the **Transfer Limitation** note.

## Implementation plan guardrails

When implementation begins, use a separate outcome module and persistence boundary, for example `backend/app/services/outcomes/`. The implementation should:

- Add separate storage for **Reviewed Outcome Entries** and **Prediction Outcome Comparisons**.
- Reference **Prediction History Records** by id without changing their stored prediction payloads.
- Require approved outcome source metadata before comparison.
- Store match-policy version metadata with every comparison.
- Keep outcome APIs out of MVP live assessment creation.
- Add UI wording that describes reviewed outcomes as later reviewed evidence, not incident history generated by FIREWATCH DSS.

