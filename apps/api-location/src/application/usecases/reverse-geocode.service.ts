import { Injectable } from '@nestjs/common';
import { GeocodingPort } from '../../domain/ports/geocoding.port';

@Injectable()
export class ReverseGeocodeService {
  constructor(
    private readonly nominatimGeocodingService: GeocodingPort,
  ) {}
  async execute(latitude: number, longitude: number) {
    return this.nominatimGeocodingService.reverseGeocode(latitude, longitude);
  }
}
