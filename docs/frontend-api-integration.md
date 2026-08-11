# Frontend API Integration Guide

Everything a browser or mobile client needs to talk to this system. All traffic goes through
**`api-gateway`** — the microservices behind it speak TCP/RabbitMQ and are not reachable from a
client.

- Backend design and rationale: [`ARCHITECTURE.md`](../ARCHITECTURE.md)
- Shared request/response types: `libs/common/src/dtos/` (importable if your frontend lives in
  this repo)

---

## 1. Connection

| | Value |
|---|---|
| Origin (dev) | `http://localhost:3000` — override with `GATEWAY_PORT` |
| **API base URL (dev)** | **`http://localhost:3000/api`** — every REST route lives under the `/api` global prefix |
| Content type | `application/json` (except the chatbot upload, which is `multipart/form-data`) |
| CORS | `app.enableCors()` with defaults — **every origin allowed, no credentials mode**. Lock this down before production. |
| Auth | **None.** There is no login, token, or session anywhere in the gateway today. Every endpoint is public, including the admin-shaped ones (`POST /rooms`, `POST /price-rules`, `POST /bookings/:id/confirm`). Treat this as a pre-auth codebase — do not ship it to the public internet as-is. |
| Realtime | Socket.IO, proxied by the gateway at `/socket.io` — **on the origin, not under `/api`** (see §8) |

### The `/api` prefix

The gateway calls `app.setGlobalPrefix('api')`, so every path in §6 is served one level down:

| Declared in the controller | Actually served at |
|---|---|
| `POST /bookings` | `POST /api/bookings` |
| `GET /rooms/availability` | `GET /api/rooms/availability` |
| `GET /chatbot/sse` | `GET /api/chatbot/sse` |
| `/socket.io` (proxy) | `/socket.io` — **unchanged** |

Every path written in this guide is **relative to `/api`**, matching the controller declarations.
Keep the prefix in your base URL exactly once and never hard-code it into individual paths.

The Socket.IO exception is not an oversight: the proxy is Express middleware mounted before the
prefix is applied, so it is bound to the origin root. Point REST at `VITE_API_URL` (with `/api`)
and sockets at the bare origin — two separate values in your config. §8 shows the split.

### Request correlation

`CorrelationRequestIdMiddleware` runs on every route:

- Send an `x-request-id` header and it is reused verbatim.
- Omit it and the gateway generates a UUID.
- Either way the value comes back on the **response** `x-request-id` header, appears in the error
  body, and is threaded through every downstream service log.

Always generate one client-side and log it — it is the only handle you have when asking a backend
engineer why a call failed.

```ts
const requestId = crypto.randomUUID();
fetch(url, { headers: { 'x-request-id': requestId } });
```

---

## 2. Conventions you must get right

### Money is an integer number of VND

`basePrice`, `amount`, `totalAmount`, `unitAmount` are whole VND in a JSON `number`. There is no
minor unit and no scaling factor — `250000` means ₫250,000. Never divide by 100. Format for
display only:

```ts
new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(250000);
// "250.000 ₫"
```

### Every date is an instant

| Kind | Fields | Format |
|---|---|---|
| **All of them** | `checkIn`, `checkOut`, `departureDate`, `from`, `to`, `startDate`, `endDate`, price-line `date`, `createdAt`, `updatedAt`, `holdExpiresAt`, `confirmedAt`, `cancelledAt`, `completedAt`, `heldUntil`, `availableFrom` | Full ISO 8601 with an explicit zone — **in and out** |

There is one date shape in this API and it is an instant. A date-only string like
`"2027-02-14"` is **rejected with a 400**: read as UTC midnight it is 07:00 on the ridge,
which is nobody's check-in time, and that ambiguity is exactly what this contract removed.

```jsonc
// ✅
{ "checkIn": "2027-02-14T06:00:00.000Z", "checkOut": "2027-02-16T04:00:00.000Z" }
{ "checkIn": "2027-02-14T13:00:00+07:00" }   // same instant, also fine

// ❌ 400 VALIDATION
{ "checkIn": "2027-02-14" }
{ "checkIn": "2027-02-14T13:00" }            // no zone — means a different moment to every reader
```

Seconds and milliseconds are **truncated to zero** server-side. The site offers hours and
half-hours only; send `:00.000` and nothing surprising can land inside an overlap range.

#### The house clock

The house is on the ridge above Đà Lạt: **Asia/Ho_Chi_Minh, UTC+7 all year, no daylight
saving.** Every time a guest picks and every time the site renders is on that clock,
wherever the guest is sitting. So a form showing `14/02/2027 13:00` sends
`"2027-02-14T06:00:00.000Z"`, and rendering that instant back in `Asia/Ho_Chi_Minh` shows
`13:00` again.

