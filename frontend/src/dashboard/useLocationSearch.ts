import { useState, type FormEvent } from "react";

import type { LocationSearchPayload, LocationSearchResult } from "./types";

export const useLocationSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const runLocationSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchMessage("Enter a province, district, city, or coordinates.");
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        setSearchResults([]);
        setSearchMessage("Location search is unavailable.");
        return;
      }

      const payload = (await response.json()) as LocationSearchPayload;
      setSearchResults(payload.results ?? []);
      setSearchMessage(payload.message ?? null);
    } catch {
      setSearchResults([]);
      setSearchMessage("Location search is unavailable.");
    } finally {
      setIsSearching(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchMessage,
    setSearchMessage,
    isSearching,
    runLocationSearch,
  };
};
