import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GeoportailMap } from '../components/GeoportailMap.tsx';
import { useReverseGeocode } from '../hooks/useReverseGeocode.ts';
import { useGeocode } from '../hooks/useGeocode.ts';
import type { LatLon } from '../types/index.ts';
import type { GeoportailMapHandle } from '../components/GeoportailMap.tsx';

function App() {
  const mapRef = useRef<GeoportailMapHandle>(null);
  const [clickedPos, setClickedPos] = useState<LatLon | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { state: reverseState, lookup } = useReverseGeocode();
  const { state: geocodeState, search } = useGeocode();

  function handleMarkerPlace(coords: LatLon) {
    setClickedPos(coords);
    lookup(coords);
  }

  function handleGeocode(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    search({ queryString: searchQuery });
  }

  function jumpToResult(lat: number, lon: number) {
    mapRef.current?.setCenter({ lat, lon });
    mapRef.current?.setZoom(16);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>react-geoportail SDK demo</h1>

      {/* Geocode search */}
      <form onSubmit={handleGeocode} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search address in Luxembourg…"
          style={{ flex: 1, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button type="submit" style={{ padding: '6px 16px' }}>Search</button>
      </form>

      {geocodeState.status === 'success' && geocodeState.results.length > 0 && (
        <ul style={{ margin: '0 0 12px', padding: 0, listStyle: 'none', background: '#f8f8f8', borderRadius: 4 }}>
          {geocodeState.results.slice(0, 5).map((r, i) => (
            <li key={i} style={{ padding: '6px 10px', borderBottom: '1px solid #eee' }}>
              <button
                onClick={() => jumpToResult(r.latLon.lat, r.latLon.lon)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: '#1565c0' }}
              >
                {[r.num, r.street, r.zip, r.locality].filter(Boolean).join(', ')}
              </button>
              <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
                ({r.latLon.lat.toFixed(5)}, {r.latLon.lon.toFixed(5)})
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Map */}
      <GeoportailMap
        ref={mapRef}
        center={{ lat: 49.6116, lon: 6.1319 }}
        zoom={13}
        markerMode="click"
        onMarkerPlace={handleMarkerPlace}
        style={{ height: 480, border: '1px solid #ccc', borderRadius: 4 }}
      />

      <p style={{ marginTop: 8, color: '#555', fontSize: 13 }}>
        Click anywhere on the map to drop a pin and look up the address.
      </p>

      {/* Reverse geocode result */}
      {clickedPos && (
        <div style={{ marginTop: 12, padding: 12, background: '#e8f5e9', borderRadius: 4 }}>
          <strong>Clicked position:</strong> {clickedPos.lat.toFixed(6)}, {clickedPos.lon.toFixed(6)}
          <br />
          {reverseState.status === 'loading' && <span>Looking up address…</span>}
          {reverseState.status === 'success' && (
            <span>
              <strong>Address:</strong> {reverseState.address.label}{' '}
              <span style={{ color: '#888', fontSize: 12 }}>
                ({reverseState.address.distance.toFixed(1)} m away)
              </span>
            </span>
          )}
          {reverseState.status === 'error' && (
            <span style={{ color: '#c00' }}>Error: {reverseState.error.message}</span>
          )}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
