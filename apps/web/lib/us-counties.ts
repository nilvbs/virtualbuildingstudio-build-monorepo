/** Fast US county lookup: local centroids + Census geometries for matches only. */

const KM_PER_MILE = 1.609344;

export type CountyGeometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

export type CountyHit = {
  fips: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number] | null;
  geometry: CountyGeometry | null;
};

type CountyCentroid = {
  fips: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
};

type CensusFeature = {
  type: 'Feature';
  properties?: {
    NAME?: string;
    STATE?: string;
    GEOID?: string;
  };
  geometry?: CountyGeometry | null;
};

type CensusCollection = {
  type: 'FeatureCollection';
  features?: CensusFeature[];
};

const geometryCache = new Map<string, CountyGeometry>();
let centroidsPromise: Promise<CountyCentroid[]> | null = null;

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function getCachedCountyGeometry(fips: string): CountyGeometry | null {
  return geometryCache.get(fips) ?? null;
}

export function cacheCountyGeometry(fips: string, geometry: CountyGeometry) {
  geometryCache.set(fips, geometry);
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function asLngLatRing(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const ring: [number, number][] = [];
  for (const pt of raw) {
    if (!Array.isArray(pt) || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') continue;
    ring.push([pt[0], pt[1]]);
  }
  return ring.length >= 4 ? closeRing(ring) : null;
}

function normalizeGeometry(geometry: CountyGeometry | null | undefined): CountyGeometry | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates
      .map((ring) => asLngLatRing(ring))
      .filter((ring): ring is [number, number][] => Boolean(ring));
    if (rings.length === 0) return null;
    return { type: 'Polygon', coordinates: rings };
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates
      .map((poly) =>
        poly
          .map((ring) => asLngLatRing(ring))
          .filter((ring): ring is [number, number][] => Boolean(ring)),
      )
      .filter((poly) => poly.length > 0);
    if (polys.length === 0) return null;
    return { type: 'MultiPolygon', coordinates: polys };
  }
  return null;
}

function bboxOfGeometry(geometry: CountyGeometry): [number, number, number, number] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.coordinates.flatMap((poly) => poly);
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return [west, south, east, north];
}

async function loadCentroids(): Promise<CountyCentroid[]> {
  if (!centroidsPromise) {
    centroidsPromise = fetch('/data/us-county-centroids.json', {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load county index');
        const data = (await res.json()) as CountyCentroid[];
        return Array.isArray(data) ? data : [];
      })
      .catch((err) => {
        centroidsPromise = null;
        throw err;
      });
  }
  return centroidsPromise;
}

/** Warm the local county index (no network to Census). */
export async function preloadCountyIndex(): Promise<void> {
  await loadCentroids();
}

async function queryGeometriesByFips(
  fipsList: string[],
  signal?: AbortSignal,
): Promise<Map<string, { geometry: CountyGeometry; bbox: [number, number, number, number] | null; name?: string }>> {
  const out = new Map<string, { geometry: CountyGeometry; bbox: [number, number, number, number] | null; name?: string }>();
  const missing = fipsList.filter((fips) => fips && !geometryCache.has(fips));

  for (const fips of fipsList) {
    const cached = geometryCache.get(fips);
    if (cached) out.set(fips, { geometry: cached, bbox: bboxOfGeometry(cached) });
  }

  for (let i = 0; i < missing.length; i += 25) {
    const chunk = missing.slice(i, i + 25);
    const where = `GEOID IN (${chunk.map((f) => `'${f}'`).join(',')})`;
    const url = new URL(
      'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query',
    );
    url.searchParams.set('where', where);
    url.searchParams.set('outFields', 'NAME,STATE,GEOID');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('f', 'geojson');
    // Heavily simplify polygons so the response stays small/fast.
    url.searchParams.set('maxAllowableOffset', '0.02');
    url.searchParams.set('geometryPrecision', '3');

    const res = await fetch(url.toString(), { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) continue;
    const data = (await res.json()) as CensusCollection;
    for (const feature of data.features ?? []) {
      const fips = feature.properties?.GEOID?.trim();
      const geometry = normalizeGeometry(feature.geometry ?? null);
      if (!fips || !geometry) continue;
      geometryCache.set(fips, geometry);
      out.set(fips, {
        geometry,
        bbox: bboxOfGeometry(geometry),
        name: feature.properties?.NAME?.trim(),
      });
    }
  }

  return out;
}

export async function fetchCountyGeometriesByFips(
  fipsList: string[],
  signal?: AbortSignal,
): Promise<void> {
  await queryGeometriesByFips(fipsList, signal);
}

/** Counties whose population center falls within radiusMiles of the given point. */
export async function findCountiesInRadius(
  lat: number,
  lng: number,
  radiusMiles: number,
  _signal?: AbortSignal,
): Promise<CountyHit[]> {
  const radiusKm = radiusMiles * KM_PER_MILE;
  const centroids = await loadCentroids();
  const matched = centroids
    .filter((c) => kmBetween(lat, lng, c.lat, c.lng) <= radiusKm)
    .sort((a, b) => a.state.localeCompare(b.state) || a.county.localeCompare(b.county));

  // Return matches immediately. Polygons hydrate in the map via fetchCountyGeometriesByFips.
  return matched.map((c) => ({
    fips: c.fips,
    county: c.county,
    state: c.state,
    lat: c.lat,
    lng: c.lng,
    bbox: null,
    geometry: null,
  }));
}
