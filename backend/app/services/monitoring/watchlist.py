"""Backend-owned MVP watch locations for regional monitoring."""

from __future__ import annotations

from dataclasses import asdict, dataclass


MAX_WATCH_LOCATIONS = 10
WATCHLIST_SOURCE_LABEL = "system-watchlist"


@dataclass(frozen=True)
class WatchLocation:
    name: str
    latitude: float
    longitude: float
    watch_reason: str

    def to_payload(self) -> dict[str, object]:
        payload = asdict(self)
        payload["data_source_label"] = WATCHLIST_SOURCE_LABEL
        return payload


WATCH_LOCATIONS: tuple[WatchLocation, ...] = (
    WatchLocation("Antalya", 36.8969, 30.7133, "Mediterranean coastal forest exposure"),
    WatchLocation("Mugla", 37.2153, 28.3636, "Aegean forest and tourism interface"),
    WatchLocation("Izmir", 38.4237, 27.1428, "Aegean urban-forest interface"),
    WatchLocation("Mersin", 36.8121, 34.6415, "Eastern Mediterranean dry-season exposure"),
    WatchLocation("Adana", 37.0000, 35.3213, "Cukurova heat and wind exposure"),
    WatchLocation("Hatay", 36.2021, 36.1600, "Eastern Mediterranean border forest exposure"),
    WatchLocation("Canakkale", 40.1553, 26.4142, "Dardanelles wind corridor exposure"),
    WatchLocation("Balikesir", 39.6484, 27.8826, "Marmara-Aegean forest transition"),
    WatchLocation("Manisa", 38.6191, 27.4289, "Aegean inland heat exposure"),
    WatchLocation("Aydin", 37.8450, 27.8396, "Aegean agricultural-forest interface"),
)


def get_watch_locations() -> list[dict[str, object]]:
    return [location.to_payload() for location in WATCH_LOCATIONS[:MAX_WATCH_LOCATIONS]]


def get_watch_region_names() -> set[str]:
    return {location.name.casefold() for location in WATCH_LOCATIONS[:MAX_WATCH_LOCATIONS]}
