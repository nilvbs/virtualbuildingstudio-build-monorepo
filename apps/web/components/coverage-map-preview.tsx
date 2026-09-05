'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import { MapPin } from 'lucide-react';
import { formatMilesFromKm, mapboxToken } from '../lib/geocode';
import 'mapbox-gl/dist/mapbox-gl.css';

const BASEMAP_VISIBILITY = {
  lightPreset: 'day',
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
    try {
      map.setConfigProperty('basemap', key, value);
    } catch {
      // older style / unsupported config key
    }
  }
}

export type CoverageCountyArea = {
  zip: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number] | null;
  polygon?: [number, number][] | null;
  fips?: string | null;
  selected?: boolean;
};

type Props = {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  label?: string | null;
  areas?: string[];
  counties?: CoverageCountyArea[];
  /** When false, only county polygons are drawn (ZIP coverage mode). */
  showRadius?: boolean;
  className?: string;
};

type CountyFeatureGeometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, string>;
    geometry: CountyFeatureGeometry;
  }>;
};

function circleRing(lat: number, lng: number, radiusKm: number, points = 64): [number, number][] {
  const coords: [number, number][] = [];
  const earth = 6371;
  const d = radiusKm / earth;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  for (let i = 0; i <= points; i++) {
    const bearing = (2 * Math.PI * i) / points;
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(bearing),
    );
    const lng2 =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(latRad),
        Math.cos(d) - Math.sin(latRad) * Math.sin(lat2),
      );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return coords;
}

