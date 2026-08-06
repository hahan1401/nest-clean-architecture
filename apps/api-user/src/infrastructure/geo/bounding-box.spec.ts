import { boundingBoxFor } from './bounding-box';

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Great-circle destination from an origin, used to generate points on the radius edge. */
const destinationPoint = (lat: number, lng: number, bearingDeg: number, distanceKm: number) => {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  // Normalise longitude back into [-180, 180].
  return { lat: toDegrees(lat2), lng: ((toDegrees(lng2) + 540) % 360) - 180 };
};

const containedBy = (
  box: ReturnType<typeof boundingBoxFor>,
  point: { lat: number; lng: number },
) => {
  const withinLat = point.lat >= box.minLat && point.lat <= box.maxLat;
  const withinLng = box.wrapsAntimeridian
    ? point.lng >= box.minLng || point.lng <= box.maxLng
    : point.lng >= box.minLng && point.lng <= box.maxLng;

  return withinLat && withinLng;
};

describe('boundingBoxFor', () => {
  it('brackets the origin', () => {
    const box = boundingBoxFor(10, 20, 10);

    expect(box.minLat).toBeLessThan(10);
    expect(box.maxLat).toBeGreaterThan(10);
    expect(box.minLng).toBeLessThan(20);
    expect(box.maxLng).toBeGreaterThan(20);
    expect(box.wrapsAntimeridian).toBe(false);
  });

  it('stays tight enough to be selective at the default 10km radius', () => {
    const box = boundingBoxFor(21.03, 105.85, 10); // Hanoi

    // A ~0.2 degree band, not a table scan.
    expect(box.maxLat - box.minLat).toBeLessThan(0.25);
    expect(box.maxLng - box.minLng).toBeLessThan(0.25);
  });

  it('never excludes a point that lies within the radius', () => {
    const origins = [
      { lat: 0, lng: 0 },
      { lat: 21.03, lng: 105.85 },
      { lat: -33.87, lng: 151.21 },
      { lat: 64.13, lng: -21.9 },
      { lat: -54.8, lng: -68.3 },
    ];

    for (const origin of origins) {
      for (const radiusKm of [1, 10, 100, 500]) {
        const box = boundingBoxFor(origin.lat, origin.lng, radiusKm);

        for (let bearing = 0; bearing < 360; bearing += 5) {
          const edge = destinationPoint(origin.lat, origin.lng, bearing, radiusKm * 0.999);

          expect({ origin, radiusKm, bearing, contained: containedBy(box, edge) }).toEqual({
            origin,
            radiusKm,
            bearing,
            contained: true,
          });
        }
      }
    }
  });

  it('flags a wrap when the box crosses the antimeridian', () => {
    const box = boundingBoxFor(0, 179.9, 50);

    expect(box.wrapsAntimeridian).toBe(true);
    expect(box.minLng).toBeGreaterThan(0);
    expect(box.maxLng).toBeLessThan(0);

    expect(containedBy(box, { lat: 0, lng: 179.99 })).toBe(true);
    expect(containedBy(box, { lat: 0, lng: -179.99 })).toBe(true);
    expect(containedBy(box, { lat: 0, lng: 100 })).toBe(false);
  });

  it('opens longitude fully near the poles instead of dividing by ~zero', () => {
    const box = boundingBoxFor(89.9, 10, 50);

    expect(box.minLng).toBe(-180);
    expect(box.maxLng).toBe(180);
    expect(box.maxLat).toBeLessThanOrEqual(90);
    expect(Number.isFinite(box.minLng)).toBe(true);
  });

  it('opens longitude fully when the radius spans more than half the globe', () => {
    const box = boundingBoxFor(0, 0, 20_000);

    expect(box.minLng).toBe(-180);
    expect(box.maxLng).toBe(180);
    expect(box.wrapsAntimeridian).toBe(false);
  });
});
