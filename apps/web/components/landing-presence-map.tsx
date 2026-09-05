'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { MapPin } from 'lucide-react';
import { mapboxToken } from '../lib/geocode';
import 'mapbox-gl/dist/mapbox-gl.css';

type HubSeed = {
  city: string;
  state: string;
  lng: number;
  lat: number;
  weight: number;
};

/** Illustrative network density across major U.S. metros (not live account counts). */
const HUB_SEEDS: HubSeed[] = [
  { city: 'Seattle', state: 'WA', lng: -122.33, lat: 47.61, weight: 6 },
  { city: 'Portland', state: 'OR', lng: -122.68, lat: 45.52, weight: 4 },
  { city: 'San Francisco', state: 'CA', lng: -122.42, lat: 37.77, weight: 9 },
  { city: 'Los Angeles', state: 'CA', lng: -118.24, lat: 34.05, weight: 11 },
  { city: 'San Diego', state: 'CA', lng: -117.16, lat: 32.72, weight: 5 },
  { city: 'Phoenix', state: 'AZ', lng: -112.07, lat: 33.45, weight: 6 },
  { city: 'Denver', state: 'CO', lng: -104.99, lat: 39.74, weight: 7 },
  { city: 'Salt Lake City', state: 'UT', lng: -111.89, lat: 40.76, weight: 3 },
  { city: 'Las Vegas', state: 'NV', lng: -115.14, lat: 36.17, weight: 3 },
  { city: 'Dallas', state: 'TX', lng: -96.8, lat: 32.78, weight: 10 },
  { city: 'Houston', state: 'TX', lng: -95.37, lat: 29.76, weight: 9 },
  { city: 'Austin', state: 'TX', lng: -97.74, lat: 30.27, weight: 7 },
  { city: 'San Antonio', state: 'TX', lng: -98.49, lat: 29.42, weight: 4 },
  { city: 'Oklahoma City', state: 'OK', lng: -97.52, lat: 35.47, weight: 3 },
  { city: 'Kansas City', state: 'MO', lng: -94.58, lat: 39.1, weight: 4 },
  { city: 'Minneapolis', state: 'MN', lng: -93.27, lat: 44.98, weight: 5 },
  { city: 'Chicago', state: 'IL', lng: -87.63, lat: 41.88, weight: 10 },
  { city: 'Detroit', state: 'MI', lng: -83.05, lat: 42.33, weight: 4 },
  { city: 'Indianapolis', state: 'IN', lng: -86.16, lat: 39.77, weight: 3 },
  { city: 'Nashville', state: 'TN', lng: -86.78, lat: 36.16, weight: 5 },
  { city: 'Atlanta', state: 'GA', lng: -84.39, lat: 33.75, weight: 8 },
  { city: 'Charlotte', state: 'NC', lng: -80.84, lat: 35.23, weight: 5 },
  { city: 'Raleigh', state: 'NC', lng: -78.64, lat: 35.78, weight: 4 },
  { city: 'Miami', state: 'FL', lng: -80.19, lat: 25.76, weight: 7 },
  { city: 'Orlando', state: 'FL', lng: -81.38, lat: 28.54, weight: 4 },
  { city: 'Tampa', state: 'FL', lng: -82.46, lat: 27.95, weight: 4 },
  { city: 'New Orleans', state: 'LA', lng: -90.07, lat: 29.95, weight: 3 },
  { city: 'Washington', state: 'DC', lng: -77.04, lat: 38.91, weight: 7 },
  { city: 'Baltimore', state: 'MD', lng: -76.61, lat: 39.29, weight: 3 },
  { city: 'Philadelphia', state: 'PA', lng: -75.17, lat: 39.95, weight: 6 },
  { city: 'New York', state: 'NY', lng: -74.01, lat: 40.71, weight: 12 },
  { city: 'Boston', state: 'MA', lng: -71.06, lat: 42.36, weight: 7 },
  { city: 'Pittsburgh', state: 'PA', lng: -79.99, lat: 40.44, weight: 3 },
  { city: 'Columbus', state: 'OH', lng: -82.99, lat: 39.96, weight: 4 },
  { city: 'Cleveland', state: 'OH', lng: -81.69, lat: 41.5, weight: 3 },
  { city: 'St. Louis', state: 'MO', lng: -90.2, lat: 38.63, weight: 3 },
  { city: 'Milwaukee', state: 'WI', lng: -87.91, lat: 43.04, weight: 3 },
  { city: 'Albuquerque', state: 'NM', lng: -106.65, lat: 35.08, weight: 2 },
  { city: 'Boise', state: 'ID', lng: -116.2, lat: 43.62, weight: 2 },
];

