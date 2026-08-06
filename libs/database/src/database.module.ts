import { Module, Global, Inject, OnModuleDestroy } from '@nestjs/common';
import { PRISMA_SERVICE, createPrismaClient, type ExtendedPrismaClient } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_SERVICE,
      useFactory: async (): Promise<ExtendedPrismaClient> => {
        const client = createPrismaClient();
        // Connects the primary and every configured replica.
        await client.$connect();
        return client;
      },
    },
  ],
  exports: [PRISMA_SERVICE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
