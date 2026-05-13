import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { useLuxApi } from '../hooks/useLuxApi';
import { lurefToLatLon, latLonToLuref } from '../utils/coordinates';
import type { LatLon, MapClickHandler, MarkerMode } from '../types';
import type { LuxMapInstance } from '../types/lux';

const DEFAULT_CLICK_SOURCE_PROJECTION = 'EPSG:3857';
const OVERLAY_PROJECTION = 'EPSG:3857';
const WGS84_PROJECTION = 'EPSG:4326';
const LUREF_PROJECTION = 'EPSG:2169';

export interface GeoportailMapProps {
  /**
   * Initial center of the map.
   * Defaults to Luxembourg City (lat: 49.6116, lon: 6.1319).
   */
  center?: LatLon;

  /** Initial zoom level (1–20). Default: 12 */
  zoom?: number;

  /**
   * Background layer identifier.
   * Default: 'basemap_2015_global'
   */
  bgLayer?: string;

  /**
   * Controls pin/marker behaviour:
   * - 'none'  — no marker
   * - 'fixed' — show a marker at `markerPosition` (does not move on click)
   * - 'click' — user clicks map to place/move the pin; fires `onMarkerPlace`
   *
   * Default: 'none'
   */
  markerMode?: MarkerMode;

  /**
   * Position of the marker when `markerMode` is 'fixed' or to pre-set an
   * initial pin when `markerMode` is 'click'.
   */
  markerPosition?: LatLon;

  /**
   * Called whenever the user places a pin (markerMode === 'click').
   * Receives the WGS84 lat/lon of the clicked point.
   */
  onMarkerPlace?: MapClickHandler;

  /** CSS class applied to the map container div */
  className?: string;

  /** Inline styles for the map container div */
  style?: React.CSSProperties;

  /** Additional numeric layer IDs to add on top of the background */
  layers?: number[];
}

export interface GeoportailMapHandle {
  /** Returns the underlying lux.Map instance (or null before ready) */
  getLuxMap(): LuxMapInstance | null;
  /** Programmatically move the map center */
  setCenter(coords: LatLon): void;
  /** Programmatically set zoom */
  setZoom(zoom: number): void;
}

const LUXEMBOURG_CITY: LatLon = { lat: 49.6116, lon: 6.1319 };
const DEFAULT_BG_LAYER = 'basemap_2015_global';

/**
 * Renders a Geoportail Luxembourg map inside a React component.
 *
 * Expose a ref (`GeoportailMapHandle`) to access the underlying lux.Map instance
 * or imperatively control the view.
 */
