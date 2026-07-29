import { createPinoHttpConfig } from '@app/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { LoggerModule } from 'nestjs-pino';
import { ChatbotModule } from './presentation/modules/chatbot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), 'apps/api-chatbot/.env.local'),
      ],
    }),
    // LoggerModule.forRoot({
    //   pinoHttp: createPinoHttpConfig('API-CHATBOT'),
    // }),
    ChatbotModule,
  ],
})
export class AppModule {}
