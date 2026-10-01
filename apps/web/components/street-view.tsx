'use client';

import { ExternalLink, Map as MapIcon, PersonStanding } from 'lucide-react';
import { streetViewEmbedKey, streetViewEmbedUrl, streetViewLink } from '../lib/street-view';

export function hasInlineStreetView(): boolean {
  return Boolean(streetViewEmbedKey());
}

type ButtonProps = {
  lat: number;
  lng: number;
  open: boolean;
  onToggle: () => void;
  className?: string;
};

/** Toggles inline Street View, or opens Google Street View in a new tab when no embed key is set. */
export function StreetViewButton({ lat, lng, open, onToggle, className }: ButtonProps) {
  const cls = `street-view-toggle${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`;

  if (!hasInlineStreetView()) {
    return (
      <a className={cls} href={streetViewLink(lat, lng)} target="_blank" rel="noopener noreferrer">
        <PersonStanding size={14} aria-hidden />
        <span>Street View</span>
        <ExternalLink size={12} aria-hidden />
      </a>
    );
  }

  return (
    <button type="button" className={cls} onClick={onToggle} aria-pressed={open}>
      {open ? <MapIcon size={14} aria-hidden /> : <PersonStanding size={14} aria-hidden />}
      <span>{open ? 'Map' : 'Street View'}</span>
    </button>
  );
}

type FrameProps = {
  lat: number;
  lng: number;
  className?: string;
};

export function StreetViewFrame({ lat, lng, className }: FrameProps) {
  return (
    <iframe
      className={`street-view-frame${className ? ` ${className}` : ''}`}
      title="Street View of the site"
      src={streetViewEmbedUrl(lat, lng)}
      loading="lazy"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
