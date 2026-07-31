import { User } from '@app/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { GeocodingClientPort } from '../../domain/ports/geocoding-client.port';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UpdateLocationUseCase } from '../../domain/usecases/update-location.usecase';

@Injectable()
export class UpdateLocationService implements UpdateLocationUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly geocodingClient: GeocodingClientPort,
  ) {}

  async execute(userId: string, latitude: number, longitude: number): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    const reverseGeocodeResponse = await this.geocodingClient.reverseGeocode(
      latitude,
      longitude,
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
