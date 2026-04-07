export type {
  LuxCoordinate,
  LuxPosition,
  GeocodeResult,
  ReverseGeocodeResult,
  GeocodeResponse,
  ReverseGeocodeResponse,
  LuxMapOptions,
  LuxMapInstance,
  LuxGeocoderInstance,
  LuxNamespace,
} from './lux.d.ts';

/** WGS84 lat/lon coordinate */
export interface LatLon {
  lat: number;
  lon: number;
}

/** Address returned by reverse geocoding */
export interface Address {
  /** Full formatted address string */
  label: string;
  /** Raw distance from the queried point (meters) */
  distance: number;
  /** Easting in EPSG:2169 */
  easting: number;
  /** Northing in EPSG:2169 */
  northing: number;
}

/** Search parameters for forward geocoding */
export interface GeocodeQuery {
  /** Full address as a single string (use this OR individual fields) */
  queryString?: string;
  num?: string;
  street?: string;
  zip?: string;
  locality?: string;
}

export type MapClickHandler = (coords: LatLon) => void;

export type MarkerMode = 'none' | 'fixed' | 'click';
