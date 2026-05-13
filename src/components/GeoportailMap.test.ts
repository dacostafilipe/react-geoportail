import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearMarker,
  convertLatLonToMarkerCoordinate,
  convertMapClickCoordinateToLatLon,
  ensureMarkerOverlay,
  resolveDisplayMarkerPosition,
  resolveInitialCenter,
  setMarkerCoordinate,
  setMarkerPosition,
} from './GeoportailMap';
import type { LatLon } from '../types';

const globalWithDom = globalThis as any;

describe('GeoportailMap marker helpers', () => {
  afterEach(() => {
    globalWithDom.window = undefined;
    globalWithDom.document = undefined;
  });

  it('transforms projected click coordinates to WGS84 before emitting them', () => {
    const transformCalls: Array<{
      coordinate: [number, number];
      source: string;
      destination: string;
    }> = [];

    installOlMocks({
      transform(coordinate, source, destination) {
        transformCalls.push({ coordinate, source, destination });
        return [6.164244, 49.625928];
      },
    });

    const map = createMapMock('EPSG:3857');

    const coords = convertMapClickCoordinateToLatLon(
      map,
      [686200.5032054918, 6381743.432188045]
    );

    expect(transformCalls).toEqual([
      {
        coordinate: [686200.5032054918, 6381743.432188045],
        source: 'EPSG:3857',
        destination: 'EPSG:4326',
      },
    ]);
    expect(coords).toEqual({ lat: 49.625928, lon: 6.164244 });
  });

  it('transforms marker positions into the overlay projection before placing overlays', () => {
    const transformCalls: Array<{
      coordinate: [number, number];
      source: string;
      destination: string;
    }> = [];

    installOlMocks({
      transform(coordinate, source, destination) {
        transformCalls.push({ coordinate, source, destination });
        return [686200.5032054918, 6381743.432188045];
      },
    });

    const projected = convertLatLonToMarkerCoordinate({
      lat: 49.625928,
      lon: 6.164244,
    });

    expect(transformCalls).toEqual([
      {
        coordinate: [6.164244, 49.625928],
        source: 'EPSG:4326',
        destination: 'EPSG:3857',
      },
    ]);
    expect(projected).toEqual([686200.5032054918, 6381743.432188045]);
  });

  it('creates a marker overlay once and reuses it for later updates', () => {
    const overlays: FakeOverlay[] = [];
    installOlMocks({
      transform(coordinate) {
        const [lon, lat] = coordinate;
        return [lon * 1000, lat * 1000];
      },
      overlays,
    });

    const markerRef = createMarkerRef();
    const map = createMapMock('EPSG:3857', overlays);

    setMarkerPosition(map, { lat: 49.625928, lon: 6.164244 }, markerRef);
    const overlay = markerRef.current as FakeOverlay;

    expect(overlays).toHaveLength(1);
    expect(lastPosition(overlay)).toEqual([6164.244, 49625.928]);

    setMarkerPosition(map, { lat: 49.63, lon: 6.17 }, markerRef);

    expect(overlays).toHaveLength(1);
    expect(markerRef.current).toBe(overlay);
    expect(lastPosition(overlay)).toEqual([6170, 49630]);
  });

  it('keeps the overlay instance after clearing so it can be shown again', () => {
    const overlays: FakeOverlay[] = [];
    installOlMocks({
      transform(coordinate) {
        const [lon, lat] = coordinate;
        return [lon * 1000, lat * 1000];
      },
      overlays,
    });

    const markerRef = createMarkerRef();
    const map = createMapMock('EPSG:3857', overlays);

    setMarkerPosition(map, { lat: 49.625928, lon: 6.164244 }, markerRef);
    const overlay = ensureMarkerOverlay(
      map,
      { lat: 49.625928, lon: 6.164244 },
      markerRef
    ) as FakeOverlay;

    clearMarker(markerRef);
    expect(markerRef.current).toBe(overlay);
    expect(lastPosition(overlay)).toBeUndefined();

    setMarkerPosition(map, { lat: 49.626, lon: 6.165 }, markerRef);
    expect(overlays).toHaveLength(1);
    expect(markerRef.current).toBe(overlay);
    expect(lastPosition(overlay)).toEqual([6165, 49626]);
  });

  it('resolves marker visibility by mode', () => {
    const center: LatLon = { lat: 49.6116, lon: 6.1319 };
    const marker: LatLon = { lat: 49.625928, lon: 6.164244 };

    expect(resolveDisplayMarkerPosition('none', marker, center)).toBeUndefined();
    expect(resolveDisplayMarkerPosition('fixed', marker, center)).toEqual(marker);
    expect(resolveDisplayMarkerPosition('click', marker, center)).toEqual(marker);
    expect(resolveDisplayMarkerPosition('fixed', undefined, center)).toEqual(center);
    expect(resolveDisplayMarkerPosition('click', undefined, center)).toBeUndefined();
  });

  it('centers the initial map on an existing marker position', () => {
    const center: LatLon = { lat: 49.6116, lon: 6.1319 };
    const marker: LatLon = { lat: 49.625928, lon: 6.164244 };

    expect(resolveInitialCenter(center, 'click', marker)).toEqual(marker);
    expect(resolveInitialCenter(center, 'fixed', marker)).toEqual(marker);
    expect(resolveInitialCenter(center, 'none', marker)).toEqual(center);
    expect(resolveInitialCenter(undefined, 'click', undefined)).toEqual(center);
  });

  it('creates the overlay through OpenLayers without relying on lux marker helpers', () => {
    const overlays: FakeOverlay[] = [];
    installOlMocks({
      transform(coordinate) {
        const [lon, lat] = coordinate;
        return [lon * 1000, lat * 1000];
      },
      overlays,
    });

    const markerRef = createMarkerRef();
    const map = createMapMock('EPSG:3857', overlays);

    setMarkerPosition(map, { lat: 49.625928, lon: 6.164244 }, markerRef);

    expect(overlays).toHaveLength(1);
    expect(markerRef.current).toBe(overlays[0]);
  });

  it('creates and places click-updated markers at the exact clicked overlay coordinate', () => {
    const overlays: FakeOverlay[] = [];
    installOlMocks({
      transform(coordinate) {
        return coordinate;
      },
      overlays,
    });

    const markerRef = createMarkerRef();
    const map = createMapMock('EPSG:3857', overlays);

    setMarkerCoordinate(
      map,
      [686200.5032054918, 6381743.432188045],
      { lat: 49.625928, lon: 6.164244 },
      markerRef
    );

    const overlay = markerRef.current as FakeOverlay;
    expect(overlays).toHaveLength(1);
    expect(lastPosition(overlay)).toEqual([686200.5032054918, 6381743.432188045]);
  });
});

