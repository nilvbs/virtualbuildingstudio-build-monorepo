'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import { MapPin } from 'lucide-react';
import { mapboxToken } from '../lib/geocode';
import 'mapbox-gl/dist/mapbox-gl.css';

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const PICKED_ZOOM = 16.5;
const PITCH = 62;
const BEARING = -20;

const BASEMAP_VISIBILITY = {
  lightPreset: 'night',
  theme: 'default',
  show3dObjects: true,
  show3dBuildings: true,
  show3dTrees: true,
  show3dLandmarks: true,
  show3dFacades: true,
  showLandmarkIcons: true,
  showLandmarkIconLabels: true,
  showPlaceLabels: true,
  showPointOfInterestLabels: true,
  showRoadLabels: true,
  showTransitLabels: true,
  showPedestrianRoads: true,
} as const;

function applyBasemapVisibility(map: MapboxMap) {
  for (const [key, value] of Object.entries(BASEMAP_VISIBILITY)) {
    map.setConfigProperty('basemap', key, value);
  }
}

type Props = {
  lat: string;
  lng: string;
  label?: string | null;
  compact?: boolean;
  mapId?: string;
  onPick: (lat: number, lng: number) => void;
};

function parseCoord(value: string): number | null {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) ? n : null;
}

function shortLabel(name: string) {
  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]}, ${parts[1]}`;
}

function pinElement() {
  const el = document.createElement('div');
  el.className = 'location-map-pin';
  el.innerHTML = `
    <span class="location-map-pin-wrap">
      <span class="location-map-pin-pulse"></span>
      <span class="location-map-pin-dot"></span>
    </span>
  `;
  return el;
}

export function LocationMapPicker({ lat, lng, label, compact, mapId, onPick }: Props) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(label ?? null);
  const [mounted, setMounted] = useState(false);
  const token = mapboxToken();
  const [mapReady, setMapReady] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPickedLabel(label ?? null);
  }, [label]);

  const position = useMemo((): [number, number] | null => {
    const la = parseCoord(lat);
    const ln = parseCoord(lng);
    if (la === null || ln === null) return null;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
    return [la, ln];
  }, [lat, lng]);

  const center = position ?? DEFAULT_CENTER;
  const zoom = position ? PICKED_ZOOM : DEFAULT_ZOOM;

  useEffect(() => {
    if (!mounted || !token || !shellRef.current) return;

    let cancelled = false;
    const container = shellRef.current;
    let created: MapboxMap | undefined;
    const timers: number[] = [];
    let ro: ResizeObserver | null = null;

    void import('mapbox-gl').then((mod) => {
      if (cancelled || !container.isConnected) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = token;

      created = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/standard',
        center: [center[1], center[0]],
        zoom,
        pitch: PITCH,
        bearing: BEARING,
        maxPitch: 85,
        attributionControl: false,
        config: {
          basemap: { ...BASEMAP_VISIBILITY },
        },
      });

      created.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

      created.on('click', (e) => {
        setPickedLabel(null);
        onPickRef.current(e.lngLat.lat, e.lngLat.lng);
      });

      created.on('style.load', () => {
        if (created) applyBasemapVisibility(created);
      });

      mapRef.current = created;
      setMapReady(true);

      const refresh = () => created?.resize();
      timers.push(...[50, 150, 350, 700].map((ms) => window.setTimeout(refresh, ms)));
      ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null;
      ro?.observe(container);
    });

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      ro?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      created?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Map is created once per token/container; later moves happen in the position effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, token, mapId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mounted || !mapReady || !map || !position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    void import('mapbox-gl').then((mod) => {
      const mapboxgl = mod.default;
      const next: [number, number] = [position[1], position[0]];
      let marker = markerRef.current;
      if (!marker) {
        marker = new mapboxgl.Marker({ element: pinElement(), draggable: true, anchor: 'bottom' })
          .setLngLat(next)
          .addTo(map);
        marker.on('dragend', () => {
          const lngLat = marker?.getLngLat();
          if (!lngLat) return;
          setPickedLabel(null);
          onPickRef.current(lngLat.lat, lngLat.lng);
        });
        markerRef.current = marker;
      } else {
        marker.setLngLat(next);
      }

      const current = map.getCenter();
      if (Math.abs(current.lat - position[0]) < 1e-6 && Math.abs(current.lng - position[1]) < 1e-6) return;
      map.flyTo({
        center: next,
        zoom: Math.max(map.getZoom(), PICKED_ZOOM),
        pitch: PITCH,
        bearing: BEARING,
        duration: 800,
      });
    });
  }, [mounted, mapReady, position]);

  if (!mounted) {
    return (
      <div className={`location-map location-map--loading${compact ? ' location-map--compact' : ''}`}>
        Loading map…
      </div>
    );
  }

  if (!token) {
    return (
      <div className={`location-map location-map--loading${compact ? ' location-map--compact' : ''}`}>
        Add NEXT_PUBLIC_MAPBOX_TOKEN to load the 3D basemap.
      </div>
    );
  }

  return (
    <div className={`location-map${position ? ' has-pin' : ''}${compact ? ' location-map--compact' : ''}`}>
      <div className="location-map-body">
        <div ref={shellRef} id={mapId} className="location-map-canvas location-map-canvas--gl" />
      </div>

      <div className="location-map-wash" aria-hidden />

      {!position ? (
        <div className="location-map-empty" aria-hidden>
          <MapPin size={14} />
          <span>Click the map to drop a pin</span>
        </div>
      ) : (
        <div className="location-map-chip">
          <span className="location-map-chip-dot" aria-hidden />
          <div className="location-map-chip-copy">
            <strong>{pickedLabel ? shortLabel(pickedLabel) : 'Pinned location'}</strong>
            <span>
              {position[0].toFixed(5)}, {position[1].toFixed(5)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
