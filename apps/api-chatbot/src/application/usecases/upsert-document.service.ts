import { Injectable } from '@nestjs/common';
import {
  ChatBotServicePort,
  DocumentMutationResult,
  UpsertDocumentInput,
} from '../../domain/ports/chatbot-service.port';
import { GeminiAIService } from '../../infrastructure/services/gemini-ai.service';

@Injectable()
export class UpsertDocumentService {
  constructor(
    private readonly chatBotService: ChatBotServicePort,
    private readonly geminiAIService: GeminiAIService,
  ) {}

  execute(input: UpsertDocumentInput): Promise<DocumentMutationResult> {
    return this.geminiAIService.upsertDocument(input);
  }
}
