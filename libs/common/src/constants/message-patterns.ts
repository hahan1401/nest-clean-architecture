export const USER_PATTERNS = {
  CREATE_USER: 'create_user',
  GET_USERS: 'get_users',
  GET_USER_BY_ID: 'get_user_by_id',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',
  UPDATE_LOCATION: 'update_location',
  FIND_NEARBY_USERS: 'find_nearby_users',
} as const;

export const GEOCODING_PATTERNS = {
  REVERSE_GEOCODE: 'reverse_geocode',
} as const;

export const PAYMENT_PATTERNS = {
  BANK_LIST: 'bank-list',
  GENERATE_QR: 'generate-qr',
  GENERATE_URL: 'generate-url',
  RETURN_URL: 'return-url',
} as const;

export const CHATBOT_PATTERNS = {
  ASK_SSE: 'ask-sse',
  ASK_STRICT_SSE: 'ask-strict-sse',
  UPSERT_DOCUMENT: 'upsert-document',
  UPDATE_DOCUMENT: 'update-document',
  DELETE_DOCUMENT: 'delete-document',
} as const;

/** RabbitMQ event patterns consumed by api-notification. */
export const NOTIFICATION_PATTERNS = {
  SEND: 'notification.send',
  BROADCAST: 'notification.broadcast',
} as const;

/** RabbitMQ event patterns consumed by api-email. */
export const EMAIL_PATTERNS = {
  SEND: 'email.send',
} as const;

export const BOOKING_PATTERNS = {
  // Rooms
  CREATE_ROOM: 'create_room',
  LIST_ROOMS: 'list_rooms',
  GET_ROOM: 'get_room',
  GET_ROOM_BY_CODE: 'get_room_by_code',
  SEARCH_AVAILABLE_ROOMS: 'search_available_rooms',
  CHECK_ROOM_AVAILABILITY: 'check_room_availability',
  LIST_ROOM_BOOKINGS: 'list_room_bookings',

  // Tours and departures
  CREATE_TOUR: 'create_tour',
  LIST_TOURS: 'list_tours',
  GET_TOUR: 'get_tour',
  GET_TOUR_BY_SLUG: 'get_tour_by_slug',
  CREATE_TOUR_DEPARTURE: 'create_tour_departure',
  LIST_TOUR_DEPARTURES: 'list_tour_departures',
  SEARCH_AVAILABLE_DEPARTURES: 'search_available_departures',
  CHECK_TOUR_AVAILABILITY: 'check_tour_availability',
  LIST_TOUR_BOOKINGS: 'list_tour_bookings',

  // Pricing
  CREATE_PRICE_RULE: 'create_price_rule',
  LIST_PRICE_RULES: 'list_price_rules',
  DELETE_PRICE_RULE: 'delete_price_rule',
  QUOTE_PRICE: 'quote_price',

  // Bookings
  CREATE_BOOKING: 'create_booking',
  CONFIRM_BOOKING: 'confirm_booking',
  CANCEL_BOOKING: 'cancel_booking',
  GET_BOOKING: 'get_booking',
  GET_BOOKING_BY_REFERENCE: 'get_booking_by_reference',

  // Self-service cancellation from the emailed link
  GET_BOOKING_BY_CANCELLATION_TOKEN: 'get_booking_by_cancellation_token',
  CANCEL_BOOKING_BY_TOKEN: 'cancel_booking_by_token',

  // Daily maintenance jobs
  EXPIRE_STALE_HOLDS: 'expire_stale_holds',
  CLOSE_ELAPSED_DEPARTURES: 'close_elapsed_departures',
  COMPLETE_ELAPSED_BOOKINGS: 'complete_elapsed_bookings',
} as const;