**The house has no check-in or check-out hour.** A guest arrives and leaves when they choose,
the booking stores what was picked, and the site offers any half-hour. Do not publish a fixed
arrival or departure time — there is no field for one, and there is nothing behind it.

Always render a stay with its hour. Dropping it hides the only thing that decides whether a
room is free that afternoon or the next morning.

#### An hour between one guest and the next

The one rule between two stays is the turnover. A room is bookable again **one hour after the
previous guest checks out** — check out at 15:00 and the room is free from 16:00.

This is a database invariant, not a convention: `bookings_room_no_overlap` compares
`room_stay_occupancy(check_in, check_out)`, which is the stay plus that hour, so a booking
that arrives inside the gap comes back `409 CONFLICT` however it was sent. Same-day turnover
is still the point — a departure at 11:00 and an arrival at 13:00 do not collide — but 11:30
now does.

Two consequences for the site:

- `availableFrom` on a `BOOKED` room is already **checkout plus the hour**. It is the instant
  the guest can actually book from, so render it as given; do not add or subtract anything.
- A range that starts less than an hour after an existing stay is not bookable even though
  the two do not overlap. Availability says so before the guest reaches the button.

#### Nights are calendar nights, on the house clock

A stay of `14 Feb 15:00 → 16 Feb 09:00` is **two** nights and bills two, even though it is
44 hours. Nights are the house-local calendar days crossed, never elapsed time divided by
24 — otherwise a late arrival would quietly cost an extra night.

```ts
const HOUSE_OFFSET_MS = 7 * 3_600_000;
const houseDay = (iso: string) =>
  Math.floor((Date.parse(iso) + HOUSE_OFFSET_MS) / 86_400_000);

const nights = houseDay(checkOut) - houseDay(checkIn);
```

A stay must cross at least one night. `14 Feb 09:00 → 14 Feb 20:00` is rejected with a 400,
on `/bookings` **and** on `/bookings/quote`.

Room stays are **half-open ranges** `[checkIn, checkOut)`. A stay of `14 Feb → 16 Feb` is
two nights, and someone else may arrive on the 16th — an hour after this guest leaves.

### Weekdays are Postgres DOW, read on the house clock

`daysOfWeek` on a price rule uses `0 = Sunday … 6 = Saturday`. It is read on the **house**
clock, not in UTC: a night beginning at 17:00Z is already tomorrow on the ridge, so a
"Saturday" rule read in UTC would price the wrong night. An empty or absent array means
"every day".

A price-rule window is a pair of instants and is **inclusive** of `endDate`. To cover whole
days, open it at `00:00` and close it at `23:59:59.999` house time — that is how the
existing rules were migrated.

### Unknown body fields are silently dropped

The gateway runs `ValidationPipe({ whitelist: true, transform: true })`. Properties not declared on
the DTO are **stripped without error** — a typo'd field name fails silently rather than 400ing. If a
value seems ignored, check the spelling against the tables below.

`transform: true` also coerces query strings, so `?take=20` arrives as the number `20`.

---

## 3. The error contract

Every failure — validation, domain conflict, a crashed microservice — is rendered by
`AllExceptionsHttpFilter` into the same body:

```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Those dates are no longer available for this room",
  "requestId": "6f1c2b6e-...",
  "timestamp": "2026-08-08T09:12:44.501Z",
  "path": "/bookings"
}
```

| `code` | HTTP | What it means for the UI |
|---|---|---|
| `VALIDATION` | 400 | The request was malformed. Show field-level feedback; do not retry unchanged. |
| `UNAUTHORIZED` | 401 | Reserved — nothing emits it today. |
| `FORBIDDEN` | 403 | Reserved — nothing emits it today. |
| `NOT_FOUND` | 404 | The room/tour/booking id or reference does not exist. |
| `CONFLICT` | 409 | **The important one.** Someone else took the slot, or the booking is in a state that forbids the action. Refresh availability and re-render — see §7. |
| `DEPENDENCY_FAILURE` | 502 | A downstream service or broker is unhealthy. Safe to retry with backoff. |
| `INTERNAL` | 500 | Unexpected. Surface the `requestId` and stop. |

**Branch on `code`, never on `message`.** Messages are human-readable prose written for operators
and change freely; `code` is the stable contract.

`class-validator` failures arrive as a single `message` string with the individual violations joined
by `", "`:

