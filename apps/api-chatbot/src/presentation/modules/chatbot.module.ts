import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { ApiGenerateService } from '../../domain/usecases/api-generate.service';
import { ChatBotService } from '../../infrastructure/services/chatbot-service';
import { ConfigModule } from '@nestjs/config';
import { ChatbotController } from '../controllers/chatbot.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [ChatbotController],
  providers: [{ provide: ChatBotServicePort, useClass: ChatBotService }, ApiGenerateService],
})
export class ChatbotModule {}
