import { useState, useEffect, useCallback, useRef } from 'react';
import type { LatLon, Address } from '../types';

const REVERSE_GEOCODE_URL = 'https://apiv3.geoportail.lu/geocode/reverse';

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
      const url = new URL(REVERSE_GEOCODE_URL);
      url.searchParams.set('lat', String(position.lat));
      url.searchParams.set('lon', String(position.lon));

      const res = await fetch(url.toString(), { signal: controller.signal });

      if (!res.ok) {
        throw new Error(`Reverse geocode request failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as {
        count?: number;
        results?: Array<{
          number?: string;
          street?: string;
          postal_code?: string;
          locality?: string;
          distance?: number;
          geom?: {
            coordinates?: [number, number];
          };
        }>;
      };

      const first = data.results?.[0];
      if (!first) {
        throw new Error('No results returned for this position');
      }

      const label = [
        [first.number, first.street].filter(Boolean).join(' ').trim(),
        [first.postal_code, first.locality].filter(Boolean).join(' ').trim(),
      ].filter(Boolean).join(', ');

      const [easting, northing] = first.geom?.coordinates ?? [0, 0];

      setState({
        status: 'success',
        address: {
          label,
          distance: first.distance ?? 0,
          easting,
          northing,
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
