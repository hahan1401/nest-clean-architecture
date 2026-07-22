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
} as const;
