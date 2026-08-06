import { NominatimResponse } from 'libs/types/api-location/common';

export interface ReverseGeocodeUseCase {
  execute(latitude: number, longitude: number): Promise<NominatimResponse | null>;
}
