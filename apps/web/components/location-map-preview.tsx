'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { mapboxToken } from '../lib/geocode';
import { StreetViewButton, StreetViewFrame, hasInlineStreetView } from './street-view';

type Props = {
  lat: number;
  lng: number;
  label?: string | null;
  className?: string;
};

/** Compact read-only Mapbox static preview for project / match cards, with a Street View toggle. */
export function LocationMapPreview({ lat, lng, label, className }: Props) {
  const token = mapboxToken();
  const [street, setStreet] = useState(false);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (!token) {
    return (
      <div className={`location-map-preview is-fallback${className ? ` ${className}` : ''}`}>
        <MapPin size={14} aria-hidden />
        <span>{label?.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>
      </div>
    );
  }

  const src =
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
    `pin-s+7168f6(${lng},${lat})/${lng},${lat},13,0/640x280@2x` +
    `?access_token=${encodeURIComponent(token)}`;
  const showStreet = street && hasInlineStreetView();

  return (
    <figure
      className={`location-map-preview${showStreet ? ' is-street' : ''}${className ? ` ${className}` : ''}`}
    >
      {showStreet ? (
        <StreetViewFrame lat={lat} lng={lng} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label?.trim() || 'Project map location'} loading="lazy" />
      )}
      <StreetViewButton lat={lat} lng={lng} open={showStreet} onToggle={() => setStreet((v) => !v)} />
      {label?.trim() && !showStreet ? (
        <figcaption>
          <MapPin size={12} aria-hidden />
          <span>{label.trim()}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
