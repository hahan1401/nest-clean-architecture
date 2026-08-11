import { PrismaClient } from '@prisma/client';
import type { ITXClientDenyList } from '@prisma/client/runtime/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';

/**
 * DI token for the read-replica aware Prisma client.
 *
 * The client is built with `$extends()`, which returns a new object rather than a
 * `PrismaClient` subclass, so it cannot be injected as a class. Inject it with
 * `@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient`.
 */
export const PRISMA_SERVICE = Symbol('PRISMA_SERVICE');

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const createAdapter = (connectionString: string, role: 'primary' | 'replica'): PrismaPg =>
  new PrismaPg({
    connectionString,
    max: toPositiveInt(
      role === 'replica' ? process.env.DB_REPLICA_POOL_MAX : process.env.DB_POOL_MAX,
      10,
    ),
    connectionTimeoutMillis: toPositiveInt(process.env.DB_CONNECTION_TIMEOUT_MS, 5_000),
    idleTimeoutMillis: toPositiveInt(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
    statement_timeout: toPositiveInt(process.env.DB_STATEMENT_TIMEOUT_MS, 10_000),
    // Surfaces the role in pg_stat_activity, so replica traffic is attributable.
    application_name: `${process.env.SERVICE_NAME || 'nest-app'}-${role}`,
  });

/** Comma-separated replica URLs; empty when no replicas are configured. */
const parseReplicaUrls = (): string[] =>
  (process.env.DATABASE_REPLICA_URLS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

export const createPrismaClient = () => {
  const primaryUrl = process.env.DATABASE_URL;

  if (!primaryUrl) {
    throw new Error('DATABASE_URL must be set before creating the Prisma client.');
  }

  const primary = new PrismaClient({ adapter: createAdapter(primaryUrl, 'primary') });

  const replicas = parseReplicaUrls().map(
    (url) => new PrismaClient({ adapter: createAdapter(url, 'replica') }),
  );

  // With no replicas configured the primary stands in as its own replica, so the
  // client keeps one shape across environments and `$replica()` stays safe to call.
  return primary.$extends(readReplicas({ replicas: replicas.length ? replicas : [primary] }));
};

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * Transaction client handed to `$transaction()` callbacks. The extended client's
 * `tx` is no longer assignable to `Prisma.TransactionClient`, so use this instead.
 * Everything inside a transaction runs on the primary.
 */
export type ExtendedTransactionClient = Omit<ExtendedPrismaClient, ITXClientDenyList>;
