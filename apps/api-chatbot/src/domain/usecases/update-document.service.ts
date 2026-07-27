import { Injectable } from '@nestjs/common';
import {
  ChatBotServicePort,
  DocumentMutationResult,
  UpdateDocumentInput,
} from '../ports/chatbot-service.port';

@Injectable()
export class UpdateDocumentService {
  constructor(private readonly chatBotService: ChatBotServicePort) {}

  execute(input: UpdateDocumentInput): Promise<DocumentMutationResult> {
    return this.chatBotService.updateDocument(input);
  }
}
