interface AddressAmenity {
  road: string
  quarter: string
  suburb: string
  city: string
  postcode: string
  country: string
  country_code: string
  [extraKey: string]: string
}

interface AddressStateDistrict {
  state_district: string
  state: string
  country: string
  country_code: string
  [extraKey: string]: string
}

type AddressMap = {
  amenity: AddressAmenity
  state_district: AddressStateDistrict
}

type NominatimAddressType = keyof AddressMap

export interface NominatimResponse {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  class: string
  type: string
  place_rank: number
  importance: number
  addresstype: NominatimAddressType
  name: string
  display_name: string
  address: AddressMap[NominatimAddressType]
  boundingbox: string[]
}