export const GeoportailMap = forwardRef<GeoportailMapHandle, GeoportailMapProps>(
  function GeoportailMap(
    {
      center,
      zoom = 12,
      bgLayer = DEFAULT_BG_LAYER,
      markerMode = 'none',
      markerPosition,
      onMarkerPlace,
      className,
      style,
      layers,
    },
    ref
  ) {
    const luxApi = useLuxApi();
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LuxMapInstance | null>(null);
    const markerLayerRef = useRef<unknown>(null);
    const clickListenerRef = useRef<((...args: unknown[]) => void) | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    // Keep stable refs to callbacks so effects don't re-run on every render
    const onMarkerPlaceRef = useRef(onMarkerPlace);
    onMarkerPlaceRef.current = onMarkerPlace;
    const initialCenter = resolveInitialCenter(center, markerMode, markerPosition);

    // ------------------------------------------------------------------ map init
    useEffect(() => {
      if (luxApi.status !== 'ready') return;
      if (!mapContainerRef.current) return;

      let cancelled = false;
      const lux = luxApi.lux;
      const { easting, northing } = latLonToLuref(initialCenter.lat, initialCenter.lon);

      const mapInstance = new lux.Map({
        target: mapContainerRef.current,
        bgLayer,
        zoom,
        position: [easting, northing],
        ...(layers && layers.length > 0
          ? { layers, layerOpacities: layers.map(() => 1) }
          : {}),
      });

      mapRef.current = mapInstance;
      setIsMapReady(false);

      const readyPromise = mapInstance.getMapReadyPromise?.() ?? Promise.resolve();
      void readyPromise.then(() => {
        if (!cancelled) {
          setIsMapReady(true);
        }
      });

      return () => {
        cancelled = true;
        // lux.Map does not expose a destroy(); we clear our references
        mapRef.current = null;
        markerLayerRef.current = null;
        clickListenerRef.current = null;
        setIsMapReady(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [luxApi.status]);

    // ------------------------------------------------------------------ marker position
    useEffect(() => {
      const map = mapRef.current;
      if (!map || luxApi.status !== 'ready' || !isMapReady) return;

      const displayPosition = resolveDisplayMarkerPosition(
        markerMode,
        markerPosition,
        center ?? LUXEMBOURG_CITY
      );

      if (!displayPosition) {
        clearMarker(markerLayerRef);
        return;
      }

      setMarkerPosition(map, displayPosition, markerLayerRef);
    }, [
      isMapReady,
      luxApi.status,
      markerMode,
      markerPosition?.lat,
      markerPosition?.lon,
      center?.lat,
      center?.lon,
    ]);

    // ------------------------------------------------------------------ click listener
    useEffect(() => {
      const map = mapRef.current;
      if (!map || luxApi.status !== 'ready' || !isMapReady) return;

      // Remove previous click listener
      if (clickListenerRef.current) {
        map.un('singleclick', clickListenerRef.current);
        clickListenerRef.current = null;
      }

      if (markerMode !== 'click') {
        return;
      }

      const handler = (...args: unknown[]) => {
        // Raw OpenLayers click coordinates are in the map view projection, not WGS84/LUREF.
        const evt = args[0] as { coordinate?: [number, number] };
        if (!evt.coordinate) return;

        const latLon = convertMapClickCoordinateToLatLon(map, evt.coordinate);
        setMarkerCoordinate(map, evt.coordinate, latLon, markerLayerRef);
        onMarkerPlaceRef.current?.(latLon);
      };

      clickListenerRef.current = handler;
      map.on('singleclick', handler);

      return () => {
        if (clickListenerRef.current) {
          map.un('singleclick', clickListenerRef.current);
          clickListenerRef.current = null;
        }
      };
    }, [
      isMapReady,
      luxApi.status,
      markerMode,
    ]);

    // ------------------------------------------------------------------ imperative handle
    useImperativeHandle(ref, () => ({
      getLuxMap: () => mapRef.current,
      setCenter(coords: LatLon) {
        const map = mapRef.current;
        if (!map) return;
        const { easting, northing } = latLonToLuref(coords.lat, coords.lon);
        if (map.setCenter) {
          map.setCenter([easting, northing], undefined, LUREF_PROJECTION);
          return;
        }
        map.getView().setCenter(convertLatLonToMarkerCoordinate(coords));
      },
      setZoom(z: number) {
        mapRef.current?.getView().setZoom(z);
      },
    }));

    // ------------------------------------------------------------------ render
    if (luxApi.status === 'error') {
      return (
        <div
          className={className}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', ...style }}
        >
          <span style={{ color: '#c00' }}>
            Failed to load Geoportail API: {luxApi.error.message}
          </span>
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', ...style }} className={className}>
        {luxApi.status === 'loading' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.7)',
              zIndex: 10,
            }}
          >
            <span>Loading map…</span>
          </div>
        )}
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
);

// ------------------------------------------------------------------ helpers

/**
 * Place/move an SVG pin marker on the map.
 * lux.Map is built on OpenLayers 3 — overlays must use the view projection.
 */
export function setMarkerPosition(
  map: LuxMapInstance,
  position: LatLon,
  layerRef: React.MutableRefObject<unknown>
): void {
  const overlay = ensureMarkerOverlay(map, position, layerRef);
  if (!overlay) return;

  overlay.setPosition(convertLatLonToMarkerCoordinate(position));
}

export function setMarkerCoordinate(
  map: LuxMapInstance,
  coordinate: [number, number],
  position: LatLon,
  layerRef: React.MutableRefObject<unknown>
): void {
  const overlay = ensureMarkerOverlay(map, position, layerRef);
  if (!overlay) return;
  overlay.setPosition(coordinate);
}

export function clearMarker(
  layerRef: React.MutableRefObject<unknown>
): void {
  if (!layerRef.current) return;
  // Hide the existing overlay instead of discarding it so future updates can reuse it.
  (layerRef.current as OlOverlay).setPosition(undefined);
}

export function ensureMarkerOverlay(
  map: LuxMapInstance,
  _position: LatLon,
  layerRef: React.MutableRefObject<unknown>
): OlOverlay | null {
  if (layerRef.current) {
    return layerRef.current as OlOverlay;
  }

  const ol = (window as unknown as { ol?: OlLike }).ol;
  if (!ol) return null;

  const el = document.createElement('div');
  el.innerHTML = PIN_SVG;
  el.style.cssText =
    'cursor:pointer;line-height:0;display:block;';

  const overlay = new ol.Overlay({
    element: el,
    positioning: 'bottom-center',
    stopEvent: false,
  });

  (map as unknown as { addOverlay(o: OlOverlay): void }).addOverlay(overlay);
  layerRef.current = overlay;
  return overlay;
}

export function convertLatLonToMarkerCoordinate(
  position: LatLon
): [number, number] {
  const ol = (window as unknown as { ol?: OlLike }).ol;
  const transform = ol?.proj?.transform;

  if (!transform) {
    const { easting, northing } = latLonToLuref(position.lat, position.lon);
    return [easting, northing];
  }

  return transform([position.lon, position.lat], WGS84_PROJECTION, OVERLAY_PROJECTION);
}

export function resolveDisplayMarkerPosition(
  markerMode: MarkerMode,
  markerPosition: LatLon | undefined,
  center: LatLon
): LatLon | undefined {
  if (markerMode === 'none') {
    return undefined;
  }

  if (markerPosition) {
    return markerPosition;
  }

  return markerMode === 'fixed' ? center : undefined;
}

export function resolveInitialCenter(
  center: LatLon | undefined,
  markerMode: MarkerMode,
  markerPosition: LatLon | undefined
): LatLon {
  if (markerPosition && markerMode !== 'none') {
    return markerPosition;
  }

  return center ?? LUXEMBOURG_CITY;
}

// Minimal pin SVG (red teardrop, 30×40)
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
  <path d="M15 0C7.268 0 1 6.268 1 14c0 10.5 14 26 14 26S29 24.5 29 14C29 6.268 22.732 0 15 0z"
    fill="#e53935" stroke="#b71c1c" stroke-width="1.5"/>
  <circle cx="15" cy="14" r="5" fill="white"/>
</svg>`;

// Minimal OL type stubs used only within this file
interface OlOverlay {
  setPosition(pos: [number, number] | undefined): void;
}

interface OlLike {
  proj?: {
    transform(
      coordinate: [number, number],
      source: string,
      destination: string
    ): [number, number];
  };
  Overlay: new (opts: { element: HTMLElement; positioning: string; stopEvent: boolean }) => OlOverlay;
}

export function convertMapClickCoordinateToLatLon(
  _map: LuxMapInstance,
  coordinate: [number, number]
): LatLon {
  const ol = (window as unknown as { ol?: OlLike }).ol;
  const transform = ol?.proj?.transform;

  if (!transform) {
    const [easting, northing] = coordinate;
    return lurefToLatLon(easting, northing);
  }

  const [lon, lat] = transform(coordinate, DEFAULT_CLICK_SOURCE_PROJECTION, WGS84_PROJECTION);
  return { lat, lon };
}