```json
{
  "statusCode": 400,
  "code": "VALIDATION",
  "message": "guests must not be less than 1, customer.email must be an email",
  "requestId": "…"
}
```

To render per-field errors, split on `", "` and match the leading property path.

---

## 4. A typed client

Drop this in and build every call on top of it.

```ts
// api/client.ts
export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DEPENDENCY_FAILURE'
  | 'INTERNAL';

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  requestId?: string;
  timestamp: string;
  path: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages, when the failure came from class-validator. */
  get fieldMessages(): string[] {
    return this.code === 'VALIDATION' ? this.message.split(', ') : [];
  }
}

/** Includes the gateway's `/api` global prefix. Trailing slash trimmed so paths never double up. */
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');

export async function api<T>(
  path: string,
  init: RequestInit & { query?: Record<string, unknown> } = {},
): Promise<T> {
  const { query, ...rest } = init;

  // Concatenate — do NOT use `new URL(path, BASE_URL)`. A root-relative path replaces the
  // whole path of the base, so `new URL('/rooms', 'http://host/api')` silently drops `/api`
  // and you get a 404 on every call.
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const requestId = crypto.randomUUID();
  const isFormData = rest.body instanceof FormData;

  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'x-request-id': requestId,
      ...rest.headers,
    },
  });

  // 204 No Content: DELETE /users/:id and DELETE /price-rules/:id
  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(
      err?.code ?? 'INTERNAL',
      res.status,
      err?.message ?? res.statusText,
      err?.requestId ?? res.headers.get('x-request-id') ?? requestId,
    );
  }

  return body as T;
}
```

Usage:

```ts
import { api, ApiError } from './api/client';

try {
  const booking = await api<BookingResponse>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
} catch (e) {
  if (e instanceof ApiError && e.code === 'CONFLICT') {
    await refreshAvailability();
    toast('That slot was just taken — here are the current options.');
  } else if (e instanceof ApiError && e.code === 'VALIDATION') {
    setFieldErrors(e.fieldMessages);
  } else {
    throw e;
  }
}
```

---

## 5. Shared response types

Mirror of `libs/common/src/dtos/`. If your frontend is inside this monorepo, import from
`@app/common` instead of copying.

```ts
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type BookableType = 'ROOM' | 'TOUR';
export type DepartureStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type PriceSource = 'BASE' | 'RULE' | 'DEPARTURE_OVERRIDE';

export interface RoomResponse {
  id: number;
  code: string;
  name: string;
  description: string | null;
  maxGuests: number;
  basePrice: number;     // VND per night
  isActive: boolean;
}

export interface PriceQuoteLineResponse {
  date: string | null;   // ISO instant — the night's start (ROOM), the departure (TOUR)
  quantity: number;
  unitAmount: number;
  amount: number;
  source: PriceSource;
  priceRuleId: number | null;
}

export interface PriceQuoteResponse {
  currency: string;      // "VND"
  total: number;
  lines: PriceQuoteLineResponse[];
}

/** AVAILABLE = bookable now. ON_HOLD = another guest is mid-checkout. BOOKED = sold. */
export type RoomAvailabilityState = 'AVAILABLE' | 'ON_HOLD' | 'BOOKED';

export interface RoomAvailabilityResponse {
  room: RoomResponse;
  available: boolean;                 // true only for AVAILABLE
  state: RoomAvailabilityState;
  heldUntil: string | null;           // ISO timestamp; set only when state is ON_HOLD
  quote: PriceQuoteResponse | null;   // priced for AVAILABLE and ON_HOLD, null for BOOKED
}

export interface TourResponse {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  durationDays: number;
  basePricePerPerson: number;
  isActive: boolean;
}

export interface TourDepartureResponse {
  id: number;
  tourId: number;
  departureDate: string | null;
  capacity: number;
  bookedSeats: number;
  remainingSeats: number;
  priceOverride: number | null;
  status: DepartureStatus;
}

export interface AvailableDepartureResponse extends TourDepartureResponse {
  tourName: string;
  pricePerPerson: number;
}

export interface PriceRuleResponse {
  id: number;
  name: string;
  roomId: number | null;
  tourId: number | null;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[];  // 0 = Sunday
  amount: number;
  priority: number;
  isActive: boolean;
}

export interface BookingLineResponse {
  date: string | null;
  quantity: number;
  unitAmount: number;
  amount: number;
  priceSource: PriceSource;
}

export interface BookingResponse {
  id: number;
  reference: string;              // human-quotable, e.g. on the phone
  type: BookableType;
  status: BookingStatus;

  roomId: number | null;          // ROOM bookings
  checkIn: string | null;
  checkOut: string | null;

  tourDepartureId: number | null; // TOUR bookings
  seats: number | null;

  guests: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  totalAmount: number;
  currency: string;
  notes: string | null;

  holdExpiresAt: string | null;   // ISO timestamp — PENDING deadline
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;

  lines: BookingLineResponse[] | null;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  locationName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithDistanceResponse extends UserResponse {
  distanceKm: number;
}
```

