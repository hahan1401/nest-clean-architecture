import { GEOCODING_PATTERNS } from '@app/common';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NominatimResponse } from 'libs/types/api-location/common';
import { ReverseGeocodeService } from '../../application/usecases/reverse-geocode.service';

@Controller()
export class GeocodingController {
  constructor(private readonly reverseGeocodeService: ReverseGeocodeService) {}

  @MessagePattern(GEOCODING_PATTERNS.REVERSE_GEOCODE)
  async reverseGeocode(
    @Payload() data: { latitude: number; longitude: number },
  ): Promise<NominatimResponse | null> {
    return this.reverseGeocodeService.execute(data.latitude, data.longitude);
  }
}
