import React, {
  useEffect,
  useRef,
  useId,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useLuxApi } from '../hooks/useLuxApi.ts';
import { lurefToLatLon, latLonToLuref } from '../utils/coordinates.ts';
import type { LatLon, MapClickHandler, MarkerMode } from '../types/index.ts';
import type { LuxMapInstance } from '../types/lux.d.ts';

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
      center = LUXEMBOURG_CITY,
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
    const generatedId = useId();
    // useId produces ":r0:" style strings — strip colons for valid DOM id
    const mapId = `gp-map-${generatedId.replace(/:/g, '')}`;

    const luxApi = useLuxApi();
    const mapRef = useRef<LuxMapInstance | null>(null);
    const markerLayerRef = useRef<unknown>(null);
    const clickListenerRef = useRef<((...args: unknown[]) => void) | null>(null);

    // Keep stable refs to callbacks so effects don't re-run on every render
    const onMarkerPlaceRef = useRef(onMarkerPlace);
    onMarkerPlaceRef.current = onMarkerPlace;

    // ------------------------------------------------------------------ map init
    useEffect(() => {
      if (luxApi.status !== 'ready') return;

      const lux = luxApi.lux;
      const { easting, northing } = latLonToLuref(center.lat, center.lon);

      const mapInstance = new lux.Map({
        target: mapId,
        bgLayer,
        zoom,
        position: [easting, northing],
        ...(layers && layers.length > 0
          ? { layers, layerOpacities: layers.map(() => 1) }
          : {}),
      });

      mapRef.current = mapInstance;

      return () => {
        // lux.Map does not expose a destroy(); we clear our references
        mapRef.current = null;
        markerLayerRef.current = null;
        clickListenerRef.current = null;
      };
      // Only re-run when the API becomes ready or the map target changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [luxApi.status, mapId]);

    // ------------------------------------------------------------------ marker
    useEffect(() => {
      const map = mapRef.current;
      if (!map || luxApi.status !== 'ready') return;

      // Remove previous click listener
      if (clickListenerRef.current) {
        map.un('singleclick', clickListenerRef.current);
        clickListenerRef.current = null;
      }

      if (markerMode === 'none') {
        clearMarker(map, markerLayerRef);
        return;
      }

      const initialPos = markerPosition ?? (markerMode === 'fixed' ? center : undefined);
      if (initialPos) {
        placeMarker(map, initialPos, markerLayerRef);
      }

      if (markerMode === 'click') {
        const handler = (...args: unknown[]) => {
          // OpenLayers MapBrowserEvent — coordinate is in map projection (EPSG:2169)
          const evt = args[0] as { coordinate?: [number, number] };
          if (!evt.coordinate) return;

          const [e, n] = evt.coordinate;
          const latLon = lurefToLatLon(e, n);
          placeMarker(map, latLon, markerLayerRef);
          onMarkerPlaceRef.current?.(latLon);
        };

        clickListenerRef.current = handler;
        map.on('singleclick', handler);
      }
    }, [
      luxApi.status,
      markerMode,
      markerPosition?.lat,
      markerPosition?.lon,
      center.lat,
      center.lon,
    ]);

    // ------------------------------------------------------------------ imperative handle
    useImperativeHandle(ref, () => ({
      getLuxMap: () => mapRef.current,
      setCenter(coords: LatLon) {
        const map = mapRef.current;
        if (!map) return;
        const { easting, northing } = latLonToLuref(coords.lat, coords.lon);
        map.getView().setCenter([easting, northing]);
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
          id={mapId}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
);

// ------------------------------------------------------------------ helpers

/**
 * Place/move an SVG pin marker on the map.
 * lux.Map is built on OpenLayers 3 — we use ol.Overlay for the marker.
 */
function placeMarker(
  map: LuxMapInstance,
  position: LatLon,
  layerRef: React.MutableRefObject<unknown>
): void {
  // Prefer ol (OpenLayers global) if available
  const ol = (window as unknown as { ol?: OlLike }).ol;
  if (!ol) return;

  const { easting, northing } = latLonToLuref(position.lat, position.lon);

  // Reuse existing overlay or create a new one
  if (layerRef.current) {
    const overlay = layerRef.current as OlOverlay;
    overlay.setPosition([easting, northing]);
    return;
  }

  const el = document.createElement('div');
  el.innerHTML = PIN_SVG;
  el.style.cssText =
    'cursor:pointer;transform:translate(-50%,-100%);line-height:0;';

  const overlay = new ol.Overlay({
    element: el,
    positioning: 'bottom-center',
    stopEvent: false,
  });

  overlay.setPosition([easting, northing]);
  (map as unknown as { addOverlay(o: OlOverlay): void }).addOverlay(overlay);
  layerRef.current = overlay;
}

function clearMarker(
  _map: LuxMapInstance,
  layerRef: React.MutableRefObject<unknown>
): void {
  if (!layerRef.current) return;
  const ol = (window as unknown as { ol?: OlLike }).ol;
  if (!ol) return;
  // Overlay doesn't have a built-in remove on the overlay itself;
  // set position to undefined to hide it
  (layerRef.current as OlOverlay).setPosition(undefined);
  layerRef.current = null;
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
  Overlay: new (opts: { element: HTMLElement; positioning: string; stopEvent: boolean }) => OlOverlay;
}
