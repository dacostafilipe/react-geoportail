// Components
export { GeoportailMap } from './components/GeoportailMap.tsx';
export type { GeoportailMapProps, GeoportailMapHandle } from './components/GeoportailMap.tsx';

// Hooks
export { useLuxApi } from './hooks/useLuxApi.ts';
export type { LuxApiState } from './hooks/useLuxApi.ts';

export { useReverseGeocode } from './hooks/useReverseGeocode.ts';
export type { ReverseGeocodeState } from './hooks/useReverseGeocode.ts';

export { useGeocode } from './hooks/useGeocode.ts';
export type { GeocodeState, GeocodeResultItem } from './hooks/useGeocode.ts';

// Utilities (useful for consumers who need coordinate conversion)
export { latLonToLuref, lurefToLatLon } from './utils/coordinates.ts';
export { loadLuxApi } from './utils/loader.ts';

// Types
export type {
  LatLon,
  Address,
  GeocodeQuery,
  MapClickHandler,
  MarkerMode,
} from './types/index.ts';