function jitter(seed: number, spread: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * spread;
}

type PresenceFeature = {
  type: 'Feature';
  id: number;
  properties: { city: string; state: string };
  geometry: { type: 'Point'; coordinates: [number, number] };
};

function buildPresenceFeatures() {
  const features: PresenceFeature[] = [];
  let id = 0;
  for (const hub of HUB_SEEDS) {
    for (let i = 0; i < hub.weight; i += 1) {
      const lng = hub.lng + jitter(id + 1, 0.55);
      const lat = hub.lat + jitter(id + 7, 0.4);
      features.push({
        type: 'Feature',
        id: id++,
        properties: { city: hub.city, state: hub.state },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      });
    }
  }
  return { type: 'FeatureCollection' as const, features };
}

const PRESENCE_DATA = buildPresenceFeatures();
const STATE_COUNT = new Set(HUB_SEEDS.map((h) => h.state)).size;
const HUB_COUNT = HUB_SEEDS.length;
const POINT_COUNT = PRESENCE_DATA.features.length;

const US_BOUNDS: [[number, number], [number, number]] = [
  [-125.2, 24.4],
  [-66.4, 49.4],
];

const MAP_FIT = {
  padding: 0,
  maxZoom: 4.35,
  duration: 0,
} as const;

function muteBasemap(map: MapboxMap) {
  const style = map.getStyle();
  for (const layer of style.layers ?? []) {
    const id = layer.id;
    try {
      if (layer.type === 'symbol') {
        if (
          id.includes('water') ||
          id.includes('ocean') ||
          id.includes('marine') ||
          id.includes('country') ||
          id.includes('continent')
        ) {
          map.setLayoutProperty(id, 'visibility', 'none');
          continue;
        }
        map.setPaintProperty(id, 'text-opacity', 0.42);
        map.setPaintProperty(id, 'text-halo-width', 0.8);
      }
      if (layer.type === 'fill' && (id.includes('water') || id === 'water')) {
        map.setPaintProperty(id, 'fill-color', '#eef1f8');
      }
      if (layer.type === 'fill' && id.includes('land')) {
        map.setPaintProperty(id, 'fill-color', '#f7f8fc');
      }
      if (layer.type === 'line' && id.includes('admin') && id.includes('country')) {
        map.setPaintProperty(id, 'line-opacity', 0.25);
      }
      if (layer.type === 'line' && id.includes('admin') && id.includes('state')) {
        map.setPaintProperty(id, 'line-color', '#c8cde0');
        map.setPaintProperty(id, 'line-opacity', 0.55);
      }
    } catch {
      // style layer may not support the paint key
    }
  }
}

function pinSvgDataUrl(fill: string, label?: string) {
  const digits = label?.length ?? 0;
  const fontSize = digits >= 3 ? 15 : digits === 2 ? 18 : 21;
  // Baseline so glyph optical center lands on the white-disc center (cy=28).
  const textY = (28 + fontSize * 0.36).toFixed(1);
  const labelMarkup =
    label != null && label.length > 0
      ? `<text
          x="32"
          y="${textY}"
          text-anchor="middle"
          fill="#5b52e0"
          font-size="${fontSize}"
          font-weight="700"
          font-family="Inter,Segoe UI,system-ui,-apple-system,sans-serif"
        >${label}</text>`
      : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="192" viewBox="0 0 64 96" fill="none">
      <ellipse cx="32" cy="90" rx="12" ry="3.8" fill="rgba(15,29,50,0.2)"/>
      <path
        d="M32 6C19.3 6 9 16.3 9 29c0 19.2 23 51 23 51s23-31.8 23-51C55 16.3 44.7 6 32 6z"
        fill="${fill}"
        stroke="#ffffff"
        stroke-width="4.5"
        stroke-linejoin="round"
      />
      <circle cx="32" cy="28" r="13" fill="#ffffff"/>
      ${labelMarkup}
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadPinImage(src: string, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(width, height);
    img.decoding = 'sync';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load pin image'));
    img.src = src;
  });
}

