import { Inject, Injectable } from '@nestjs/common';
import { GeocodingPort } from '../../domain/ports/geocoding.port';
import { NominatimResponse } from 'libs/types/api-location/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class NominatimGeocodingService extends GeocodingPort {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super();
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<NominatimResponse | null> {
    const openStreetMapReverse = this.configService.get<string>('OPEN_STREET_MAP_REVERSE');
    const url = `${openStreetMapReverse}?lat=${latitude}&lon=${longitude}&format=json`;

    try {
      const response = await this.httpService.axiosRef.get<NominatimResponse>(url, {
        headers: {
          'User-Agent': 'NestCleanArchitectureApp/1.0',
        },
      });
      return response.data;
    } catch {
      return null;
    }
  }
}
