import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { ApiGenerateService } from '../../domain/usecases/api-generate.service';
import { ChatBotService } from '../../infrastructure/services/chatbot-service';
import { ConfigModule } from '@nestjs/config';
import { ChatbotController } from '../controllers/chatbot.controller';
import { DatabaseModule } from '@app/database';
import { UpsertDocumentService } from '../../domain/usecases/upsert-document.service';
import { UpdateDocumentService } from '../../domain/usecases/update-document.service';
import { DeleteDocumentService } from '../../domain/usecases/delete-document.service';

@Module({
  imports: [HttpModule, ConfigModule, DatabaseModule],
  controllers: [ChatbotController],
  providers: [
    { provide: ChatBotServicePort, useClass: ChatBotService },
    ApiGenerateService,
    UpsertDocumentService,
    UpdateDocumentService,
    DeleteDocumentService,
  ],
})
export class ChatbotModule {}
