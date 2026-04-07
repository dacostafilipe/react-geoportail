import { useState, useEffect } from 'react';
import { loadLuxApi } from '../utils/loader.ts';
import type { LuxNamespace } from '../types/lux.d.ts';

export type LuxApiState =
  | { status: 'loading'; lux: null; error: null }
  | { status: 'ready'; lux: LuxNamespace; error: null }
  | { status: 'error'; lux: null; error: Error };

/**
 * Loads the Geoportail apiv3 script and returns the `lux` namespace once ready.
 * Deduplicates the script load — safe to call from multiple components.
 */
export function useLuxApi(): LuxApiState {
  const [state, setState] = useState<LuxApiState>({
    status: 'loading',
    lux: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    loadLuxApi()
      .then(() => {
        if (!cancelled) {
          setState({ status: 'ready', lux: window.lux!, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            lux: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
