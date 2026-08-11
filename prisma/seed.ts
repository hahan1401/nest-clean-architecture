import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Thong Dong Retreat - the real catalogue.
 *
 * Every code, slug, name, description and price below is copied verbatim from
 * the frontend fixture at `homestay-booking-fe/lib/content/retreat.ts`, so a
 * component that was rendering the fixture keeps rendering the same entity once
 * it is pointed at the gateway.
 *
 * Ids are database-assigned integers and therefore deliberately absent here.
 * Idempotency comes from the natural keys instead - `Room.code`, `Tour.slug`,
 * and `(tourId, departureDate)` on a departure - which is also what the public
 * lookup routes use.
 */

/**
 * N whole days from today, at a given hour on the HOUSE clock, as an instant.
 * Departures are seeded relative to seed time so a fresh database always has
 * future departures to sell - the same trick `DEPARTURE_FIXTURES` uses on the
 * frontend.
 *
 * Every temporal column is a timestamptz now, so a seeded departure is a moment
 * and not a day: it leaves at 07:10 on the ridge, which is 00:10Z. The offset is
 * applied as arithmetic (Vietnam is UTC+7 all year) rather than through
 * `new Date(y, m, d, h)`, which would read the *process* timezone and shift the
 * departure by hours in any non-UTC container.
 */
const HOUSE_UTC_OFFSET_HOURS = 7;

const houseTimeFromToday = (offsetDays: number, hour: number, minute = 0): Date => {
  const today = new Date();
  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + offsetDays,
      hour - HOUSE_UTC_OFFSET_HOURS,
      minute,
    ),
  );
};

/** Journeys leave at 07:10 on the ridge. */
const DEPARTURE_HOUR = 7;
const DEPARTURE_MINUTE = 10;

const departureInstant = (offsetDays: number): Date =>
  houseTimeFromToday(offsetDays, DEPARTURE_HOUR, DEPARTURE_MINUTE);

/** `"14/02/2027 07:10"` on the house clock, for the seed summary line. */
const houseMoment = (instant: Date): string => {
  const local = new Date(instant.getTime() + HOUSE_UTC_OFFSET_HOURS * 3_600_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}` +
    ` ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  );
};

// --- Rooms ------------------------------------------------------------------

// All prices are whole VND - no minor unit.
const ROOMS = [
  {
    code: 'SUONG',
    name: 'Sương',
    description:
      'The smallest room, and the one the fog reaches first. East window, one bed, a chair that faces out.',
    maxGuests: 2,
    basePrice: 1_150_000,
  },
  {
    code: 'THONG',
    name: 'Thông',
    description: 'Level with the pine canopy. You hear the trees before you hear anything else.',
    maxGuests: 2,
    basePrice: 1_350_000,
  },
  {
    code: 'SUOI',
    name: 'Suối',
    description:
      'Ground floor, opening onto the stream path. Warmest room in the house in January.',
    maxGuests: 2,
    basePrice: 1_450_000,
  },
  {
    code: 'KHOI',
    name: 'Khói',
    description: 'Built around the wood stove. Three can sleep here; two will want to.',
    maxGuests: 3,
    basePrice: 1_650_000,
  },
  {
    code: 'QUY',
    name: 'Dã Quỳ',
    description: 'Corner room over the field that turns yellow in November. Two beds, a long desk.',
    maxGuests: 4,
    basePrice: 2_100_000,
  },
  {
    code: 'DOI',
    name: 'Đồi',
    description:
      'The whole top floor. A family fits, and so does a small group that wants the ridge to itself.',
    maxGuests: 5,
    basePrice: 2_600_000,
  },
];

// --- Journeys ---------------------------------------------------------------

const TOURS = [
  {
    slug: 'cau-dat-sunrise',
    name: 'Sunrise over the Cầu Đất tea terraces',
    description:
      'Leave in the dark, arrive as the fog burns off the rows. Back at the house by lunch.',
    durationDays: 1,
    basePricePerPerson: 690_000,
  },
  {
    slug: 'pine-and-waterfall',
    name: 'Pine forest and the lower waterfall',
    description:
      'Eleven kilometres on foot, most of it downhill, with a long stop where the water is loudest.',
    durationDays: 1,
    basePricePerPerson: 850_000,
  },
  {
    slug: 'coffee-hills',
    name: 'Three days in the coffee hills',
    description:
      'Picking, washing, roasting - with the people who do it, in the season they do it. Two nights away from the house.',
    durationDays: 3,
    basePricePerPerson: 4_200_000,
  },
];

