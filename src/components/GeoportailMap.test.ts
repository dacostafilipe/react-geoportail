import { afterEach, describe, expect, it } from 'vitest';
import { convertMapClickCoordinateToLatLon } from './GeoportailMap';

describe('convertMapClickCoordinateToLatLon', () => {
  const globalWithWindow = globalThis as any;

  afterEach(() => {
    globalWithWindow.window = undefined;
  });

  it('transforms projected click coordinates to WGS84 before emitting them', () => {
    const transformCalls: Array<{
      coordinate: [number, number];
      source: string;
      destination: string;
    }> = [];

    globalWithWindow.window = {
      ol: {
        proj: {
          transform: fakeTransform,
        },
      },
    };

    function fakeTransform(
      coordinate: [number, number],
      source: string,
      destination: string
    ): [number, number] {
      transformCalls.push({ coordinate, source, destination });
      expect(coordinate).toEqual([686200.5032054918, 6381743.432188045]);
      expect(source).toBe('EPSG:3857');
      expect(destination).toBe('EPSG:4326');
      return [6.164244, 49.625928];
    }

    const map = {
      getView() {
        return {
          getProjection() {
            return {
              getCode() {
                return 'EPSG:3857';
              },
            };
          },
        };
      },
    } as unknown as Parameters<typeof convertMapClickCoordinateToLatLon>[0];

    const coords = convertMapClickCoordinateToLatLon(
      map,
      [686200.5032054918, 6381743.432188045]
    );

    expect(transformCalls).toHaveLength(1);
    expect(coords.lat).toBeCloseTo(49.625928, 6);
    expect(coords.lon).toBeCloseTo(6.164244, 6);
  });
});