function bboxRing(bbox: [number, number, number, number]): [number, number][] {
  const [west, south, east, north] = bbox;
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
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

function shortLabel(name: string) {
  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]}, ${parts[1]}`;
}

function countyKey(c: CoverageCountyArea) {
  return `${c.county.toLowerCase()}|${c.state.toLowerCase()}`;
}

const EMPTY_FC: GeoJsonFeatureCollection = { type: 'FeatureCollection', features: [] };

export function CoverageMapPreview({
  lat,
  lng,
  radiusKm,
  label,
  areas = [],
  counties = [],
  showRadius = true,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const token = mapboxToken();
  const shellRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const paintRef = useRef<{
    radius: GeoJsonFeatureCollection;
    counties: GeoJsonFeatureCollection;
    fit: [[number, number], [number, number]] | null;
    marker: [number, number] | null;
  }>({
    radius: EMPTY_FC,
    counties: EMPTY_FC,
    fit: null,
    marker: null,
  });

  const position = useMemo(() => {
    if (lat == null || lng == null) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }, [lat, lng]);

  const radius = Math.max(1, Math.min(2000, Number.isFinite(radiusKm) ? radiusKm : 250));

  const uniqueCounties = useMemo(() => {
    const seen = new Set<string>();
    const out: CoverageCountyArea[] = [];
    for (const c of counties) {
      if (c.selected === false) continue;
      const key = countyKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [counties]);

  useEffect(() => {
    setMounted(true);
  }, []);

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

      const center: [number, number] = position ? [position.lng, position.lat] : [-95.3698, 29.7604];
      created = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/standard',
        center,
        zoom: position ? 9 : 3.4,
        pitch: 0,
        bearing: 0,
        maxPitch: 85,
        interactive: true,
        attributionControl: false,
        config: {
          basemap: { ...BASEMAP_VISIBILITY },
        },
      });
      created.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      created.scrollZoom.disable();

      const paintSources = () => {
        if (!created || cancelled) return;
        const radiusSource = created.getSource('svy-coverage-radius') as GeoJSONSource | undefined;
        const countySource = created.getSource('svy-coverage-counties') as GeoJSONSource | undefined;
        radiusSource?.setData(paintRef.current.radius);
        countySource?.setData(paintRef.current.counties);

        const markerLngLat = paintRef.current.marker;
        if (markerLngLat) {
          let marker = markerRef.current;
          if (!marker) {
            marker = new mapboxgl.Marker({ element: pinElement(), anchor: 'bottom' })
              .setLngLat(markerLngLat)
              .addTo(created);
            markerRef.current = marker;
          } else {
            marker.setLngLat(markerLngLat);
          }
        } else {
          markerRef.current?.remove();
          markerRef.current = null;
        }

        const fit = paintRef.current.fit;
        if (fit) {
          created.resize();
          created.fitBounds(fit, {
            padding: 48,
            duration: 650,
            maxZoom: paintRef.current.counties.features.length > 0 ? 8.5 : 11,
            pitch: 0,
            bearing: 0,
          });
        }
      };

      const ensureLayers = () => {
        if (!created || cancelled) return;
        applyBasemapVisibility(created);

        if (!created.getSource('svy-coverage-radius')) {
          created.addSource('svy-coverage-radius', {
            type: 'geojson',
            data: EMPTY_FC,
          });
        }
        if (!created.getLayer('svy-coverage-fill')) {
          created.addLayer({
            id: 'svy-coverage-fill',
            type: 'fill',
            source: 'svy-coverage-radius',
            slot: 'top',
            paint: {
              'fill-color': '#7168f6',
              'fill-opacity': 0.22,
            },
          });
        }
        if (!created.getLayer('svy-coverage-line')) {
          created.addLayer({
            id: 'svy-coverage-line',
            type: 'line',
            source: 'svy-coverage-radius',
            slot: 'top',
            paint: {
              'line-color': '#5b52e0',
              'line-width': 3,
              'line-opacity': 1,
            },
          });
        }

        if (!created.getSource('svy-coverage-counties')) {
          created.addSource('svy-coverage-counties', {
            type: 'geojson',
            data: EMPTY_FC,
          });
        }
        if (!created.getLayer('svy-county-fill')) {
          created.addLayer({
            id: 'svy-county-fill',
            type: 'fill',
            source: 'svy-coverage-counties',
            slot: 'top',
            paint: {
              'fill-color': '#7168f6',
              'fill-opacity': 0.35,
            },
          });
        }
        if (!created.getLayer('svy-county-line')) {
          created.addLayer({
            id: 'svy-county-line',
            type: 'line',
            source: 'svy-coverage-counties',
            slot: 'top',
            paint: {
              'line-color': '#3f38c7',
              'line-width': 3,
              'line-opacity': 1,
            },
          });
        }

        created.resize();
        paintSources();
        setMapReady(true);
      };

      // Standard style can reload and drop custom layers — re-attach on every style.load.
      created.on('style.load', () => {
        ensureLayers();
      });

      if (created.isStyleLoaded()) ensureLayers();
      else created.once('load', ensureLayers);

      mapRef.current = created;
      const refresh = () => {
        created?.resize();
      };
      timers.push(...[40, 120, 280, 600, 1200].map((ms) => window.setTimeout(refresh, ms)));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, token]);

  useEffect(() => {
    let cancelled = false;

    async function paint() {
      const { getCachedCountyGeometry, fetchCountyGeometriesByFips } = await import('../lib/us-counties');

      const fipsList = uniqueCounties.map((c) => c.fips).filter((f): f is string => Boolean(f));
      if (fipsList.length > 0) {
        await fetchCountyGeometriesByFips(fipsList);
      }
      if (cancelled) return;

      const boundLngs: number[] = [];
      const boundLats: number[] = [];
      const countyLngs: number[] = [];
      const countyLats: number[] = [];

      let radiusFc: GeoJsonFeatureCollection = EMPTY_FC;
      let marker: [number, number] | null = null;

      if (showRadius && position) {
        const ring = closeRing(circleRing(position.lat, position.lng, radius));
        radiusFc = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { kind: 'radius' },
              geometry: { type: 'Polygon', coordinates: [ring] },
            },
          ],
        };
        for (const [x, y] of ring) {
          boundLngs.push(x);
          boundLats.push(y);
        }
        marker = [position.lng, position.lat];
      } else if (position && uniqueCounties.length === 0) {
        marker = [position.lng, position.lat];
        boundLngs.push(position.lng);
        boundLats.push(position.lat);
      }

      const pushCoords = (coords: [number, number][][]) => {
        for (const ring of coords) {
          for (const [x, y] of ring) {
            boundLngs.push(x);
            boundLats.push(y);
            countyLngs.push(x);
            countyLats.push(y);
          }
        }
      };

      const countyFeatures = uniqueCounties.map((c) => {
        const cached = c.fips ? getCachedCountyGeometry(c.fips) : null;
        let geometry: CountyFeatureGeometry;
        if (cached) {
          geometry = cached;
          if (cached.type === 'Polygon') pushCoords(cached.coordinates);
          else for (const poly of cached.coordinates) pushCoords(poly);
        } else if (c.polygon && c.polygon.length >= 4) {
          const ring = closeRing(c.polygon.map((pt) => [pt[0], pt[1]] as [number, number]));
          geometry = { type: 'Polygon', coordinates: [ring] };
          pushCoords([ring]);
        } else if (c.bbox) {
          const ring = bboxRing(c.bbox);
          geometry = { type: 'Polygon', coordinates: [ring] };
          pushCoords([ring]);
        } else {
          const ring = closeRing(circleRing(c.lat, c.lng, 18));
          geometry = { type: 'Polygon', coordinates: [ring] };
          pushCoords([ring]);
        }

        return {
          type: 'Feature' as const,
          properties: {
            county: c.county,
            state: c.state,
            zip: c.zip,
            fips: c.fips ?? '',
          },
          geometry,
        };
      });

      const fitLngs = countyLngs.length > 0 ? countyLngs : boundLngs;
      const fitLats = countyLats.length > 0 ? countyLats : boundLats;
      const fit: [[number, number], [number, number]] | null =
        fitLngs.length > 0 && fitLats.length > 0
          ? [
              [Math.min(...fitLngs), Math.min(...fitLats)],
              [Math.max(...fitLngs), Math.max(...fitLats)],
            ]
          : null;

      paintRef.current = {
        radius: radiusFc,
        counties: { type: 'FeatureCollection', features: countyFeatures },
        fit,
        marker,
      };

      const map = mapRef.current;
      if (!mounted || !mapReady || !map) return;

      const radiusSource = map.getSource('svy-coverage-radius') as GeoJSONSource | undefined;
      const countySource = map.getSource('svy-coverage-counties') as GeoJSONSource | undefined;
      radiusSource?.setData(paintRef.current.radius);
      countySource?.setData(paintRef.current.counties);

      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled) return;
      if (paintRef.current.marker) {
        let existing = markerRef.current;
        if (!existing) {
          existing = new mapboxgl.Marker({ element: pinElement(), anchor: 'bottom' })
            .setLngLat(paintRef.current.marker)
            .addTo(map);
          markerRef.current = existing;
        } else {
          existing.setLngLat(paintRef.current.marker);
        }
      } else {
        markerRef.current?.remove();
        markerRef.current = null;
      }

      if (paintRef.current.fit) {
        map.resize();
        map.fitBounds(paintRef.current.fit, {
          padding: 48,
          duration: 650,
          maxZoom: uniqueCounties.length > 0 ? 8.5 : 11,
          pitch: 0,
          bearing: 0,
        });
      }
    }

    void paint();
    return () => {
      cancelled = true;
    };
  }, [mounted, mapReady, position, radius, uniqueCounties, showRadius]);

  const overlayAreas =
    areas.length > 0
      ? areas
      : uniqueCounties.map((c) => `${c.county}, ${c.state}`);

  if (!mounted) {
    return (
      <div className={`svy-coverage-map svy-coverage-map--loading${className ? ` ${className}` : ''}`}>
        Loading Mapbox…
      </div>
    );
  }

  if (!token) {
    return (
      <div className={`svy-coverage-map svy-coverage-map--loading${className ? ` ${className}` : ''}`}>
        Add NEXT_PUBLIC_MAPBOX_TOKEN to load Mapbox.
      </div>
    );
  }

  const hasCoverage = Boolean(position) || uniqueCounties.length > 0;

  return (
    <div className={`svy-coverage-map${hasCoverage ? ' has-pin' : ''}${className ? ` ${className}` : ''}`}>
      <div ref={shellRef} className="svy-coverage-map-canvas" />

      <div className="svy-coverage-map-overlay">
        {uniqueCounties.length > 0 ? (
          <div className="svy-coverage-map-chip">
            <span className="location-map-chip-dot" aria-hidden />
            <div>
              <strong>
                {uniqueCounties.length} count{uniqueCounties.length === 1 ? 'y' : 'ies'} covered
              </strong>
              <span>
                {showRadius && position
                  ? `${formatMilesFromKm(radius)} mi radius · ZIP coverage`
                  : 'ZIP / county coverage'}
              </span>
            </div>
          </div>
        ) : position && showRadius ? (
          <div className="svy-coverage-map-chip">
            <span className="location-map-chip-dot" aria-hidden />
            <div>
              <strong>{label ? shortLabel(label) : 'Base pin'}</strong>
              <span>{formatMilesFromKm(radius)} mi service radius</span>
            </div>
          </div>
        ) : (
          <div className="svy-coverage-map-empty">
            <MapPin size={14} />
            <span>Add a ZIP to preview covered counties</span>
          </div>
        )}

        {overlayAreas.length > 0 ? (
          <ul className="svy-coverage-map-areas">
            {overlayAreas.slice(0, 8).map((area) => (
              <li key={area}>{area}</li>
            ))}
            {overlayAreas.length > 8 ? <li>+{overlayAreas.length - 8}</li> : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