/**
 * Mirrors DEPARTURE_FIXTURES. `departureDate` is derived from seed time, so
 * `dropRolledDepartures` below clears yesterday's unbooked set first: that rolls
 * the same seven departures forward on a later day instead of accumulating a new
 * set, and re-seeding twice in one day is a no-op because (tourId,
 * departureDate) is unique.
 */
const DEPARTURES = [
  { slug: 'cau-dat-sunrise', inDays: 3, capacity: 8, bookedSeats: 6 },
  { slug: 'pine-and-waterfall', inDays: 5, capacity: 10, bookedSeats: 2 },
  { slug: 'cau-dat-sunrise', inDays: 10, capacity: 8, bookedSeats: 1 },
  { slug: 'coffee-hills', inDays: 12, capacity: 6, bookedSeats: 5, priceOverride: 3_900_000 },
  { slug: 'pine-and-waterfall', inDays: 17, capacity: 10, bookedSeats: 0 },
  { slug: 'cau-dat-sunrise', inDays: 24, capacity: 8, bookedSeats: 0 },
  { slug: 'coffee-hills', inDays: 31, capacity: 6, bookedSeats: 2 },
];

// --- Symbolic pictures --------------------------------------------------------

/**
 * Seed images point at Lorem Picsum rather than a real bucket, since no
 * external store is configured yet - swap the base URL here once one is.
 * Each seed string is deterministic (owner code/slug + index) so re-running
 * the seed always resolves to the same photos instead of drifting.
 */
const IMAGES_PER_ROOM = 3;
const IMAGES_PER_TOUR = 3;

