import { GEOCODING_PATTERNS, GEOCODING_SERVICE } from '@app/common';
import { User } from '@app/database';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NominatimResponse } from 'libs/types/api-location/common';
import { catchError, firstValueFrom, of } from 'rxjs';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UpdateLocationUseCase } from '../../domain/usecases/update-location.usecase';

@Injectable()
export class UpdateLocationService implements UpdateLocationUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    @Inject(GEOCODING_SERVICE) private readonly geocodingClient: ClientProxy,
  ) {}

  async execute(userId: string, latitude: number, longitude: number): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    const reverseGeocodeResponse = await firstValueFrom(
      this.geocodingClient
        .send<NominatimResponse | null>(GEOCODING_PATTERNS.REVERSE_GEOCODE, {
          latitude,
          longitude,
        })
        .pipe(catchError(() => of(null))),
    );

    let locationNameArr: (string | undefined)[] = [];
    if (reverseGeocodeResponse?.addresstype === 'state_district') {
      locationNameArr = [
        reverseGeocodeResponse?.address?.state_district,
        reverseGeocodeResponse?.address?.state,
        reverseGeocodeResponse?.address?.country,
      ];
    } else {
      locationNameArr = [
        reverseGeocodeResponse?.address?.suburb,
        reverseGeocodeResponse?.address?.city,
        reverseGeocodeResponse?.address?.country,
      ];
    }

    const locationName = locationNameArr.filter(Boolean).join(', ') || null;
    return this.userRepository.updateLocation(userId, latitude, longitude, locationName);
  }
}
