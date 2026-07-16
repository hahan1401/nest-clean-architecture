import { Module } from '@nestjs/common';
import { GeocodingPort } from '../../domain/ports/geocoding.port';
import { NominatimGeocodingService } from '../../infrastructure/services/nominatim-geocoding.service';
import { GeocodingController } from '../controllers/geocoding.controller';
import { HttpModule } from '@nestjs/axios'

@Module({
  controllers: [GeocodingController],
  providers: [
    { provide: GeocodingPort, useClass: NominatimGeocodingService },
  ],
  imports: [HttpModule]
})
export class GeocodingModule {}
