import { NominatimResponse } from 'libs/types/api-location/common';
import { GeocodingPort } from '../../domain/ports/geocoding.port';
import { ReverseGeocodeService } from './reverse-geocode.service';

describe('ReverseGeocodeService', () => {
  let service: ReverseGeocodeService;
  let geocoding: jest.Mocked<GeocodingPort>;

  beforeEach(() => {
    geocoding = { reverseGeocode: jest.fn() };
    service = new ReverseGeocodeService(geocoding);
  });

  it('delegates to the geocoding port', async () => {
    const response = { addresstype: 'amenity', address: {} } as NominatimResponse;
    geocoding.reverseGeocode.mockResolvedValue(response);

    await expect(service.execute(10, 20)).resolves.toBe(response);
    expect(geocoding.reverseGeocode).toHaveBeenCalledWith(10, 20);
  });

  it('returns null when the port has no match', async () => {
    geocoding.reverseGeocode.mockResolvedValue(null);
    await expect(service.execute(0, 0)).resolves.toBeNull();
  });
});