type TransformFn = (
  coordinate: [number, number],
  source: string,
  destination: string
) => [number, number];

class FakeOverlay {
  positions: Array<[number, number] | undefined> = [];

  constructor(public readonly options: unknown) {}

  setPosition(pos: [number, number] | undefined): void {
    this.positions.push(pos);
  }
}

function createMarkerRef(): React.MutableRefObject<unknown> {
  return { current: null };
}

function createMapMock(
  projectionCode: string,
  overlays: FakeOverlay[] = [],
  overrides: Record<string, unknown> = {}
): Parameters<typeof convertMapClickCoordinateToLatLon>[0] {
  return {
    addOverlay(overlay: FakeOverlay) {
      overlays.push(overlay);
    },
    getView() {
      return {
        getCenter() {
          return [0, 0];
        },
        getZoom() {
          return 12;
        },
        setCenter() {},
        setZoom() {},
        getProjection() {
          return {
            getCode() {
              return projectionCode;
            },
          };
        },
      };
    },
    getLayers() {
      return null;
    },
    getTarget() {
      return {} as HTMLElement;
    },
    addLayerToMap() {},
    on() {},
    un() {},
    ...overrides,
  } as unknown as Parameters<typeof convertMapClickCoordinateToLatLon>[0];
}

function installOlMocks(options: {
  transform: TransformFn;
  overlays?: FakeOverlay[];
}): void {
  globalWithDom.document = {
    createElement() {
      return {
        innerHTML: '',
        style: {
          cssText: '',
        },
      };
    },
  };

  globalWithDom.window = {
    ol: {
      proj: {
        transform: options.transform,
      },
      Overlay: class {
        constructor(overlayOptions: unknown) {
          return new FakeOverlay(overlayOptions);
        }
      },
    },
  };
}

function lastPosition(overlay: FakeOverlay): [number, number] | undefined {
  return overlay.positions[overlay.positions.length - 1];
}
