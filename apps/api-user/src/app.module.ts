import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './presentation/modules/user.module';
import { join } from 'path';
import { LoggerMiddleware } from 'libs/middlewares/logger.middleware';

const path1 = join(process.cwd(), '.env.local')
const path2 = join(process.cwd(), 'apps/api-user/.env.local')
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), 'apps/api-user/.env.local'),
      ],
    }),
    UserModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
