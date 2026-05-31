import { useEffect, useState } from "react";

import type { LocationSearchResult } from "../../dashboard/types";
import { useLocationSearch } from "../../dashboard/useLocationSearch";

type MapSearchProps = {
  onSelectLocation: (location: LocationSearchResult) => void;
};

export const MapSearch = ({ onSelectLocation }: MapSearchProps) => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchMessage,
    isSearching,
    searchLocations,
  } = useLocationSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => void searchLocations(searchQuery), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setIsOpen(searchResults.length > 0);
    setActiveIndex(-1);
  }, [searchResults]);

  const selectLocation = (location: LocationSearchResult) => {
    onSelectLocation(location);
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, searchResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectLocation(searchResults[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="map-search">
      <span className="map-search-icon" aria-hidden="true">⌕</span>
      <input
        aria-label="Location search"
        autoComplete="off"
        onChange={(event) => setSearchQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search location..."
        spellCheck={false}
        type="search"
        value={searchQuery}
      />
      {isSearching ? <span className="map-search-state">Searching</span> : null}
      {isOpen ? (
        <div className="search-dropdown" role="listbox" aria-label="Location search results">
          {searchResults.map((location, index) => (
            <button
              aria-label={location.display_name}
              aria-selected={index === activeIndex}
              className={`search-item${index === activeIndex ? " highlighted" : ""}`}
              key={`${location.display_name}-${location.latitude}-${location.longitude}`}
              onClick={() => selectLocation(location)}
              role="option"
              type="button"
            >
              <strong>{location.display_name}</strong>
              <span>{location.admin.province}</span>
              <small>{location.latitude.toFixed(2)}°N</small>
            </button>
          ))}
        </div>
      ) : null}
      {searchMessage ? <p className="map-search-message">{searchMessage}</p> : null}
    </div>
  );
};
