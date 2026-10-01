/** Google Street View: inline via the Maps Embed API when a key is set, else a link out. */

const EMBED_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || '').trim();

export function streetViewEmbedKey(): string {
  return EMBED_KEY;
}

/** Embed API snaps to the panorama nearest the point. */
export function streetViewEmbedUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    key: EMBED_KEY,
    location: `${lat},${lng}`,
    heading: '0',
    pitch: '0',
    fov: '90',
  });
  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
}

export function streetViewLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}
