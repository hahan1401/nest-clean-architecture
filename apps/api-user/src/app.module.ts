import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { UserModule } from './presentation/modules/user.module';
import { LoggerModule } from 'nestjs-pino';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), 'apps/api-user/.env.local'),
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (req: any) => ({
          body: req.body,
        }),
        autoLogging: false,
        serializers: {
          req: (req) => {
            return {
              url: req.url.split('?')[0],
              method: req.method,
              requestId: req['requestId'],
              query: req.query,
              body: req.body,
            };
          },
          res: () => undefined,
        },
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            translateTime: 'yyyy-mm-dd"T"HH:MM:ss.l"Z"',
            ignore: 'pid,hostname',
            messageFormat: '[API-GATEWAY] {msg}',
          },
        },
      },
    }),

    UserModule,
  ],
})
export class AppModule {}