> **`cancellationToken` is deliberately absent from `BookingResponse`.** It is a bearer credential
> that only ever travels inside the customer's confirmation email. Do not build a UI that expects to
> read it from the API — you cannot.

---

## 6. Endpoint reference

> Every path in this section is relative to the `/api` prefix — `POST /rooms` is
> `POST /api/rooms` on the wire. With the client from §4 you pass the path exactly as
> written here and the prefix comes from `BASE_URL`.

### Rooms — `/rooms`

| Method | Path | Query / Body | Returns |
|---|---|---|---|
| `POST` | `/rooms` | `CreateRoomDto` | `201` `RoomResponse` |
| `GET` | `/rooms` | `skip?`, `take?` (1–100), `guests?` | `200` `RoomResponse[]` |
| `GET` | `/rooms/availability` | `from`, `to` (**required**), `guests?`, `skip?`, `take?` | `200` `RoomAvailabilityResponse[]` |
| `GET` | `/rooms/code/:code` | — | `200` `RoomResponse`, `404` when absent |
| `GET` | `/rooms/:id` | — | `200` `RoomResponse` |
| `GET` | `/rooms/:id/availability` | `from`, `to` (**required**) | `200` `RoomAvailabilityResponse` (single) |
| `GET` | `/rooms/:id/bookings` | `status?`, `from?`, `to?`, `skip?`, `take?` | `200` `BookingResponse[]` |

`CreateRoomDto`: `code` (≤32), `name` (≤120), `description?` (≤2000), `maxGuests` (1–50),
`basePrice` (integer ≥ 0). A duplicate `code` returns `409`.

`/rooms/availability` is the search endpoint you want for a date-range picker — it returns each room
with its `available` flag *and* a priced quote in one round trip.

**Held rooms are included in the results.** A room another guest is mid-checkout on comes back with
`state: 'ON_HOLD'`, `available: false`, and `heldUntil` — the moment that hold lapses. Sold rooms
(`CONFIRMED`/`COMPLETED`) are omitted from the search entirely; they are not coming back for those
dates. So every row in the response is either bookable now or bookable again soon:

```tsx
{rooms.map((r) =>
  r.state === 'ON_HOLD' ? (
    <RoomCard room={r.room} quote={r.quote} disabled
      badge={`Someone is booking this — free again at ${new Date(r.heldUntil!).toLocaleTimeString()}`} />
  ) : (
    <RoomCard room={r.room} quote={r.quote} onBook={() => book(r.room.id)} />
  ),
)}
```

Do not send a booking for an `ON_HOLD` room: the exclusion constraint rejects it with a `409`, which
is correct but reads to the guest as a failure rather than a queue. Re-run the search after
`heldUntil` instead — a lapsed hold is swept within a minute, after which the room turns
`AVAILABLE`. Treat `heldUntil` as a hint, not a promise: the holder may still confirm, in which case
the room leaves the results entirely on the next search.

The single-room endpoint `/rooms/:id/availability` reports the same three states, so a deep link to a
held room can show the same "free again at …" affordance. An inactive (retired) room reports `BOOKED`
rather than `ON_HOLD` — there is nothing to wait for.

`/rooms/code/:code` resolves the unique, human-readable `Room.code` (`SUONG`, `THONG`, `SUOI`,
`KHOI`, `QUY`, `DOI`), so a public route can be `/stays/SUONG` instead of a numeric id. Unknown code →
`404` `NOT_FOUND` with the standard error envelope. The lookup is exact and case-sensitive.

### Tours — `/tours`

| Method | Path | Query / Body | Returns |
|---|---|---|---|
| `POST` | `/tours` | `CreateTourDto` | `201` `TourResponse` |
| `GET` | `/tours` | `skip?`, `take?` | `200` `TourResponse[]` |
| `GET` | `/tours/availability` | `from`, `to` (**required**), `seats?` | `200` `AvailableDepartureResponse[]` |
| `GET` | `/tours/slug/:slug` | — | `200` `TourResponse`, `404` when absent |
| `GET` | `/tours/:id` | — | `200` `TourResponse` |
| `POST` | `/tours/:id/departures` | `CreateTourDepartureDto` | `201` `TourDepartureResponse` |
| `GET` | `/tours/:id/departures` | `from?`, `to?` | `200` `TourDepartureResponse[]` |
| `GET` | `/tours/:id/availability` | `from`, `to` (**required**), `seats?` | `200` `AvailableDepartureResponse[]` |
| `GET` | `/tours/:id/bookings` | `status?`, `from?`, `to?`, `skip?`, `take?` | `200` `BookingResponse[]` |

