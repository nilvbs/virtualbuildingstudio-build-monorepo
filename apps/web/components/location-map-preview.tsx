'use client';

import { MapPin } from 'lucide-react';
import { mapboxToken } from '../lib/geocode';

type Props = {
  lat: number;
  lng: number;
  label?: string | null;
  className?: string;
};

/** Compact read-only Mapbox static preview for project / match cards. */
export function LocationMapPreview({ lat, lng, label, className }: Props) {
  const token = mapboxToken();
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

  return (
    <figure className={`location-map-preview${className ? ` ${className}` : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label?.trim() || 'Project map location'} loading="lazy" />
      {label?.trim() ? (
        <figcaption>
          <MapPin size={12} aria-hidden />
          <span>{label.trim()}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