const placeholderImageUrl = (seed: string, width = 1200, height = 800): string =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`;

/**
 * Images have no natural key to upsert on, so each run replaces an owner's
 * set wholesale - simpler than diffing, and safe because nothing else
 * references a RoomImage/TourImage row (cascade delete, no FK pointing in).
 */
async function seedRoomImages(roomIdByCode: Map<string, number>) {
  for (const room of ROOMS) {
    const roomId = roomIdByCode.get(room.code)!;
    await prisma.roomImage.deleteMany({ where: { roomId } });
    await prisma.roomImage.createMany({
      data: Array.from({ length: IMAGES_PER_ROOM }, (_, index) => ({
        roomId,
        url: placeholderImageUrl(`room-${room.code}-${index}`),
        position: index,
        caption: `${room.name} - view ${index + 1}`,
      })),
    });
  }
}

async function seedTourImages(tourIdBySlug: Map<string, number>) {
  for (const tour of TOURS) {
    const tourId = tourIdBySlug.get(tour.slug)!;
    await prisma.tourImage.deleteMany({ where: { tourId } });
    await prisma.tourImage.createMany({
      data: Array.from({ length: IMAGES_PER_TOUR }, (_, index) => ({
        tourId,
        url: placeholderImageUrl(`tour-${tour.slug}-${index}`),
        position: index,
        caption: `${tour.name} - view ${index + 1}`,
      })),
    });
  }
}

// --- Weekend pricing --------------------------------------------------------

/**
 * The frontend prices Friday and Saturday nights at 1.25x base. Here that is
 * one real PriceRule per room: daysOfWeek uses Postgres DOW numbering
 * (0 = Sunday .. 6 = Saturday), read on the house clock so a Friday night is the
 * Friday a guest on the ridge would call it.
 *
 * PriceRule.amount is an absolute price, not a multiplier, so the factor is
 * applied here and rounded to the nearest 1.000 VND exactly as the fixture does.
 */
const WEEKEND_MULTIPLIER = 1.25;
const WEEKEND_DAYS_OF_WEEK = [5, 6];
const weekendAmount = (basePrice: number): number =>
  Math.round((basePrice * WEEKEND_MULTIPLIER) / 1_000) * 1_000;

/** Rooms and tours from the pre-retreat sample data, dropped if unbooked. */
const LEGACY_ROOM_CODES = ['GARDEN', 'BAMBOO', 'RIVERVIEW'];
const LEGACY_TOUR_SLUGS = ['tam-dao-sunrise-trek'];

/**
 * Bookings hold `onDelete: Restrict` on both rooms and departures, so the
 * cleanup deliberately skips anything a booking still points at. Price rules
 * cascade with their room/tour, so they need no separate pass.
 */
async function removeLegacySampleData() {
  const rooms = await prisma.room.deleteMany({
    where: { code: { in: LEGACY_ROOM_CODES }, bookings: { none: {} } },
  });
  const tours = await prisma.tour.deleteMany({
    where: {
      slug: { in: LEGACY_TOUR_SLUGS },
      departures: { none: { bookings: { some: {} } } },
    },
  });

  if (rooms.count || tours.count) {
    console.log(`Removed legacy sample data: ${rooms.count} rooms, ${tours.count} tours.`);
  }
}

/**
 * Departures the previous seed run created and nobody has booked. Dropping them
 * is what stops a run on a later day from leaving the old dates behind next to
 * the freshly rolled ones. `onDelete: Restrict` means a departure a booking
 * points at must survive, so the `bookings: { none: {} }` filter is not an
 * optimisation - without it the delete would throw.
 */
async function dropRolledDepartures(keepDates: Date[]) {
  await prisma.tourDeparture.deleteMany({
    where: {
      tour: { slug: { in: TOURS.map((tour) => tour.slug) } },
      departureDate: { notIn: keepDates },
      bookings: { none: {} },
    },
  });
}

async function seedBookingDomain() {
  await removeLegacySampleData();

  for (const room of ROOMS) {
    await prisma.room.upsert({ where: { code: room.code }, update: room, create: room });
  }

  for (const tour of TOURS) {
    await prisma.tour.upsert({ where: { slug: tour.slug }, update: tour, create: tour });
  }

  const tours = await prisma.tour.findMany({
    where: { slug: { in: TOURS.map((tour) => tour.slug) } },
    select: { id: true, slug: true },
  });
  const tourIdBySlug = new Map(tours.map((tour) => [tour.slug, tour.id]));
  await seedTourImages(tourIdBySlug);

  await dropRolledDepartures(DEPARTURES.map((departure) => departureInstant(departure.inDays)));

  for (const departure of DEPARTURES) {
    const tourId = tourIdBySlug.get(departure.slug)!;
    const departureDate = departureInstant(departure.inDays);
    const data = {
      tourId,
      departureDate,
      capacity: departure.capacity,
      bookedSeats: departure.bookedSeats,
      priceOverride: departure.priceOverride ?? null,
    };
    await prisma.tourDeparture.upsert({
      where: { tourId_departureDate: { tourId, departureDate } },
      update: data,
      create: data,
    });
  }

  const roomIdByCode = new Map(
    (
      await prisma.room.findMany({
        where: { code: { in: ROOMS.map((room) => room.code) } },
        select: { id: true, code: true },
      })
    ).map((room) => [room.code, room.id]),
  );
  await seedRoomImages(roomIdByCode);

  for (const room of ROOMS) {
    const rule = {
      name: `Friday and Saturday nights - ${room.name}`,
      roomId: roomIdByCode.get(room.code)!,
      daysOfWeek: WEEKEND_DAYS_OF_WEEK,
      amount: weekendAmount(room.basePrice),
      priority: 10,
    };
    // (roomId, name) is not a database key, so this is a find-then-write rather
    // than an upsert. Deleting and recreating instead would SetNull the
    // price_rule_id on every booking line that quoted the old rule.
    const existing = await prisma.priceRule.findFirst({
      where: { roomId: rule.roomId, name: rule.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.priceRule.update({ where: { id: existing.id }, data: rule });
    } else {
      await prisma.priceRule.create({ data: rule });
    }
  }

  const firstDeparture = houseMoment(departureInstant(DEPARTURES[0].inDays));
  const lastDeparture = houseMoment(departureInstant(DEPARTURES[DEPARTURES.length - 1].inDays));

  console.log(
    `Thong Dong Retreat seeded: ${ROOMS.length} rooms, ${TOURS.length} journeys, ` +
      `${DEPARTURES.length} departures (${firstDeparture} .. ${lastDeparture}), ` +
      `${ROOMS.length} weekend price rules, ` +
      `${ROOMS.length * IMAGES_PER_ROOM} room images, ${TOURS.length * IMAGES_PER_TOUR} tour images.`,
  );
}

async function main() {
  await prisma.user.createMany({
    data: [
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'hashed_password_1',
      },
      {
        name: 'Bob Smith',
        email: 'bob@example.com',
        password: 'hashed_password_2',
      },
      {
        name: 'Carol White',
        email: 'carol@example.com',
        password: 'hashed_password_3',
      },
    ],
    skipDuplicates: true,
  });

  await seedBookingDomain();

  console.log('Seed data inserted successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
