import { NominatimResponse } from 'libs/types/api-location/common';

export abstract class GeocodingClientPort {
  abstract reverseGeocode(latitude: number, longitude: number): Promise<NominatimResponse | null>;
}
