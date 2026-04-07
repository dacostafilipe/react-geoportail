/**
 * TypeScript declarations for the Geoportail Luxembourg lux API (v3).
 * Loaded dynamically via //apiv3.geoportail.lu/apiv3loader.js
 */

export interface LuxCoordinate {
  /** X coordinate in EPSG:2169 (Luxembourg TM) */
  easting: number;
  /** Y coordinate in EPSG:2169 (Luxembourg TM) */
  northing: number;
}

export interface LuxPosition {
  /** Longitude in WGS84 (EPSG:4326) */
  lon: number;
  /** Latitude in WGS84 (EPSG:4326) */
  lat: number;
}

export interface GeocodeResult {
  easting: number;
  northing: number;
  accuracy: number;
  street?: string;
  num?: string;
  zip?: string;
  locality?: string;
  country?: string;
}

export interface ReverseGeocodeResult {
  easting: number;
  northing: number;
  name: string;
  distance: number;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
  success: boolean;
}

export interface ReverseGeocodeResponse {
  results: ReverseGeocodeResult[];
  success: boolean;
}

export interface LuxMapOptions {
  /** DOM element ID or HTMLElement to render the map into */
  target: string | HTMLElement;
  /** Background layer identifier (e.g. 'basemap_2015_global') */
  bgLayer?: string;
  /** Initial zoom level */
  zoom?: number;
  /** Initial position as [lon, lat] in EPSG:4326 or [x, y] in EPSG:2169 */
  position?: [number, number];
  /** Additional layer IDs to add on top of the background */
  layers?: (number | string)[];
  layerOpacities?: number[];
  layerVisibilities?: boolean[];
}

export interface LuxMapInstance {
  getTarget(): HTMLElement;
  getLayers(): unknown;
  addLayerToMap(layerId: number | string, opacity?: number, visible?: boolean): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  un(event: string, handler: (...args: unknown[]) => void): void;
  getView(): {
    getCenter(): [number, number];
    getZoom(): number;
    setCenter(center: [number, number]): void;
    setZoom(zoom: number): void;
  };
}

export interface LuxGeocoderInstance {
  geocode(
    params: {
      queryString?: string;
      num?: string;
      street?: string;
      zip?: string;
      locality?: string;
    },
    callback: (success: boolean, response: GeocodeResponse) => void
  ): void;

  reversegeocode(
    params: LuxCoordinate,
    callback: (success: boolean, response: ReverseGeocodeResponse) => void
  ): void;
}

/** Global lux namespace injected by apiv3loader.js */
export interface LuxNamespace {
  Map: new (options: LuxMapOptions) => LuxMapInstance;
  Geocoder: new () => LuxGeocoderInstance;
}

declare global {
  interface Window {
    lux?: LuxNamespace;
  }
}
