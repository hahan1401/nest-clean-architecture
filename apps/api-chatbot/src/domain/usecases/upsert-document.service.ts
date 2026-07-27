import { Injectable } from '@nestjs/common';
import {
  ChatBotServicePort,
  DocumentMutationResult,
  UpsertDocumentInput,
} from '../ports/chatbot-service.port';

@Injectable()
export class UpsertDocumentService {
  constructor(private readonly chatBotService: ChatBotServicePort) {}

  execute(input: UpsertDocumentInput): Promise<DocumentMutationResult> {
    return this.chatBotService.upsertDocument(input);
  }
}
