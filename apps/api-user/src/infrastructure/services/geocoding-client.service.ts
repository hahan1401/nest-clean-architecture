import { GEOCODING_PATTERNS, GEOCODING_SERVICE } from '@app/common';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NominatimResponse } from 'libs/types/api-location/common';
import { catchError, firstValueFrom, of } from 'rxjs';
import { GeocodingClientPort } from '../../domain/ports/geocoding-client.port';

@Injectable()
export class GeocodingClientService extends GeocodingClientPort {
  constructor(@Inject(GEOCODING_SERVICE) private readonly geocodingClient: ClientProxy) {
    super();
  }

  reverseGeocode(latitude: number, longitude: number): Promise<NominatimResponse | null> {
    return firstValueFrom(
      this.geocodingClient
        .send<NominatimResponse | null>(GEOCODING_PATTERNS.REVERSE_GEOCODE, {
          latitude,
          longitude,
        })
        .pipe(catchError(() => of(null))),
    );
  }
}
