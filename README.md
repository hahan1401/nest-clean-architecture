# Thong Dong Retreat — booking engine

The backend for **Thong Dong Retreat**, a six-room homestay on a pine ridge above Đà Lạt.
It sells two things: **a room for a range of nights**, and **a seat on a dated journey**.

NestJS 11 monorepo — one HTTP gateway in front of seven services that speak TCP and
RabbitMQ — on Prisma 7 / PostgreSQL 17 with a streaming read replica and pgvector.

| | |
|---|---|
| **Architecture** | [`ARCHITECTURE.md`](./ARCHITECTURE.md) — layering, error model, message patterns, every endpoint, the booking invariants |
| **API contract** | [`docs/frontend-api-integration.md`](./docs/frontend-api-integration.md) — what a client sends and gets back |
| **Product** | [`../README.md`](../README.md) — the house, the domain, and the frontend |

---

## Quickstart

```bash
docker compose up -d          # postgres primary + replica, rabbitmq
cp .env.example .env.local    # then fill EMAIL_FROM, HOMESTAY_OWNER_EMAIL, GEMINI_API_KEY, AWS_*
npm install
npx prisma migrate deploy && npx prisma generate && npx prisma db seed

npm run gateway:dev           # :3000 — every route under /api
npm run booking:dev           # :3006 — rooms, tours, bookings
```

The gateway and `api-booking` are enough for the whole guest flow. Start
`user`, `location`, `payment`, `chatbot`, `notification` and `email` only when you
need them — the gateway proxies lazily, so an unstarted service fails its own routes
and nothing else.

The seed writes the real catalogue: six rooms (`SUONG`, `THONG`, `SUOI`, `KHOI`, `QUY`,
`DOI`), three journeys (`cau-dat-sunrise`, `pine-and-waterfall`, `coffee-hills`) and seven
departures dated relative to seed time, so a fresh database always has something in the
future to sell. It is keyed on the natural keys (`Room.code`, `Tour.slug`,
`(tourId, departureDate)`) and is safe to re-run.

---

## What it does

| | |
|---|---|
| **Catalogue** | Rooms with a nightly base price and a guest cap; tours with a per-person price and dated, seat-capped departures. |
| **Availability** | Every room the guest count fits, whatever its state for those dates — free, `ON_HOLD` while another guest is mid-checkout, or `BOOKED` with the moment it frees up. Free and held rooms carry a price quote. The house never looks smaller than it is. |
| **Pricing** | `PriceRule` overrides per room or tour, by date window and/or weekday, resolved by a pure function and then **frozen** into `booking_lines`. Later price edits never rewrite history. |
| **Holds** | `POST /api/bookings` genuinely reserves the slot for 3 minutes and returns `holdExpiresAt`. A delayed RabbitMQ message, published when the hold starts and timed to the second, releases it. |
| **Stays** | Booked as instants — the guest picks the hour as well as the day, and the house keeps no check-in or check-out hour. A `tstzrange` exclusion constraint enforces the one rule there is: the next guest may arrive an hour after the last one leaves, so a room turns over on its own checkout day, which a date-only range called an overlap. |
| **Confirmation** | `PENDING → CONFIRMED` commits before the broker is touched, then fires two emails through RabbitMQ → AWS SES. |
| **Cancellation** | Staff-side by id, or customer-side through a 32-byte token that travels only inside the customer's email and never appears in an API response. |
| **Chatbot** | SSE streaming answers, grounded in documents chunked and embedded into pgvector. |
| **Notifications** | RabbitMQ topic (once per event) and fanout (every replica) into a Socket.IO namespace the gateway proxies at the origin root. |
| **Payments** | VNPay adapter — bank list, QR, hosted payment URL, return verification. **Not wired into the booking flow**: confirming a booking takes no money today. |

### Two guarantees that do not depend on application code

- A room cannot be double-booked, or sold before it has been cleaned: a Postgres
  `EXCLUDE USING gist` constraint over `room_id` + `room_stay_occupancy(check_in, check_out)`
  — the stay plus its turnover hour, as a half-open `tstzrange` — restricted to slot-holding
  statuses. Same-day turnover stays legal; an arrival inside the hour does not.
- A departure cannot be oversold: a conditional `UPDATE` on `booked_seats` backed by a
  `CHECK`, correct at READ COMMITTED with no `FOR UPDATE` and no retry loop.