`CreateTourDto`: `slug` (≤120, unique), `name` (≤120), `description?`, `durationDays` (≥1),
`basePricePerPerson` (integer ≥ 0).

`CreateTourDepartureDto`: `departureDate` (ISO instant, **not in the past**), `capacity` (≥1),
`priceOverride?` (integer ≥ 0).

`/tours/slug/:slug` resolves the unique `Tour.slug` (`cau-dat-sunrise`, `pine-and-waterfall`,
`coffee-hills`), so a public route can be `/journeys/cau-dat-sunrise` instead of a numeric id. Unknown
slug → `404` `NOT_FOUND`.

Route-order note: `/rooms/code/:code` and `/tours/slug/:slug` are declared **before** `/rooms/:id`
and `/tours/:id`, so a code or slug can never be matched as an id. Every `:id` segment also runs
through `ParseIntPipe`, so a non-numeric id is a `400` rather than a lookup that cannot match.

### Price rules — `/price-rules`

| Method | Path | Query / Body | Returns |
|---|---|---|---|
| `POST` | `/price-rules` | `CreatePriceRuleDto` | `201` `PriceRuleResponse` |
| `GET` | `/price-rules` | `roomId?`, `tourId?` | `200` `PriceRuleResponse[]` |
| `DELETE` | `/price-rules/:id` | — | `204` no body |

`CreatePriceRuleDto`: `name`, **exactly one** of `roomId` / `tourId` (both or neither → `400`),
`startDate?`, `endDate?` (ISO instants; `endDate` must not precede `startDate`), `daysOfWeek?`
(0–6, ≤7 entries), `amount` (integer ≥ 0), `priority?`.

Resolution when several rules match: explicit `priority`, then specificity, then the narrower date
window, then recency. The winner is frozen into `booking_lines` at creation time, so editing a rule
later never rewrites an existing booking's price.

### Bookings — `/bookings`

| Method | Path | Query / Body | Returns |
|---|---|---|---|
| `POST` | `/bookings/quote` | `QuotePriceDto` | `200` `PriceQuoteResponse` |
| `POST` | `/bookings` | `CreateBookingDto` | `201` `BookingResponse` (`PENDING`) |
| `GET` | `/bookings/:id` | — | `200` `BookingResponse` |
| `GET` | `/bookings/reference/:reference` | — | `200` `BookingResponse` |
| `POST` | `/bookings/:id/confirm` | — | `200` `BookingResponse` (`CONFIRMED`) |
| `POST` | `/bookings/:id/cancel` | `{ reason?: string }` | `200` `BookingResponse` (`CANCELLED`) |
| `GET` | `/bookings/cancel/:token` | — | `200` `BookingResponse` — **read-only** |
| `POST` | `/bookings/cancel/:token` | `{ reason?: string }` | `200` `BookingResponse` |

`CreateBookingDto`:

```ts
{
  type: 'ROOM' | 'TOUR',

  // ROOM
  roomId?: number,
  checkIn?: string,          // ISO instant, not in the past
  checkOut?: string,         // ISO instant, on a later house day than checkIn

  // TOUR
  tourDepartureId?: number,
  seats?: number,            // ≥1, must equal `guests`

  guests: number,            // ≥1, ≤ room.maxGuests for ROOM
  customer: { name: string; email: string; phone: string },
  notes?: string,            // ≤2000
}
```

`QuotePriceDto` is the same minus `guests`, `customer` and `notes`.

Route-order note: `/bookings/reference/:reference` and `/bookings/cancel/:token` are declared before
`/bookings/:id`, so a booking can never be looked up under the literal id `"reference"`. `:id` is
parsed as an integer, so a non-numeric value is a `400`; `reference` and `token` stay strings.

### Users — `/users`

| Method | Path | Query / Body | Returns |
|---|---|---|---|
| `POST` | `/users` | `{ name, email, password }` (password ≥6) | `201` `UserResponse` |
| `GET` | `/users` | — | `200` `UserResponse[]` |
| `GET` | `/users/:id` | — | `200` `UserResponse` |
| `PUT` | `/users/:id` | `{ name?, email?, password? }` | `200` `UserResponse` |
| `DELETE` | `/users/:id` | — | `204` no body |
| `PATCH` | `/users/:id/location` | `{ latitude, longitude }` | `200` `UserResponse` |
| `GET` | `/users/:id/nearby` | `radius?` (integer km, default `10`) | `200` `UserWithDistanceResponse[]` |