const PIN_IMAGE_W = 96;
const PIN_IMAGE_H = 144;
const PIN_FILL = '#7168f6';
const MAX_CLUSTER_LABEL = Math.max(POINT_COUNT, 64);

async function addPinImage(map: MapboxMap, id: string, label?: string) {
  if (map.hasImage(id)) map.removeImage(id);
  const img = await loadPinImage(pinSvgDataUrl(PIN_FILL, label), PIN_IMAGE_W, PIN_IMAGE_H);
  map.addImage(id, img, { pixelRatio: 2, sdf: false });
}

async function registerPinImages(map: MapboxMap) {
  // Blank pin for unclustered points.
  await addPinImage(map, 'bld-pin');

  // Bake each cluster count into the white disc so the number is perfectly centered.
  const jobs: Promise<void>[] = [];
  for (let n = 2; n <= MAX_CLUSTER_LABEL; n += 1) {
    jobs.push(addPinImage(map, `bld-pin-${n}`, String(n)));
  }
  await Promise.all(jobs);
}

function PresenceFallback() {
  return (
    <div className="bld-presence-fallback" role="img" aria-label="U.S. surveyor coverage map">
      <svg viewBox="0 0 960 520" className="bld-presence-fallback-svg" aria-hidden>
        <defs>
          <radialGradient id="bldPresenceGlow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(113,104,246,0.16)" />
            <stop offset="100%" stopColor="rgba(113,104,246,0)" />
          </radialGradient>
        </defs>
        <rect width="960" height="520" fill="url(#bldPresenceGlow)" />
        <path
          className="bld-presence-fallback-land"
          d="M118 148c42-38 96-54 152-48 38 4 72 22 108 28 48 8 92-10 136-6 40 4 74 28 112 34 46 8 90-8 132 6 28 10 48 34 74 44 18 8 40 6 58 16v48c-36 10-70-4-104-2-48 4-90 28-138 26-52-2-98-28-148-30-42-2-80 16-122 14-46-2-88-24-134-22-36 2-68 20-102 18-18-1-34-10-50-16l26-110z"
        />
        {HUB_SEEDS.map((hub) => {
          const x = ((hub.lng + 125.5) / 59) * 860 + 50;
          const y = ((49.5 - hub.lat) / 25.3) * 380 + 70;
          const scale = 0.55 + hub.weight * 0.045;
          return (
            <g key={`${hub.city}-${hub.state}`} transform={`translate(${x} ${y}) scale(${scale})`}>
              <title>
                {hub.city}, {hub.state}
              </title>
              <path
                className="bld-presence-fallback-pin"
                d="M0 14c0-8.3 6.7-15 15-15s15 6.7 15 15c0 11.2-15 28-15 28S0 25.2 0 14z"
                transform="translate(-15 -42)"
              />
              <circle className="bld-presence-fallback-pin-dot" cx="0" cy="-28" r="6.5" />
              <text
                className="bld-presence-fallback-count"
                x="0"
                y="-26"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {hub.weight}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LandingPresenceMap() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const token = useMemo(() => mapboxToken(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !token || !shellRef.current || mapRef.current) return;

    let cancelled = false;
    let created: MapboxMap | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled || !shellRef.current) return;

      mapboxgl.accessToken = token;
      created = new mapboxgl.Map({
        container: shellRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        bounds: US_BOUNDS,
        fitBoundsOptions: { ...MAP_FIT },
        minZoom: 3.2,
        maxZoom: 7.5,
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
        cooperativeGestures: true,
        attributionControl: false,
        logoPosition: 'bottom-left',
      });

      created.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      created.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

      const fillFrame = () => {
        if (!mapRef.current) return;
        mapRef.current.fitBounds(US_BOUNDS, { ...MAP_FIT });
      };

      created.on('load', () => {
        if (cancelled || !created) return;

        void (async () => {
          if (cancelled || !created) return;

          muteBasemap(created);
          await registerPinImages(created);
          if (cancelled || !created) return;

          fillFrame();

          created.addSource('bld-presence', {
            type: 'geojson',
            data: PRESENCE_DATA,
            cluster: true,
            clusterMaxZoom: 6,
            clusterRadius: 56,
          });

          // Soft halo under pins so they pop on light basemap.
          created.addLayer({
            id: 'bld-presence-halo',
            type: 'circle',
            source: 'bld-presence',
            paint: {
              'circle-color': '#7168f6',
              'circle-radius': [
                'step',
                ['coalesce', ['get', 'point_count'], 1],
                5,
                8,
                7,
                18,
                9,
              ],
              'circle-opacity': 0.14,
              'circle-blur': 0.65,
              'circle-translate': [0, -4],
            },
          });

          created.addLayer({
            id: 'bld-presence-clusters',
            type: 'symbol',
            source: 'bld-presence',
            filter: ['has', 'point_count'],
            layout: {
              'icon-image': [
                'concat',
                'bld-pin-',
                [
                  'to-string',
                  [
                    'min',
                    ['get', 'point_count'],
                    MAX_CLUSTER_LABEL,
                  ],
                ],
              ],
              'icon-size': ['step', ['get', 'point_count'], 0.58, 8, 0.66, 18, 0.74],
              'icon-anchor': 'bottom',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
            paint: {
              'icon-opacity': 1,
            },
          });

          created.addLayer({
            id: 'bld-presence-point',
            type: 'symbol',
            source: 'bld-presence',
            filter: ['!', ['has', 'point_count']],
            layout: {
              'icon-image': 'bld-pin',
              'icon-size': 0.52,
              'icon-anchor': 'bottom',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
            paint: {
              'icon-opacity': 1,
            },
          });

          created.on('click', 'bld-presence-clusters', (event: MapMouseEvent) => {
            const feature = event.features?.[0];
            if (!feature || !created) return;
            const clusterId = feature.properties?.cluster_id as number | undefined;
            const source = created.getSource('bld-presence') as GeoJSONSource | undefined;
            if (clusterId == null || !source) return;
            const geometry = feature.geometry;
            if (geometry.type !== 'Point') return;
            const center = geometry.coordinates as [number, number];

            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null || !mapRef.current) return;
              mapRef.current.easeTo({ center, zoom });
            });
          });

          created.on('mouseenter', 'bld-presence-clusters', () => {
            created!.getCanvas().style.cursor = 'pointer';
          });
          created.on('mouseleave', 'bld-presence-clusters', () => {
            created!.getCanvas().style.cursor = '';
          });

          created.on('mouseenter', 'bld-presence-point', (event: MapMouseEvent) => {
            created!.getCanvas().style.cursor = 'pointer';
            const city = event.features?.[0]?.properties?.city as string | undefined;
            const state = event.features?.[0]?.properties?.state as string | undefined;
            if (city && state) setActiveCity(`${city}, ${state}`);
          });
          created.on('mouseleave', 'bld-presence-point', () => {
            created!.getCanvas().style.cursor = '';
            setActiveCity(null);
          });

          setMapReady(true);
          requestAnimationFrame(fillFrame);
        })();
      });

      mapRef.current = created;
      resizeObserver = new ResizeObserver(() => {
        created?.resize();
        fillFrame();
      });
      resizeObserver.observe(shellRef.current);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mounted, token]);

  return (
    <div className={`bld-presence-frame${mapReady ? ' is-ready' : ''}`}>
      <div className="bld-presence-veil" aria-hidden />

      <div className="bld-presence-stats" aria-label="Network snapshot">
        <div className="bld-presence-stat">
          <span className="bld-presence-stat-icon" aria-hidden>
            <MapPin size={14} strokeWidth={2.5} />
          </span>
          <p>
            <strong>{HUB_COUNT}+</strong> metro hubs
          </p>
        </div>
        <div className="bld-presence-stat">
          <span className="bld-presence-stat-dot" aria-hidden />
          <p>
            <strong>{STATE_COUNT}</strong> states covered
          </p>
        </div>
        <div className="bld-presence-stat bld-presence-stat--soft">
          <p>
            <strong>{POINT_COUNT}+</strong> coverage signals
          </p>
        </div>
      </div>

      {activeCity ? (
        <div className="bld-presence-tooltip" role="status">
          {activeCity}
        </div>
      ) : null}

      <div className="bld-presence-legend" aria-hidden>
        <span className="bld-presence-legend-swatch" aria-hidden>
          <MapPin size={12} strokeWidth={2.5} />
        </span>
        Pins mark coverage across the U.S.
      </div>

      {token ? (
        <div ref={shellRef} className="bld-presence-canvas" aria-label="Interactive U.S. coverage map" />
      ) : (
        <PresenceFallback />
      )}
    </div>
  );
}