Both surface as `409 CONFLICT`. That is a normal outcome for two guests racing the last
slot — clients must refresh availability rather than retry.

### Two conventions that are easy to get wrong

- **Money is a whole number of VND** in `Int` columns. `250000` means ₫250,000. No minor
  unit, no scaling factor.
- **Every date is an instant.** Every temporal column is `timestamptz(3)`; every date on
  the wire is a full ISO 8601 instant with a zone, in *and* out, and a bare `"2027-02-14"`
  is a 400. Where a *day* still matters — counting nights, matching a rule's `daysOfWeek`,
  deciding what is in the past — it is the **house** day (Asia/Ho_Chi_Minh, UTC+7, no DST),
  and `apps/api-booking/src/domain/models/house-clock.ts` is the only place that conversion
  lives. Reading a weekday with `getUTCDay()` is wrong from 17:00Z onwards.

---

## Layout

```
apps/
├── api-gateway/       :3000  HTTP entry point — validation, correlation ids, proxy
├── api-user/          :3001  users, nearby search
├── api-location/      :3002  reverse geocoding (Nominatim)
├── api-payment/       :3003  VNPay
├── api-chatbot/       :3004  streaming answers + document ingestion
├── api-notification/  :3005  RabbitMQ consumer → Socket.IO
├── api-email/            —   RabbitMQ consumer (`email.send`) → AWS SES
├── api-gmail/            —   RabbitMQ consumer (`email.send.gmail`) → Google Gmail API
└── api-booking/       :3006  rooms, tours, departures, price rules, bookings, daily jobs
libs/
├── common/       service tokens, message patterns, DTOs, error model, filters, logging
├── database/     Prisma client factory, read-replica routing, entities, DatabaseModule
├── middlewares/  correlation request id
└── types/        cross-service types
prisma/           schema, migrations, seed
docs/             the frontend API contract + the database reference
```

Every service is layered the same way — `presentation/` → `application/` → `domain/` ←
`infrastructure/`, dependencies pointing inward, `domain/` free of framework imports.
Repository and port contracts are abstract classes so they double as DI tokens.
[`ARCHITECTURE.md`](./ARCHITECTURE.md) is the full account.

---

## Commands

```bash
npm run <service>:dev      # gateway | user | location | payment | chatbot | booking | notification | email
npm run build:<service>
npm test                   # jest; specs are co-located as *.spec.ts under apps/ and libs/

npx prisma migrate dev --name <short_snake_case> --create-only   # then hand-edit the SQL
npx prisma migrate dev
npx prisma db seed
npx prisma migrate deploy  # CI / production — never `migrate dev`

# The gate before committing
npx tsc --noEmit && npx eslint "apps/**/*.ts" "libs/**/*.ts" && npx jest
```

> **Migrations need reading before applying.** Prisma models neither `CHECK` nor `EXCLUDE`,
> so it emits a `DROP` for the GiST exclusion index on every `migrate dev`, and Postgres
> silently drops any constraint mentioning a retyped column. After a migration that touches
> `bookings`, `rooms`, `tours` or `tour_departures`, confirm the constraints survived:
> ```sql
> SELECT conrelid::regclass, conname FROM pg_constraint
> WHERE connamespace = 'public'::regnamespace AND contype IN ('c','x') ORDER BY 1, 2;
> ```

---

## Status

**There is no authentication anywhere.** Every gateway route is public, including the
operator-shaped ones — `POST /api/rooms`, `POST /api/price-rules`,
`POST /api/bookings/:id/confirm`. This is a pre-auth codebase and is not safe to expose to
the public internet as it stands.

Also open:

- Payment is not connected to booking. The gateway posts an empty `{}` to `api-payment`,
  and `/api/payment/ipn` echoes its query string back rather than verifying anything.
- The cancellation token is logged in plaintext. `CREDENTIAL_PATH_PREFIXES` in
  `libs/common/src/logger/pino-http.config.ts` matches `/bookings/cancel/` with
  `startsWith`, but the gateway now sees `/api/bookings/cancel/<token>`.
- `npm run start:prod` points at `dist/apps/nest-clean-architecture/main`, which no build
  produces; run the built gateway at `dist/apps/api-gateway/main` instead.
