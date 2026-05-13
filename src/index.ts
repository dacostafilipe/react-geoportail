// Components
export { GeoportailMap } from './components/GeoportailMap';
export type { GeoportailMapProps, GeoportailMapHandle } from './components/GeoportailMap';

// Hooks
export { useLuxApi } from './hooks/useLuxApi';
export type { LuxApiState } from './hooks/useLuxApi';

export { useReverseGeocode } from './hooks/useReverseGeocode';
export type { ReverseGeocodeState } from './hooks/useReverseGeocode';

export { useGeocode } from './hooks/useGeocode';
export type { GeocodeState, GeocodeResultItem } from './hooks/useGeocode';

// Utilities (useful for consumers who need coordinate conversion)
export { latLonToLuref, lurefToLatLon } from './utils/coordinates';
export { loadLuxApi } from './utils/loader';

// Types
export type {
  LatLon,
  Address,
  GeocodeQuery,
  MapClickHandler,
  MarkerMode,
} from './types';
