import { useState, useEffect, useCallback, useRef } from 'react';
import { latLonToLuref } from '../utils/coordinates.ts';
import type { LatLon, Address } from '../types/index.ts';

const REVERSE_GEOCODE_URL = 'https://api.geoportail.lu/geocoder/reverseGeocode';

export type ReverseGeocodeState =
  | { status: 'idle'; address: null; error: null }
  | { status: 'loading'; address: null; error: null }
  | { status: 'success'; address: Address; error: null }
  | { status: 'error'; address: null; error: Error };

/**
 * Hook for reverse geocoding: convert a WGS84 lat/lon to a Luxembourg address.
 *
 * Uses the Geoportail REST reverse geocode endpoint — no API key required.
 *
 * @example
 * const { state, lookup } = useReverseGeocode();
 * // ...
 * lookup({ lat: 49.6116, lon: 6.1319 });
 * if (state.status === 'success') console.log(state.address.label);
 */
export function useReverseGeocode() {
  const [state, setState] = useState<ReverseGeocodeState>({
    status: 'idle',
    address: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const lookup = useCallback(async (position: LatLon) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: 'loading', address: null, error: null });

    try {
      const { easting, northing } = latLonToLuref(position.lat, position.lon);

      const url = new URL(REVERSE_GEOCODE_URL);
      url.searchParams.set('easting', String(easting));
      url.searchParams.set('northing', String(northing));

      const res = await fetch(url.toString(), { signal: controller.signal });

      if (!res.ok) {
        throw new Error(`Reverse geocode request failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as {
        results?: Array<{
          easting: number;
          northing: number;
          name?: string;
          distance?: number;
        }>;
      };

      const first = data.results?.[0];
      if (!first) {
        throw new Error('No results returned for this position');
      }

      setState({
        status: 'success',
        address: {
          label: first.name ?? '',
          distance: first.distance ?? 0,
          easting: first.easting,
          northing: first.northing,
        },
        error: null,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setState({
        status: 'error',
        address: null,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle', address: null, error: null });
  }, []);

  return { state, lookup, reset };
}
