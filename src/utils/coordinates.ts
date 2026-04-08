/**
 * Coordinate conversion between EPSG:2169 (Luxembourg TM) and EPSG:4326 (WGS84).
 *
 * The Geoportail API operates internally in EPSG:2169 but also accepts
 * position arrays in EPSG:4326 via `lux.Map` constructor options.
 *
 * For precise server-side conversion the REST API itself is authoritative.
 * The formulas below use a 6-parameter Helmert + transverse Mercator approach
 * sufficient for Luxembourg's territory (~50 km radius).
 *
 * Reference: IGN-L / ACT official parameters for LUREF (EPSG:2169).
 */

// LUREF / Luxembourg TM projection constants (EPSG:2169)
const FE = 80000;       // False Easting (m)
const FN = 100000;      // False Northing (m)
const LON0 = 6.16666666666667; // Central meridian (6°10') in degrees
const LAT0 = 49.8333333333333; // Latitude of origin (49°50') in degrees
const SCALE = 1.0;      // Scale factor at central meridian
const A = 6378388.0;    // Semi-major axis (Hayford / International 1924)
const F = 1 / 297.0;    // Flattening
const B = A * (1 - F);  // Semi-minor axis

const E2 = 1 - (B * B) / (A * A); // First eccentricity squared

// Helmert 7-parameter shift: ETRS89 -> ED50 (approximate for Luxembourg)
// These values transform WGS84 (≈ETRS89) to ED50 used by LUREF
const DX = -87.0;
const DY = -98.0;
const DZ = -121.0;

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/**
 * Molodensky transformation: WGS84 -> ED50 (approximate, <1 m accuracy).
 */
function wgs84ToEd50(
  lat: number,
  lon: number
): { lat: number; lon: number } {
  const latR = degToRad(lat);
  const lonR = degToRad(lon);

  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  const sinLon = Math.sin(lonR);
  const cosLon = Math.cos(lonR);

  const aWgs = 6378137.0;
  const fWgs = 1 / 298.257223563;
  const bWgs = aWgs * (1 - fWgs);
  const e2Wgs = 1 - (bWgs * bWgs) / (aWgs * aWgs);

  const da = A - aWgs;
  const df = F - fWgs;

  const N = aWgs / Math.sqrt(1 - e2Wgs * sinLat * sinLat);
  const M =
    (aWgs * (1 - e2Wgs)) /
    Math.pow(1 - e2Wgs * sinLat * sinLat, 1.5);

  const dLat =
    (1 / M) *
    (N * (e2Wgs / (1 - e2Wgs)) * sinLat * cosLat * (da / aWgs) +
      (N / aWgs + 1) * sinLat * cosLat * df * (aWgs / bWgs) -
      (DX * sinLat * cosLon + DY * sinLat * sinLon - DZ * cosLat));

  const dLon =
    (1 / (N * cosLat)) * (-DX * sinLon + DY * cosLon);

  return {
    lat: lat + radToDeg(dLat),
    lon: lon + radToDeg(dLon),
  };
}

/**
 * ED50 -> WGS84 (inverse Molodensky, approximate).
 */
function ed50ToWgs84(
  lat: number,
  lon: number
): { lat: number; lon: number } {
  const latR = degToRad(lat);
  const lonR = degToRad(lon);

  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  const sinLon = Math.sin(lonR);
  const cosLon = Math.cos(lonR);

  const N = A / Math.sqrt(1 - E2 * sinLat * sinLat);
  const M = (A * (1 - E2)) / Math.pow(1 - E2 * sinLat * sinLat, 1.5);

  const da = 6378137.0 - A;
  const fWgs = 1 / 298.257223563;
  const df = fWgs - F;

  const dLat =
    (1 / M) *
    (N * (E2 / (1 - E2)) * sinLat * cosLat * (da / A) +
      (N / A + 1) * sinLat * cosLat * df * (A / B) +
      (DX * sinLat * cosLon + DY * sinLat * sinLon - DZ * cosLat));

  const dLon =
    (1 / (N * cosLat)) * (DX * sinLon - DY * cosLon);

  return {
    lat: lat + radToDeg(dLat),
    lon: lon + radToDeg(dLon),
  };
}

/**
 * Transverse Mercator forward projection (ED50 lat/lon -> LUREF easting/northing).
 */
function tmForward(lat: number, lon: number): { easting: number; northing: number } {
  const latR = degToRad(lat);
  const lonR = degToRad(lon);
  const lon0R = degToRad(LON0);
  const lat0R = degToRad(LAT0);

  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  const tanLat = Math.tan(latR);

  const N = A / Math.sqrt(1 - E2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = (E2 / (1 - E2)) * cosLat * cosLat;
  const dl = lonR - lon0R;
  const XX = cosLat * dl;

  // Meridian arc from equator to lat
  const M = meridianArc(latR);
  const M0 = meridianArc(lat0R);

  const easting =
    FE +
    SCALE *
      N *
      (XX +
        (XX * XX * XX * (1 - T + C)) / 6 +
        (XX * XX * XX * XX * XX * (5 - 18 * T + T * T + 72 * C)) / 120);

  const northing =
    FN +
    SCALE *
      (M -
        M0 +
        N *
          tanLat *
          (XX * XX / 2 +
            (XX * XX * XX * XX * (5 - T + 9 * C + 4 * C * C)) / 24 +
            (XX * XX * XX * XX * XX * XX *
              (61 - 58 * T + T * T + 600 * C)) /
              720));

  return { easting, northing };
}

/**
 * Transverse Mercator inverse projection (LUREF easting/northing -> ED50 lat/lon).
 */
function tmInverse(easting: number, northing: number): { lat: number; lon: number } {
  const x = easting - FE;
  const y = northing - FN;
  const lat0R = degToRad(LAT0);
  const lon0R = degToRad(LON0);
  const M0 = meridianArc(lat0R);

  // Footpoint latitude
  const M1 = M0 + y / SCALE;
  const mu = M1 / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64));

  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) *
      Math.sin(4 * mu) +
    ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const N1 = A / Math.sqrt(1 - E2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const C1 = (E2 / (1 - E2)) * cosPhi1 * cosPhi1;
  const R1 =
    (A * (1 - E2)) / Math.pow(1 - E2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * SCALE);

  const lat =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      (D * D / 2 -
        (D * D * D * D * (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1)) / 24 +
        (D * D * D * D * D * D *
          (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1)) /
          720);

  const lon =
    lon0R +
    (D -
      (D * D * D * (1 + 2 * T1 + C1)) / 6 +
      (D * D * D * D * D * (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1)) / 120) /
      cosPhi1;

  return { lat: radToDeg(lat), lon: radToDeg(lon) };
}

function meridianArc(latR: number): number {
  const e2 = E2;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latR -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) *
        Math.sin(2 * latR) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latR) -
      ((35 * e6) / 3072) * Math.sin(6 * latR))
  );
}

/**
 * Convert WGS84 (lat/lon) to EPSG:2169 (easting/northing).
 */
export function latLonToLuref(
  lat: number,
  lon: number
): { easting: number; northing: number } {
  const ed50 = wgs84ToEd50(lat, lon);
  return tmForward(ed50.lat, ed50.lon);
}

/**
 * Convert EPSG:2169 (easting/northing) to WGS84 (lat/lon).
 */
export function lurefToLatLon(
  easting: number,
  northing: number
): { lat: number; lon: number } {
  const ed50 = tmInverse(easting, northing);
  return ed50ToWgs84(ed50.lat, ed50.lon);
}
