"""Demo national monitoring overview payload for the MVP dashboard."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class MonitoringLocation:
    name: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class PredictedRiskHotspot:
    name: str
    latitude: float
    longitude: float
    risk_level: str
    data_source_label: str
    label: str


def build_monitoring_overview_payload() -> dict[str, object]:
    monitoring_locations = [
        MonitoringLocation(name="Ankara", latitude=39.9334, longitude=32.8597),
        MonitoringLocation(name="Izmir", latitude=38.4237, longitude=27.1428),
        MonitoringLocation(name="Mugla", latitude=37.2153, longitude=28.3636),
        MonitoringLocation(name="Antalya", latitude=36.8969, longitude=30.7133),
    ]
    predicted_risk_hotspots = [
        PredictedRiskHotspot(
            name="Mugla Forest Belt",
            latitude=37.0344,
            longitude=27.4305,
            risk_level="critical",
            data_source_label="demo",
            label="Simulated overview hotspot",
        ),
        PredictedRiskHotspot(
            name="Antalya Coastal Ridge",
            latitude=36.8841,
            longitude=30.7056,
            risk_level="high",
            data_source_label="demo",
            label="Demo overview hotspot",
        ),
    ]

    return {
        "source_state": "demo",
        "monitoring_locations": [asdict(item) for item in monitoring_locations],
        "predicted_risk_hotspots": [asdict(item) for item in predicted_risk_hotspots],
        "regional_summaries": [
            {"region": "Aegean", "risk_level": "high", "data_source_label": "demo"},
            {"region": "Mediterranean", "risk_level": "critical", "data_source_label": "demo"},
        ],
        "top_priority_regions": [
            {"region": "Mugla", "priority_rank": "P1", "data_source_label": "demo"},
            {"region": "Antalya", "priority_rank": "P2", "data_source_label": "demo"},
        ],
        "data_source_labels": {
            "overview": "demo",
            "hotspots": "demo",
            "regional_summary": "demo",
            "top_priority_regions": "demo",
        },
        "message": "Demo Monitoring Data for Turkiye national monitoring overview.",
    }
