import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GEOCODING_PATTERNS } from '@app/common';
import { GeocodingPort } from '../../domain/ports/geocoding.port';
import { NominatimResponse } from 'libs/types/api-location/common';

@Controller()
export class GeocodingController {
  constructor(private readonly geocodingPort: GeocodingPort) {}

  @MessagePattern(GEOCODING_PATTERNS.REVERSE_GEOCODE)
  async reverseGeocode(@Payload() data: { latitude: number; longitude: number }): Promise<NominatimResponse | null> {
    return this.geocodingPort.reverseGeocode(data.latitude, data.longitude);
  }
}
