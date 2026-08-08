import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Fixed ids keep re-runs idempotent through upsert.
const ROOM_IDS = {
  garden: '22222222-2222-4222-8222-222222222201',
  bamboo: '22222222-2222-4222-8222-222222222202',
  riverview: '22222222-2222-4222-8222-222222222203',
};
const TOUR_ID = '33333333-3333-4333-8333-333333333333';

/**
 * Date-only ISO strings are parsed as UTC midnight, which is exactly how Prisma
 * materialises @db.Date columns. Never use `new Date(y, m, d)` here - that is
 * local time and shifts the night by one in any non-UTC process.
 */
const day = (iso: string): Date => new Date(iso);

async function seedBookingDomain() {
  // All prices are whole VND - no minor unit.
  const rooms = [
    { id: ROOM_IDS.garden, code: 'GARDEN', name: 'Garden Room', maxGuests: 2, basePrice: 650_000 },
    { id: ROOM_IDS.bamboo, code: 'BAMBOO', name: 'Bamboo Room', maxGuests: 4, basePrice: 900_000 },
    {
      id: ROOM_IDS.riverview,
      code: 'RIVERVIEW',
      name: 'Riverview Suite',
      maxGuests: 6,
      basePrice: 1_400_000,
    },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({ where: { code: room.code }, update: {}, create: room });
  }

  const tour = await prisma.tour.upsert({
    where: { slug: 'tam-dao-sunrise-trek' },
    update: {},
    create: {
      id: TOUR_ID,
      slug: 'tam-dao-sunrise-trek',
      name: 'Tam Dao Sunrise Trek',
      description: 'Guided pre-dawn trek to the pagoda ridge, breakfast included.',
      durationDays: 1,
      basePricePerPerson: 450_000,
    },
  });

  const departures = [
    { date: '2027-02-13', capacity: 12, priceOverride: null },
    // Priced per departure: this override beats the Tet price rule below.
    { date: '2027-02-15', capacity: 12, priceOverride: 600_000 },
    { date: '2027-02-20', capacity: 8, priceOverride: null },
    { date: '2027-03-06', capacity: 12, priceOverride: null },
  ];

  for (const departure of departures) {
    await prisma.tourDeparture.upsert({
      where: {
        tourId_departureDate: { tourId: tour.id, departureDate: day(departure.date) },
      },
      update: {},
      create: {
        tourId: tour.id,
        departureDate: day(departure.date),
        capacity: departure.capacity,
        priceOverride: departure.priceOverride,
      },
    });
  }

  // daysOfWeek uses Postgres DOW numbering: 0 = Sunday .. 6 = Saturday.
  // Higher priority wins, so Tet (100) beats the weekend surcharge (10).
  await prisma.priceRule.createMany({
    data: [
      {
        name: 'Tet 2027 - Riverview Suite',
        roomId: ROOM_IDS.riverview,
        startDate: day('2027-02-14'),
        endDate: day('2027-02-20'),
        daysOfWeek: [],
        amount: 1_600_000,
        priority: 100,
      },
      {
        name: 'Tet 2027 - Garden Room',
        roomId: ROOM_IDS.garden,
        startDate: day('2027-02-14'),
        endDate: day('2027-02-20'),
        daysOfWeek: [],
        amount: 1_100_000,
        priority: 100,
      },
      {
        name: 'Weekend surcharge - Garden Room',
        roomId: ROOM_IDS.garden,
        daysOfWeek: [5, 6],
        amount: 850_000,
        priority: 10,
      },
      {
        name: 'Weekend surcharge - Bamboo Room',
        roomId: ROOM_IDS.bamboo,
        daysOfWeek: [5, 6],
        amount: 1_150_000,
        priority: 10,
      },
      {
        name: 'Tet 2027 - Sunrise Trek',
        tourId: TOUR_ID,
        startDate: day('2027-02-14'),
        endDate: day('2027-02-20'),
        daysOfWeek: [],
        amount: 550_000,
        priority: 100,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Booking domain seeded: 3 rooms, 1 tour, 4 departures, 5 price rules.');
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
