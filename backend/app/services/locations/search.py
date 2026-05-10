"""Location search for curated Turkish places and coordinate text."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.config import REPO_ROOT


@dataclass(frozen=True)
class LocationSearchResult:
    display_name: str
    latitude: float
    longitude: float
    admin: dict[str, str]
    source_label: str


def _curated_index_path() -> Path:
    return REPO_ROOT / "data" / "location-index" / "turkiye_locations.json"


@lru_cache(maxsize=1)
def _load_curated_locations() -> list[dict[str, object]]:
    index_path = _curated_index_path()
    if not index_path.exists():
        return []

    with index_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _parse_coordinates(query: str) -> LocationSearchResult | None:
    coordinate_pattern = re.compile(
        r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$"
    )
    match = coordinate_pattern.match(query)
    if match is None:
        return None

    latitude = float(match.group(1))
    longitude = float(match.group(2))
    if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180:
        return None

    return LocationSearchResult(
        display_name=f"{latitude:.4f}, {longitude:.4f}",
        latitude=latitude,
        longitude=longitude,
        admin={"province": "", "district": "", "country": "Turkiye"},
        source_label="direct-coordinates",
    )


def _build_display_name(row: dict[str, object]) -> str:
    city = str(row.get("city", "")).strip()
    province = str(row.get("province", "")).strip()

    if city and province:
        if city.lower() == province.lower():
            return f"{city}, Turkiye"
        return f"{city}, {province}, Turkiye"
    if city:
        return f"{city}, Turkiye"
    if province:
        return f"{province}, Turkiye"
    return str(row.get("display_name", "Unknown location"))


def search_locations(query: str) -> list[LocationSearchResult]:
    query_value = query.strip().lower()
    if not query_value:
        return []

    coordinate_match = _parse_coordinates(query)
    if coordinate_match is not None:
        return [coordinate_match]

    matches: list[LocationSearchResult] = []
    for row in _load_curated_locations():
        city = str(row.get("city", "")).strip()
        province = str(row.get("province", "")).strip()
        district = str(row.get("district", "")).strip()
        display_name = _build_display_name(row)
        search_blob = " ".join(
            [
                display_name,
                city,
                province,
                district,
            ]
        ).lower()
        if query_value not in search_blob:
            continue

        matches.append(
            LocationSearchResult(
                display_name=display_name,
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                admin={
                    "province": province,
                    "district": district,
                    "country": "Turkiye",
                },
                source_label="curated-index",
            )
        )

    return matches
