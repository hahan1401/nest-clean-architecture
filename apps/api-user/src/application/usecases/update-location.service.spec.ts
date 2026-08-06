import { NotFoundError } from '@app/common';
import { User } from '@app/database';
import { NominatimResponse } from 'libs/types/api-location/common';
import { GeocodingClientPort } from '../../domain/ports/geocoding-client.port';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UpdateLocationService } from './update-location.service';

describe('UpdateLocationService', () => {
  let service: UpdateLocationService;
  let userRepository: jest.Mocked<UserRepository>;
  let geocodingClient: jest.Mocked<GeocodingClientPort>;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      updateLocation: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;
    geocodingClient = { reverseGeocode: jest.fn() };
    service = new UpdateLocationService(userRepository, geocodingClient);
  });

  it('throws when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(service.execute('missing', 1, 2)).rejects.toBeInstanceOf(NotFoundError);
    expect(geocodingClient.reverseGeocode).not.toHaveBeenCalled();
  });

  it('builds the location name from the geocoding result', async () => {
    const user = new User({ id: 'u1' });
    userRepository.findById.mockResolvedValue(user);
    geocodingClient.reverseGeocode.mockResolvedValue({
      addresstype: 'amenity',
      address: { suburb: 'Ward 1', city: 'Hanoi', country: 'Vietnam' },
    } as NominatimResponse);
    userRepository.updateLocation.mockResolvedValue(user);

    await service.execute('u1', 21, 105);

    expect(userRepository.updateLocation).toHaveBeenCalledWith(
      'u1',
      21,
      105,
      'Ward 1, Hanoi, Vietnam',
    );
  });

  it('falls back to null location name when geocoding fails', async () => {
    const user = new User({ id: 'u1' });
    userRepository.findById.mockResolvedValue(user);
    geocodingClient.reverseGeocode.mockResolvedValue(null);
    userRepository.updateLocation.mockResolvedValue(user);

    await service.execute('u1', 21, 105);

    expect(userRepository.updateLocation).toHaveBeenCalledWith('u1', 21, 105, null);
  });
});
