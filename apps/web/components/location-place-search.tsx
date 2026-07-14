'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';

type SearchHit = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  onSelect: (lat: number, lng: number, label: string) => void;
};

function shortLabel(name: string) {
  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]}, ${parts[1]}`;
}

export function LocationPlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearching(false);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      setError(null);

      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('format', 'json');
        url.searchParams.set('q', q);
        url.searchParams.set('limit', '6');
        url.searchParams.set('addressdetails', '0');

        const res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('Search failed');
        const data = (await res.json()) as SearchHit[];
        setHits(data);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setHits([]);
        setError('Could not search places. Try again.');
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  function selectHit(hit: SearchHit) {
    const nextLat = Number(hit.lat);
    const nextLng = Number(hit.lon);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
    onSelect(nextLat, nextLng, hit.display_name);
    setQuery(hit.display_name);
    setHits([]);
    setOpen(false);
  }

  function clearSearch() {
    setQuery('');
    setHits([]);
    setOpen(false);
    setError(null);
  }

  return (
    <div className="field location-place-search" ref={wrapRef}>
      <label htmlFor="placeSearch">Search place</label>
      <span className="hint">Find an address or landmark, then pin it on the map.</span>
      <div className="location-place-search-bar">
        <span className="location-place-search-ico" aria-hidden>
          <Search size={15} />
        </span>
        <input
          id="placeSearch"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search address, city, or landmark…"
          autoComplete="off"
        />
        {searching ? (
          <Loader2 size={15} className="location-place-search-spin" aria-hidden />
        ) : query ? (
          <button type="button" className="location-place-search-clear" onClick={clearSearch} aria-label="Clear search">
            <X size={14} />
          </button>
        ) : null}
      </div>

      {open && (hits.length > 0 || error) ? (
        <ul className="location-place-results" role="listbox">
          {error ? (
            <li className="location-place-results-empty">{error}</li>
          ) : (
            hits.map((hit) => (
              <li key={hit.place_id}>
                <button type="button" onClick={() => selectHit(hit)}>
                  <span className="location-place-results-ico" aria-hidden>
                    <MapPin size={14} />
                  </span>
                  <span className="location-place-results-copy">
                    <strong>{shortLabel(hit.display_name)}</strong>
                    <span>{hit.display_name}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
