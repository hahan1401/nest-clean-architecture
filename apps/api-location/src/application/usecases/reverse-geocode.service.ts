import { Injectable } from '@nestjs/common';
import { GeocodingPort } from '../../domain/ports/geocoding.port';
import { NominatimResponse } from 'libs/types/api-location/common';
import { ReverseGeocodeUseCase } from '../../domain/usecases/reverse-geocode.usecase';

@Injectable()
export class ReverseGeocodeService implements ReverseGeocodeUseCase {
  constructor(private readonly nominatimGeocodingService: GeocodingPort) {}
  async execute(latitude: number, longitude: number): Promise<NominatimResponse | null> {
    return this.nominatimGeocodingService.reverseGeocode(latitude, longitude);
  }
}
