import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { ApiGenerateService } from '../../application/usecases/api-generate.service';
import { ChatBotService } from '../../infrastructure/services/chatbot-service';
import { ConfigModule } from '@nestjs/config';
import { ChatbotController } from '../controllers/chatbot.controller';
import { DatabaseModule } from '@app/database';
import { UpsertDocumentService } from '../../application/usecases/upsert-document.service';
import { UpdateDocumentService } from '../../application/usecases/update-document.service';
import { DeleteDocumentService } from '../../application/usecases/delete-document.service';
import { GeminiAIService } from '../../infrastructure/services/gemini-ai.service';

@Module({
  imports: [HttpModule, ConfigModule, DatabaseModule],
  controllers: [ChatbotController],
  providers: [
    { provide: ChatBotServicePort, useClass: ChatBotService },
    { provide: GeminiAIService, useClass: GeminiAIService },
    ApiGenerateService,
    UpsertDocumentService,
    UpdateDocumentService,
    DeleteDocumentService,
  ],
})
export class ChatbotModule {}
