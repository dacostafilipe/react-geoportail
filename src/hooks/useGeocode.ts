import { useState, useEffect, useCallback, useRef } from 'react';
import { lurefToLatLon } from '../utils/coordinates.ts';
import type { GeocodeQuery, LatLon } from '../types/index.ts';

const GEOCODE_URL = 'https://apiv3.geoportail.lu/geocode/search';

export interface GeocodeResultItem {
  latLon: LatLon;
  easting: number;
  northing: number;
  accuracy: number;
  street?: string;
  num?: string;
  zip?: string;
  locality?: string;
}

export type GeocodeState =
  | { status: 'idle'; results: null; error: null }
  | { status: 'loading'; results: null; error: null }
  | { status: 'success'; results: GeocodeResultItem[]; error: null }
  | { status: 'error'; results: null; error: Error };

/**
 * Hook for forward geocoding: search for a Luxembourg address and get coordinates.
 *
 * @example
 * const { state, search } = useGeocode();
 * search({ queryString: '1 rue du Fort Thüngen, Luxembourg' });
 * if (state.status === 'success') {
 *   const { lat, lon } = state.results[0].latLon;
 * }
 */
export function useGeocode() {
  const [state, setState] = useState<GeocodeState>({
    status: 'idle',
    results: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const search = useCallback(async (query: GeocodeQuery) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: 'loading', results: null, error: null });

    try {
      const url = new URL(GEOCODE_URL);

      if (query.queryString) {
        url.searchParams.set('queryString', query.queryString);
      } else {
        if (query.num) url.searchParams.set('num', query.num);
        if (query.street) url.searchParams.set('street', query.street);
        if (query.zip) url.searchParams.set('zip', query.zip);
        if (query.locality) url.searchParams.set('locality', query.locality);
      }

      const res = await fetch(url.toString(), { signal: controller.signal });

      if (!res.ok) {
        throw new Error(`Geocode request failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as {
        results?: Array<{
          easting: number;
          northing: number;
          accuracy?: number;
          AddressDetails?: {
            street?: string;
            number?: string;
            zip?: string;
            locality?: string;
          };
        }>;
      };

      const results: GeocodeResultItem[] = (data.results ?? []).map((r) => ({
        latLon: lurefToLatLon(r.easting, r.northing),
        easting: r.easting,
        northing: r.northing,
        accuracy: r.accuracy ?? 0,
        street: r.AddressDetails?.street,
        num: r.AddressDetails?.number,
        zip: r.AddressDetails?.zip,
        locality: r.AddressDetails?.locality,
      }));

      setState({ status: 'success', results, error: null });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setState({
        status: 'error',
        results: null,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle', results: null, error: null });
  }, []);

  return { state, search, reset };
}
