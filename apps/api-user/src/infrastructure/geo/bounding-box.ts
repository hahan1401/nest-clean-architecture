/** Mean km per degree of latitude — accurate enough for a prefilter. */
const KM_PER_DEGREE_LAT = 111.045;

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  /** True when the box spans the antimeridian, so longitude is an OR of two ranges. */
  wrapsAntimeridian: boolean;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Smallest lat/lng rectangle guaranteed to contain every point within `radiusKm`
 * of the origin.
 *
 * Deliberately over-covers. The exact haversine filter still runs afterwards, so a
 * box that is slightly too wide only costs a few extra candidate rows, whereas one
 * that is too narrow silently drops real results.
 */
export const boundingBoxFor = (lat: number, lng: number, radiusKm: number): BoundingBox => {
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  const minLat = lat - dLat;
  const maxLat = lat + dLat;

  // Near the poles every meridian falls inside the radius, and cos() collapses
  // toward zero — so clamp to the full longitude range instead of dividing by ~0.
  if (minLat <= -90 || maxLat >= 90) {
    return {
      minLat: Math.max(minLat, -90),
      maxLat: Math.min(maxLat, 90),
      minLng: -180,
      maxLng: 180,
      wrapsAntimeridian: false,
    };
  }

  // A degree of longitude shrinks as latitude rises. Use the edge of the band
  // furthest from the equator so the box stays a superset across its whole height.
  const widestLat = Math.max(Math.abs(minLat), Math.abs(maxLat));
  const dLng = radiusKm / (KM_PER_DEGREE_LAT * Math.cos(toRadians(widestLat)));

  if (dLng >= 180) {
    return { minLat, maxLat, minLng: -180, maxLng: 180, wrapsAntimeridian: false };
  }

  let minLng = lng - dLng;
  let maxLng = lng + dLng;
  let wrapsAntimeridian = false;

  if (minLng < -180) {
    minLng += 360;
    wrapsAntimeridian = true;
  }

  if (maxLng > 180) {
    maxLng -= 360;
    wrapsAntimeridian = true;
  }

  return { minLat, maxLat, minLng, maxLng, wrapsAntimeridian };
};