`PATCH /users/:id/location` also reverse-geocodes the coordinates and fills `locationName`, so it
needs `api-location` running as well as `api-user`. `radius` goes through `ParseIntPipe` — a
non-integer like `?radius=1.5` returns `400`.

### Notifications and email — fire-and-forget

These publish to RabbitMQ and return immediately. **`202 Accepted` means queued, not delivered.**

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/notifications` | `{ userId, title, message, type?, data? }` | `202` `{ queued: true, requestId }` |
| `POST` | `/notifications/broadcast` | `{ title, message, type?, data? }` | `202` `{ queued: true, requestId }` |
| `POST` | `/emails` | `SendEmailDto` | `202` `{ queued: true, requestId }` |
| `POST` | `/emails/gmail` | `SendEmailDto` | `202` `{ queued: true, provider: 'gmail', requestId }` — same payload, delivered through the Gmail API instead of SES |

`type` is one of `'info' | 'success' | 'warning' | 'error'`. `title` ≤120, `message` ≤1000.

`SendEmailDto`: `to` (non-empty array of emails), `subject` (≤200), `from?`, `cc?`, `bcc?`,
`replyTo?`, `text?` (≤10000), `html?` (≤50000), `configurationSetName?`.

Do not render "Sent ✓" off a 202. Show "Sending…" and confirm via the Socket.IO channel (§8) if you
need real delivery feedback.

### Chatbot — `/chatbot`

| Method | Path | Query / Body | Returns |
|---|---|---|---|
| `GET` | `/chatbot/sse` | `prompt` | `text/event-stream` |
| `GET` | `/chatbot/strict-sse` | `prompt` | `text/event-stream` — answers only from uploaded documents |
| `POST` | `/chatbot/documents/upload` | `multipart/form-data` | `200` `{ documentId, fileName, chunkCount }` |

Upload fields: `file` (required, UTF-8 text — an empty file is `400`), `fileName?` (falls back to the
upload's own filename), `chunkSize?`, `chunkOverlap?`. See §9 for consumption code.

### Payment — `/payment`

| Method | Path | Returns |
|---|---|---|
| `GET` | `/payment/bank-list` | `200` VNPay bank list |
| `POST` | `/payment/generate-qr` | `200` QR payload |
| `POST` | `/payment/generate-payment-url` | `200` redirect URL |
| `POST` | `/payment/generate-return-url` | `200` `{ verified, success, message, transaction, amount, data }` |
| `GET` | `/payment/ipn` | `200` echoes the query string |

⚠️ **These are not wired up yet.** The gateway forwards an empty `{}` payload to the payment service
for all three `POST` routes, so any body you send is discarded — the downstream services expect a
`PaymentRequest` (amount, order id, return URL) that never arrives. `GET /payment/ipn` at the gateway
just echoes its query rather than calling the verifier. Payment is also not connected to the booking
domain: confirming a booking takes no money. Do not build a checkout against these until the gateway
forwards real payloads.

---

## 7. The booking flow

The one flow worth walking through end to end, because its states are visible to the user.

```
   POST /rooms/availability?from&to        ← browse, priced
              │
   POST /bookings/quote                    ← firm price, no slot held  (200)
              │
   POST /bookings                          ← PENDING, slot HELD        (201)
              │                              holdExpiresAt ≈ now + 3 min
       ┌──────┴───────┬─────────────────┐
       ▼              ▼                 ▼
   /confirm       /cancel          hold expires
   CONFIRMED      CANCELLED        EXPIRED (swept every ~10 min)
       │
       ▼
   COMPLETED (nightly, after the stay/departure)
