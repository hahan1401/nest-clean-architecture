import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Thong Dong Retreat - the real catalogue.
 *
 * Every id, code, slug, name, description and price below is copied verbatim
 * from the frontend fixture at `homestay-booking-fe/lib/content/retreat.ts`.
 * Reusing the fixture uuids means a component that was rendering the fixture
 * keeps rendering the same entity once it is pointed at the gateway - and it
 * makes every upsert below idempotent.
 */

/**
 * Today at UTC midnight, then N whole days on. Departures are seeded relative
 * to seed time so a fresh database always has future departures to sell - the
 * same trick `DEPARTURE_FIXTURES` uses on the frontend.
 *
 * @db.Date columns materialise as UTC midnight, so calendar dates are built
 * with Date.UTC (or from a date-only ISO string). Never `new Date(y, m, d)` -
 * that is local time and shifts the night by one in any non-UTC process.
 */
const dayFromToday = (offsetDays: number): Date => {
  const today = new Date();
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offsetDays),
  );
};

// --- Rooms ------------------------------------------------------------------

// All prices are whole VND - no minor unit.
const ROOMS = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    code: 'SUONG',
    name: 'Sương',
    description:
      'The smallest room, and the one the fog reaches first. East window, one bed, a chair that faces out.',
    maxGuests: 2,
    basePrice: 1_150_000,
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    code: 'THONG',
    name: 'Thông',
    description:
      'Level with the pine canopy. You hear the trees before you hear anything else.',
    maxGuests: 2,
    basePrice: 1_350_000,
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    code: 'SUOI',
    name: 'Suối',
    description:
      'Ground floor, opening onto the stream path. Warmest room in the house in January.',
    maxGuests: 2,
    basePrice: 1_450_000,
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    code: 'KHOI',
    name: 'Khói',
    description: 'Built around the wood stove. Three can sleep here; two will want to.',
    maxGuests: 3,
    basePrice: 1_650_000,
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    code: 'QUY',
    name: 'Dã Quỳ',
    description:
      'Corner room over the field that turns yellow in November. Two beds, a long desk.',
    maxGuests: 4,
    basePrice: 2_100_000,
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
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
    id: '33333333-3333-4333-8333-000000000001',
    slug: 'cau-dat-sunrise',
    name: 'Sunrise over the Cầu Đất tea terraces',
    description:
      'Leave in the dark, arrive as the fog burns off the rows. Back at the house by lunch.',
    durationDays: 1,
    basePricePerPerson: 690_000,
  },
  {
    id: '33333333-3333-4333-8333-000000000002',
    slug: 'pine-and-waterfall',
    name: 'Pine forest and the lower waterfall',
    description:
      'Eleven kilometres on foot, most of it downhill, with a long stop where the water is loudest.',
    durationDays: 1,
    basePricePerPerson: 850_000,
  },
  {
    id: '33333333-3333-4333-8333-000000000003',
    slug: 'coffee-hills',
    name: 'Three days in the coffee hills',
    description:
      'Picking, washing, roasting - with the people who do it, in the season they do it. Two nights away from the house.',
    durationDays: 3,
    basePricePerPerson: 4_200_000,
  },
];

/**
 * Mirrors DEPARTURE_FIXTURES. `id` is fixed and `departureDate` is derived, so
 * re-seeding on a later day rolls the same seven departures forward instead of
 * accumulating a new set - which is what keeps this idempotent while the dates
 * stay relative to today.
 */
const DEPARTURES = [
  { id: '44444444-4444-4444-8444-000000000001', slug: 'cau-dat-sunrise', inDays: 3, capacity: 8, bookedSeats: 6 },
  { id: '44444444-4444-4444-8444-000000000002', slug: 'pine-and-waterfall', inDays: 5, capacity: 10, bookedSeats: 2 },
  { id: '44444444-4444-4444-8444-000000000003', slug: 'cau-dat-sunrise', inDays: 10, capacity: 8, bookedSeats: 1 },
  { id: '44444444-4444-4444-8444-000000000004', slug: 'coffee-hills', inDays: 12, capacity: 6, bookedSeats: 5, priceOverride: 3_900_000 },
  { id: '44444444-4444-4444-8444-000000000005', slug: 'pine-and-waterfall', inDays: 17, capacity: 10, bookedSeats: 0 },
  { id: '44444444-4444-4444-8444-000000000006', slug: 'cau-dat-sunrise', inDays: 24, capacity: 8, bookedSeats: 0 },
  { id: '44444444-4444-4444-8444-000000000007', slug: 'coffee-hills', inDays: 31, capacity: 6, bookedSeats: 2 },
];

// --- Weekend pricing --------------------------------------------------------

/**
 * The frontend prices Friday and Saturday nights at 1.25x base. Here that is
 * one real PriceRule per room: daysOfWeek uses Postgres DOW numbering
 * (0 = Sunday .. 6 = Saturday), which is also what Date#getUTCDay returns.
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

async function seedBookingDomain() {
  await removeLegacySampleData();

  for (const room of ROOMS) {
    await prisma.room.upsert({ where: { id: room.id }, update: room, create: room });
  }

  for (const tour of TOURS) {
    await prisma.tour.upsert({ where: { id: tour.id }, update: tour, create: tour });
  }

  const tourIdBySlug = new Map(TOURS.map((tour) => [tour.slug, tour.id]));

  for (const departure of DEPARTURES) {
    const data = {
      tourId: tourIdBySlug.get(departure.slug)!,
      departureDate: dayFromToday(departure.inDays),
      capacity: departure.capacity,
      bookedSeats: departure.bookedSeats,
      priceOverride: departure.priceOverride ?? null,
    };
    await prisma.tourDeparture.upsert({
      where: { id: departure.id },
      update: data,
      create: { id: departure.id, ...data },
    });
  }

  for (const [index, room] of ROOMS.entries()) {
    const rule = {
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
      name: `Friday and Saturday nights - ${room.name}`,
      roomId: room.id,
      daysOfWeek: WEEKEND_DAYS_OF_WEEK,
      amount: weekendAmount(room.basePrice),
      priority: 10,
    };
    await prisma.priceRule.upsert({ where: { id: rule.id }, update: rule, create: rule });
  }

  const firstDeparture = dayFromToday(DEPARTURES[0].inDays).toISOString().slice(0, 10);
  const lastDeparture = dayFromToday(DEPARTURES[DEPARTURES.length - 1].inDays)
    .toISOString()
    .slice(0, 10);

  console.log(
    `Thong Dong Retreat seeded: ${ROOMS.length} rooms, ${TOURS.length} journeys, ` +
      `${DEPARTURES.length} departures (${firstDeparture} .. ${lastDeparture}), ` +
      `${ROOMS.length} weekend price rules.`,
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
