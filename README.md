# react-geoportail

> **Disclaimer:** This is an **unofficial, community-built** React package. It is not affiliated with, endorsed by, or supported by the [Geoportail Luxembourg](https://www.geoportail.lu) team or the Administration du Cadastre et de la Topographie (ACT). For the official API, see [apiv3.geoportail.lu](https://apiv3.geoportail.lu/proj/1.0/build/apidoc/).

An unofficial React SDK for the [Geoportail Luxembourg v3 API](https://apiv3.geoportail.lu/proj/1.0/build/apidoc/). Provides a map component and hooks for geocoding, all typed with TypeScript.

## Features

- **`<GeoportailMap>`** — render a Geoportail map with optional pin/marker support
- **`useReverseGeocode`** — look up a Luxembourg address from lat/lon coordinates
- **`useGeocode`** — search for coordinates from an address string
- Coordinate conversion utilities (EPSG:2169 ↔ WGS84) included
- Zero runtime npm dependencies — uses the official `apiv3loader.js` script

## Requirements

- React 17 or later
- A modern browser (the Geoportail API requires it)
- For **production deployments**: register your domain with ACT at `support.geoportail@act.etat.lu`. The API works without restriction on `localhost`.

## Installation

```bash
npm install @dacostafilipe/react-geoportail
```

The Geoportail API script (`apiv3.geoportail.lu/apiv3loader.js`) is injected automatically — no manual `<script>` tag needed.

## Quick start

```tsx
import { GeoportailMap } from '@dacostafilipe/react-geoportail';

export default function App() {
  return (
    <GeoportailMap
      center={{ lat: 49.6116, lon: 6.1319 }}
      zoom={13}
      style={{ height: 500 }}
    />
  );
}
```

---

## Components

### `<GeoportailMap>`

Renders a Geoportail map inside a `div`. The map fills its container — set a `height` via `style` or `className`.

```tsx
<GeoportailMap
  center={{ lat: 49.6116, lon: 6.1319 }}
  zoom={13}
  bgLayer="basemap_2015_global"
  markerMode="click"
  onMarkerPlace={(coords) => console.log(coords.lat, coords.lon)}
  style={{ height: 480 }}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `center` | `LatLon` | Luxembourg City | Initial map center |
| `zoom` | `number` | `12` | Initial zoom level (1–20) |
| `bgLayer` | `string` | `'basemap_2015_global'` | Background layer identifier |
| `markerMode` | `'none' \| 'fixed' \| 'click'` | `'none'` | Controls pin behaviour (see below) |
| `markerPosition` | `LatLon` | — | Pin position for `'fixed'` mode, or initial pin for `'click'` mode |
| `onMarkerPlace` | `(coords: LatLon) => void` | — | Called when the user places a pin (`markerMode='click'`) |
| `layers` | `number[]` | — | Additional Geoportail layer IDs to overlay |
| `className` | `string` | — | CSS class for the container `div` |
| `style` | `React.CSSProperties` | — | Inline styles for the container `div` |

#### Marker modes

| Mode | Behaviour |
|------|-----------|
| `'none'` | No marker shown |
| `'fixed'` | A static pin is shown at `markerPosition` |
| `'click'` | User clicks the map to place/move the pin; fires `onMarkerPlace` with the clicked WGS84 coordinates |

#### Imperative ref

Pass a `ref` typed as `GeoportailMapHandle` to control the map programmatically:

```tsx
import { useRef } from 'react';
import { GeoportailMap, GeoportailMapHandle } from '@dacostafilipe/react-geoportail';

const mapRef = useRef<GeoportailMapHandle>(null);

<GeoportailMap ref={mapRef} ... />

// Move the map
mapRef.current?.setCenter({ lat: 49.5, lon: 6.1 });
mapRef.current?.setZoom(15);

// Access the raw lux.Map instance
const luxMap = mapRef.current?.getLuxMap();
```

---

## Hooks

### `useReverseGeocode`

Convert a WGS84 lat/lon position to a Luxembourg address. Uses the Geoportail REST reverse geocode endpoint — no API key required.

```tsx
import { useReverseGeocode } from '@dacostafilipe/react-geoportail';

function LocationInfo({ lat, lon }: { lat: number; lon: number }) {
  const { state, lookup } = useReverseGeocode();

  useEffect(() => {
    lookup({ lat, lon });
  }, [lat, lon]);

  if (state.status === 'loading') return <p>Looking up address…</p>;
  if (state.status === 'error')   return <p>Error: {state.error.message}</p>;
  if (state.status === 'success') return <p>{state.address.label}</p>;
  return null;
}
```

#### Return value

```ts
const { state, lookup, reset } = useReverseGeocode();
```

| | Type | Description |
|-|------|-------------|
| `state.status` | `'idle' \| 'loading' \| 'success' \| 'error'` | Current state |
| `state.address` | `Address \| null` | Result when `status === 'success'` |
| `state.error` | `Error \| null` | Error when `status === 'error'` |
| `lookup(pos)` | `(pos: LatLon) => void` | Trigger a lookup; cancels any in-flight request |
| `reset()` | `() => void` | Return to `'idle'` and cancel any in-flight request |

#### `Address` shape

```ts
interface Address {
  label: string;    // Full formatted address
  distance: number; // Distance from queried point (metres)
  easting: number;  // EPSG:2169 easting
  northing: number; // EPSG:2169 northing
}
```

---

### `useGeocode`

Search for a Luxembourg address and get back coordinates. Supports a free-text query string or structured fields.

```tsx
import { useGeocode } from '@dacostafilipe/react-geoportail';

function AddressSearch() {
  const { state, search } = useGeocode();

  return (
    <>
      <button onClick={() => search({ queryString: 'Place d\'Armes, Luxembourg' })}>
        Search
      </button>

      {state.status === 'success' && state.results.map((r, i) => (
        <p key={i}>
          {r.street} {r.num}, {r.zip} {r.locality}
          — {r.latLon.lat.toFixed(5)}, {r.latLon.lon.toFixed(5)}
        </p>
      ))}
    </>
  );
}
```

#### Return value

```ts
const { state, search, reset } = useGeocode();
```

| | Type | Description |
|-|------|-------------|
| `state.status` | `'idle' \| 'loading' \| 'success' \| 'error'` | Current state |
| `state.results` | `GeocodeResultItem[] \| null` | Results when `status === 'success'` |
| `state.error` | `Error \| null` | Error when `status === 'error'` |
| `search(query)` | `(query: GeocodeQuery) => void` | Trigger a search; cancels any in-flight request |
| `reset()` | `() => void` | Return to `'idle'` |

#### `GeocodeQuery` options

```ts
// Free-text (recommended for most cases)
search({ queryString: '1 rue du Fort Thüngen, Luxembourg' });

// Structured fields
search({ num: '1', street: 'rue du Fort Thüngen', zip: '1499', locality: 'Luxembourg' });
```

#### `GeocodeResultItem` shape

```ts
interface GeocodeResultItem {
  latLon: LatLon;   // WGS84 { lat, lon }
  easting: number;  // EPSG:2169
  northing: number; // EPSG:2169
  accuracy: number;
  street?: string;
  num?: string;
  zip?: string;
  locality?: string;
}
```

---

## Coordinate utilities

The SDK exposes the internal coordinate conversion functions if you need them directly.

```ts
import { latLonToLuref, lurefToLatLon } from '@dacostafilipe/react-geoportail';

// WGS84 → EPSG:2169 (Luxembourg TM)
const { easting, northing } = latLonToLuref(49.6116, 6.1319);

// EPSG:2169 → WGS84
const { lat, lon } = lurefToLatLon(76651, 75358);
```

Accuracy is within ~1 m across Luxembourg's territory, using a Molodensky transformation (WGS84 → ED50) followed by a Transverse Mercator projection with the official LUREF parameters.

---

## Development

```bash
# Install dependencies
npm install

# Start the demo app (Vite dev server)
npm run dev

# Type-check
npm run type-check

# Build the library (outputs to dist/)
npm run build
```

The demo app (`src/demo/main.tsx`) shows all three features together: map with click-to-pin, reverse geocoding on pin placement, and an address search bar.

---

## API reference

- [Geoportail Luxembourg API v3 JSDoc](https://apiv3.geoportail.lu/proj/1.0/build/apidoc/)
- [REST API wiki](https://wiki.geoportail.lu/doku.php?id=en:api:rest)
- [Official API examples](https://apiv3.geoportail.lu/proj/1.0/build/apidoc/examples/)

## License

MIT