```

**1 — Quote.** `POST /bookings/quote` prices a room stay or a departure without touching
availability. Use it to show a breakdown before the customer commits. It holds nothing.

**2 — Create.** `POST /bookings` returns a `PENDING` booking with `holdExpiresAt` (default 3
minutes, `BOOKING_HOLD_TTL_MINUTES`). The slot is genuinely held from this moment. Render a
countdown from `holdExpiresAt`; when it lapses, stop offering "confirm" and re-check availability.
A delayed RabbitMQ message flips the row to `EXPIRED` at that exact moment, so it is usually already
`EXPIRED` by the time you look — but a broker hiccup can leave a booking past its deadline still
reading `PENDING`. Trust the timestamp, not the status.

**3 — Confirm.** `POST /bookings/:id/confirm` transitions to `CONFIRMED` and triggers the customer
and owner emails. The transition is its own idempotency guard: a double-submit returns
`409 CONFLICT` with `"… is already confirmed"` and sends no second email. Treat that specific 409 as
success — refetch the booking rather than showing a failure.

**4 — Cancel.** `POST /bookings/:id/cancel` with an optional `reason`. Rejected with `409` when the
booking is already `CANCELLED`/`EXPIRED`, already `COMPLETED`, or when the stay has already started.

### Handling the availability race

`409 CONFLICT` on `POST /bookings` is a normal outcome, not a bug — availability is enforced by a
Postgres exclusion constraint and a conditional seat update, so two clients booking the last slot
produce exactly one winner. The messages you will see:

- `"Those dates are no longer available for this room"`
- `"That departure no longer has enough seats"`
- `"That departure is no longer open for booking"`

Do not auto-retry — the slot is gone. Refresh availability and let the user pick again.

### The emailed cancel link

The confirmation email contains `PUBLIC_BASE_URL/bookings/cancel/<token>` — the backend appends
that path literally, **without** the `/api` prefix. Point `PUBLIC_BASE_URL` at your frontend origin
so the link lands on a page of yours (a raw gateway link would need `PUBLIC_BASE_URL` to end in
`/api`, and would render JSON at the customer). That page should:

1. call `GET /bookings/cancel/:token` to render the booking for review, then
2. call `POST /bookings/cancel/:token` only on an explicit button press.

**Never cancel on page load.** Mail clients, corporate scanners and link-preview bots fetch every URL
in a message; a `GET` that cancelled would cancel bookings nobody ever clicked. The backend keeps the
`GET` side-effect free for exactly this reason — your frontend must too.

---

## 8. Realtime notifications (Socket.IO)

The gateway proxies `/socket.io` (HTTP and WebSocket upgrade) to `api-notification`, so connect to
the **gateway origin** — the notification service port is an implementation detail.

> ⚠️ **Do not reuse your REST base URL here.** The proxy sits at the origin root, outside the `/api`
> global prefix. Socket.IO reads the path of the URL you give it as the *namespace*, so
> `io('http://localhost:3000/api/notification/u1')` connects to a namespace called
> `/api/notification/u1` and is rejected. Keep the origin in its own env var
> (`VITE_SOCKET_URL = http://localhost:3000`) or strip the suffix: `VITE_API_URL.replace(/\/api$/, '')`.

- **Namespace:** anything starting with `/notification`. The convention is `/notification/<userId>`.
- **Identity:** `handshake.auth.userId`, falling back to the `userId` query param. A socket that
  supplies neither is **disconnected immediately** — always pass it.
- **Event:** `notification`, for both targeted and broadcast messages.

```ts
import { io, type Socket } from 'socket.io-client';

export interface NotificationEvent {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: Record<string, unknown>;
  createdAt: string;   // ISO
  userId?: string;     // absent on broadcasts
}

/** Gateway ORIGIN — no `/api`. The socket proxy is mounted outside the global prefix. */
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/api\/?$/, '');

export function connectNotifications(
  userId: string,
  onNotification: (n: NotificationEvent) => void,
): Socket {
  const socket = io(`${SOCKET_URL}/notification/${userId}`, {
    transports: ['websocket', 'polling'],
    auth: { userId },              // required — no userId means instant disconnect
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('notification', onNotification);
  socket.on('connect_error', (err) => console.error('[notifications]', err.message));

  return socket;
}
```

Server-side, each user joins a room `user:<userId>`. `POST /notifications` emits into that room;
`POST /notifications/broadcast` emits to the whole namespace.

Two things to design around:

- **Identity is unauthenticated.** Any client can claim any `userId` and receive that user's
  notifications. Real auth (a JWT on the handshake) is a documented TODO in the socket gateway.
- **Nothing is persisted.** Notifications are pushed to *connected* sockets only. There is no
  history endpoint and no replay after reconnect — a user offline when one fires never sees it. If
  you need an inbox, it has to be built.

In React, connect in an effect and always disconnect on cleanup:

```ts
useEffect(() => {
  if (!userId) return;
  const socket = connectNotifications(userId, addToast);
  return () => { socket.disconnect(); };
}, [userId]);
```

---

## 9. Streaming chat (SSE)

