/** Mapbox geocoding (falls back to Nominatim if no token). */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

type MapboxContext = {
  id?: string;
  text?: string;
  short_code?: string;
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  bbox?: [number, number, number, number];
  place_type?: string[];
  context?: MapboxContext[];
};

type MapboxGeocode = {
  features?: MapboxFeature[];
};

export type GeocodeHit = {
  lat: number;
  lng: number;
  placeName: string;
};

export type ZipCountyHit = {
  zip: string;
  county: string;
  state: string;
  country: 'us';
  lat: number;
  lng: number;
  bbox: [number, number, number, number] | null;
  polygon: [number, number][] | null;
  placeName: string;
};

type NominatimReverse = {
  display_name?: string;
};

type NominatimSearchHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
  boundingbox?: [string, string, string, string];
  geojson?: {
    type?: string;
    coordinates?: unknown;
  };
};

export function mapboxToken(): string {
  return MAPBOX_TOKEN.trim();
}

/** API stores coverage in km; UI for US audience uses miles. */
export const KM_PER_MILE = 1.609344;

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

export function formatMilesFromKm(km: number, digits = 0): string {
  const miles = kmToMiles(km);
  return digits > 0 ? miles.toFixed(digits) : String(Math.round(miles));
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const token = mapboxToken();
  if (token) {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${lng},${lat}`)}.json`,
    );
    url.searchParams.set('access_token', token);
    url.searchParams.set('limit', '1');
    url.searchParams.set('types', 'address,place,locality,neighborhood');
    const res = await fetch(url.toString(), { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as MapboxGeocode;
    return data.features?.[0]?.place_name?.trim() || null;
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '0');
  const res = await fetch(url.toString(), { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimReverse;
  return data.display_name?.trim() || null;
}

export async function forwardGeocode(query: string, signal?: AbortSignal): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  const token = mapboxToken();
  if (token) {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('limit', '1');
    url.searchParams.set('types', 'address,place,locality,neighborhood,poi');
    const res = await fetch(url.toString(), { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as MapboxGeocode;
    const feature = data.features?.[0];
    const center = feature?.center;
    if (!center || center.length < 2) return null;
    const [nextLng, nextLat] = center;
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return null;
    return { lat: nextLat, lng: nextLng, placeName: feature?.place_name?.trim() || q };
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'BLD-SurveyLink/1.0 (coverage-lookup)',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const hit = data[0];
  const nextLat = Number(hit?.lat);
  const nextLng = Number(hit?.lon);
  if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return null;
  return { lat: nextLat, lng: nextLng, placeName: hit?.display_name?.trim() || q };
}

export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function contextByPrefix(context: MapboxContext[] | undefined, prefix: string): MapboxContext | undefined {
  return context?.find((c) => typeof c.id === 'string' && c.id.startsWith(`${prefix}.`));
}

function normalizeUsZip(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 9) return digits.slice(0, 5);
  return null;
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function extractPolygonRing(geojson: NominatimSearchHit['geojson']): [number, number][] | null {
  if (!geojson?.coordinates) return null;
  if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
    const outer = geojson.coordinates[0];
    if (!Array.isArray(outer) || outer.length < 4) return null;
    const ring = outer
      .filter((pt): pt is [number, number] => Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number')
      .map((pt) => [pt[0], pt[1]] as [number, number]);
    return ring.length >= 4 ? closeRing(ring) : null;
  }
  if (geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates)) {
    const firstPoly = geojson.coordinates[0];
    const outer = Array.isArray(firstPoly) ? firstPoly[0] : null;
    if (!Array.isArray(outer) || outer.length < 4) return null;
    const ring = outer
      .filter((pt): pt is [number, number] => Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number')
      .map((pt) => [pt[0], pt[1]] as [number, number]);
    return ring.length >= 4 ? closeRing(ring) : null;
  }
  return null;
}

async function reverseDistrict(
  lng: number,
  lat: number,
  token: string,
  signal?: AbortSignal,
): Promise<{ county: string; state: string; bbox: [number, number, number, number] | null } | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${lng},${lat}`)}.json`,
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('types', 'district');
  url.searchParams.set('limit', '1');
  url.searchParams.set('country', 'US');
  const res = await fetch(url.toString(), { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as MapboxGeocode;
  const feature = data.features?.[0];
  const county = feature?.text?.trim() || '';
  const state = contextByPrefix(feature?.context, 'region')?.text?.trim() || '';
  if (!county || !state) return null;
  return { county, state, bbox: feature?.bbox ?? null };
}

async function fetchCountyPolygon(
  county: string,
  state: string,
  signal?: AbortSignal,
): Promise<{
  polygon: [number, number][] | null;
  bbox: [number, number, number, number] | null;
  lat: number | null;
  lng: number | null;
}> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('polygon_geojson', '1');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('q', `${county}, ${state}, USA`);
  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'BLD-SurveyLink/1.0 (coverage-lookup)',
    },
  });
  if (!res.ok) return { polygon: null, bbox: null, lat: null, lng: null };
  const data = (await res.json()) as NominatimSearchHit[];
  const hit = data[0];
  if (!hit) return { polygon: null, bbox: null, lat: null, lng: null };

  let bbox: [number, number, number, number] | null = null;
  if (hit.boundingbox?.length === 4) {
    const south = Number(hit.boundingbox[0]);
    const north = Number(hit.boundingbox[1]);
    const west = Number(hit.boundingbox[2]);
    const east = Number(hit.boundingbox[3]);
    if ([south, north, west, east].every(Number.isFinite)) {
      bbox = [west, south, east, north];
    }
  }

  return {
    polygon: extractPolygonRing(hit.geojson),
    bbox,
    lat: Number.isFinite(Number(hit.lat)) ? Number(hit.lat) : null,
    lng: Number.isFinite(Number(hit.lon)) ? Number(hit.lon) : null,
  };
}

/**
 * Resolve a US ZIP to every county that participates in that ZIP,
 * with county polygons for the coverage map.
 */
export async function lookupZipCounties(
  zipInput: string,
  signal?: AbortSignal,
): Promise<ZipCountyHit[]> {
  const zip = normalizeUsZip(zipInput);
  if (!zip) return [];
  const token = mapboxToken();
  if (!token) return [];

  const postcodeUrl = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json`,
  );
  postcodeUrl.searchParams.set('access_token', token);
  postcodeUrl.searchParams.set('country', 'US');
  postcodeUrl.searchParams.set('types', 'postcode');
  postcodeUrl.searchParams.set('limit', '1');
  const postcodeRes = await fetch(postcodeUrl.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!postcodeRes.ok) return [];
  const postcodeData = (await postcodeRes.json()) as MapboxGeocode;
  const postcode = postcodeData.features?.[0];
  const center = postcode?.center;
  if (!center || center.length < 2) return [];
  const [lng, lat] = center;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const samplePoints: Array<[number, number]> = [[lng, lat]];
  const bbox = postcode.bbox;
  if (bbox) {
    const [west, south, east, north] = bbox;
    const midX = (west + east) / 2;
    const midY = (south + north) / 2;
    // Sample corners + edge midpoints so ZIPs that straddle counties still surface them.
    samplePoints.push(
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [midX, south],
      [midX, north],
      [west, midY],
      [east, midY],
    );
  }

  const found = new Map<string, { county: string; state: string; bbox: [number, number, number, number] | null }>();
  const districtHits = await Promise.all(
    samplePoints.map(([sampleLng, sampleLat]) => reverseDistrict(sampleLng, sampleLat, token, signal)),
  );
  for (const district of districtHits) {
    if (!district) continue;
    const key = `${district.county.toLowerCase()}|${district.state.toLowerCase()}`;
    if (!found.has(key)) found.set(key, district);
  }

  // Fallback: postcode context district if reverse samples miss.
  if (found.size === 0) {
    const districtCtx = contextByPrefix(postcode?.context, 'district');
    const regionCtx = contextByPrefix(postcode?.context, 'region');
    const county = districtCtx?.text?.trim() || '';
    const state = regionCtx?.text?.trim() || '';
    if (county && state) {
      found.set(`${county.toLowerCase()}|${state.toLowerCase()}`, {
        county,
        state,
        bbox: postcode?.bbox ?? null,
      });
    }
  }

  const hits: ZipCountyHit[] = await Promise.all(
    Array.from(found.values()).map(async (district) => {
      const shape = await fetchCountyPolygon(district.county, district.state, signal);
      return {
        zip,
        county: district.county,
        state: district.state,
        country: 'us' as const,
        lat: shape.lat ?? lat,
        lng: shape.lng ?? lng,
        bbox: shape.bbox ?? district.bbox ?? postcode?.bbox ?? null,
        polygon: shape.polygon,
        placeName: postcode?.place_name?.trim() || `${zip}, ${district.county}, ${district.state}`,
      };
    }),
  );

  return hits;
}

/** @deprecated Prefer lookupCountiesByZipRadius */
export async function lookupZipCoverage(
  zipInput: string,
  signal?: AbortSignal,
): Promise<ZipCountyHit | null> {
  const hits = await lookupZipCounties(zipInput, signal);
  return hits[0] ?? null;
}

/** Find all US counties within radiusMiles of a ZIP (Census polygons). */
export async function lookupCountiesByZipRadius(
  zipInput: string,
  radiusMiles: number,
  signal?: AbortSignal,
): Promise<{
  zip: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  counties: Array<{
    fips: string;
    county: string;
    state: string;
    lat: number;
    lng: number;
    bbox: [number, number, number, number] | null;
  }>;
} | null> {
  const zip = normalizeUsZip(zipInput);
  if (!zip) return null;
  const token = mapboxToken();
  if (!token) return null;

  const postcodeUrl = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json`,
  );
  postcodeUrl.searchParams.set('access_token', token);
  postcodeUrl.searchParams.set('country', 'US');
  postcodeUrl.searchParams.set('types', 'postcode');
  postcodeUrl.searchParams.set('limit', '1');
  const postcodeRes = await fetch(postcodeUrl.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!postcodeRes.ok) return null;
  const postcodeData = (await postcodeRes.json()) as MapboxGeocode;
  const postcode = postcodeData.features?.[0];
  const center = postcode?.center;
  if (!center || center.length < 2) return null;
  const [lng, lat] = center;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const { findCountiesInRadius } = await import('./us-counties');
  const hits = await findCountiesInRadius(lat, lng, Math.max(1, radiusMiles), signal);
  return {
    zip,
    lat,
    lng,
    radiusMiles: Math.max(1, radiusMiles),
    counties: hits.map((h) => ({
      fips: h.fips,
      county: h.county,
      state: h.state,
      lat: h.lat,
      lng: h.lng,
      bbox: h.bbox,
    })),
  };
}
