'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const PICKED_ZOOM = 15;

type Props = {
  lat: string;
  lng: string;
  label?: string | null;
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

function MapClick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapLifecycle({ position }: { position: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const refresh = () => map.invalidateSize({ animate: false });

    refresh();
    const timers = [50, 150, 350, 700].map((ms) => window.setTimeout(refresh, ms));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null;
    ro?.observe(container);
    window.addEventListener('resize', refresh);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      ro?.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, [map]);

  useEffect(() => {
    if (!position) return;
    const center = map.getCenter();
    const [nextLat, nextLng] = position;
    if (Math.abs(center.lat - nextLat) < 1e-6 && Math.abs(center.lng - nextLng) < 1e-6) return;
    map.flyTo(position, Math.max(map.getZoom(), PICKED_ZOOM), { duration: 0.5 });
    window.setTimeout(() => map.invalidateSize({ animate: false }), 520);
  }, [map, position]);

  return null;
}

export function LocationMapPicker({ lat, lng, label, onPick }: Props) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(label ?? null);

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

  const pin = useMemo(
    () =>
      L.divIcon({
        className: 'location-map-pin',
        html: `
          <span class="location-map-pin-wrap">
            <span class="location-map-pin-pulse"></span>
            <span class="location-map-pin-dot"></span>
          </span>
        `,
        iconSize: [40, 48],
        iconAnchor: [20, 42],
      }),
    [],
  );

  return (
    <div className={`location-map ${position ? 'has-pin' : ''}`}>
      <div className="location-map-body">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={false}
          className="location-map-canvas"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <ZoomControl position="bottomright" />
          <MapClick
            onPick={(nextLat, nextLng) => {
              setPickedLabel(null);
              onPick(nextLat, nextLng);
            }}
          />
          <MapLifecycle position={position} />
          {position ? <Marker position={position} icon={pin} /> : null}
        </MapContainer>
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