`GET /chatbot/sse?prompt=…` streams tokens as `text/event-stream`. `strict-sse` is the same
contract but answers only from uploaded documents. Like every other route these sit under the
prefix — `http://localhost:3000/api/chatbot/sse` — so the `BASE_URL` from §4 already carries it.

`EventSource` is the simplest option — the prompt goes in the query string, so URL-encode it:

```ts
const source = new EventSource(
  `${BASE_URL}/chatbot/sse?prompt=${encodeURIComponent(prompt)}`,
);

let answer = '';
source.onmessage = (e) => {
  answer += e.data;
  render(answer);
};

// EventSource cannot distinguish "stream finished" from "connection dropped";
// it just fires onerror and would auto-reconnect — re-running the prompt.
source.onerror = () => source.close();
```

`EventSource` sends no custom headers, so these calls carry no `x-request-id`. If you need
correlation or want to abort mid-stream, use `fetch` with a reader instead:

```ts
const controller = new AbortController();
const res = await fetch(`${BASE_URL}/chatbot/sse?prompt=${encodeURIComponent(prompt)}`, {
  headers: { Accept: 'text/event-stream', 'x-request-id': crypto.randomUUID() },
  signal: controller.signal,
});

const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += value;

  // SSE frames are separated by a blank line
  const frames = buffer.split('\n\n');
  buffer = frames.pop() ?? '';
  for (const frame of frames) {
    for (const line of frame.split('\n')) {
      if (line.startsWith('data:')) append(line.slice(5).trim());
    }
  }
}
```

Errors before the stream opens arrive as a normal JSON error body with the usual `code`. Once the
stream is open the status is already `200`, so a mid-stream failure surfaces as the connection
closing — show a partial answer with a retry affordance rather than an error page.

### Uploading a document

```ts
const form = new FormData();
form.append('file', file);          // UTF-8 text; empty file → 400
form.append('fileName', file.name); // optional
form.append('chunkSize', '1000');   // optional
form.append('chunkOverlap', '200'); // optional

// Do NOT set Content-Type — the browser must add the multipart boundary.
const result = await api<{ documentId: string; fileName: string; chunkCount: number }>(
  '/chatbot/documents/upload',
  { method: 'POST', body: form },
);
```

---

## 10. Running the backend locally

```bash
npm install
docker compose up -d          # Postgres primary + replica, RabbitMQ
npx prisma migrate deploy
npx prisma generate

npm run gateway:dev           # :3000  ← the only port a frontend touches; REST under /api
npm run user:dev              # :3001
npm run location:dev          # :3002
npm run payment:dev           # :3003
npm run chatbot:dev           # :3004
npm run notification:dev      # :3005
npm run booking:dev           # :3006
```

A quick smoke test, prefix included:

```bash
curl -i http://localhost:3000/api/rooms          # 200 (or 502 if api-booking is down)
curl -i http://localhost:3000/rooms              # 404 — the prefix is not optional
```

The gateway starts even when a downstream service is down — those routes then fail at call time with
`502 DEPENDENCY_FAILURE`. Seeing 502s from one resource while the rest work usually means you forgot
to start that service. A blanket `404` on every route, by contrast, almost always means a missing
`/api`.

A ready-made harness lives in the repo root: `websocket-test-client.html` connects to the origin and
is unaffected by the prefix.

---

## 11. Integration checklist

- [ ] Put `/api` in the REST base URL once — and keep the Socket.IO URL on the bare origin.
- [ ] Build request URLs by concatenation, not `new URL(path, base)` — the latter eats the prefix.
- [ ] Generate and send `x-request-id` on every request; log it with failures.
- [ ] Branch on `error.code`, never on `error.message`.
- [ ] Treat `409` on `POST /bookings` as a normal race — refresh availability, do not auto-retry.
- [ ] Treat `409 "already confirmed"` as success and refetch.
- [ ] Send every date as a full ISO instant with a zone, seconds and milliseconds zeroed.
- [ ] Render every time on the house clock (`Asia/Ho_Chi_Minh`), hour included.
- [ ] Render money as integer VND — no division by 100.
- [ ] Count nights as the difference in house-clock calendar days, not elapsed hours (half-open range).
- [ ] Drive the PENDING countdown from `holdExpiresAt`, not from `status`.
- [ ] Split the emailed cancel link: `GET` renders, `POST` cancels — never cancel on page load.
- [ ] Pass `auth.userId` on the Socket.IO handshake, and disconnect on unmount.
- [ ] Show `202` responses as "queued", not "sent".
- [ ] Close the `EventSource` in `onerror`, or it silently re-runs the prompt.
- [ ] Remember there is no auth: do not expose admin-shaped routes in a public build.
