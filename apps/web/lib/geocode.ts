/** OpenStreetMap Nominatim helpers (client-side). Keep requests infrequent. */

type NominatimReverse = {
  display_name?: string;
};

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimReverse;
  return data.display_name?.trim() || null;
}
