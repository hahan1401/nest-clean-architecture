import { Injectable } from '@nestjs/common';
import { ChatBotServicePort } from '../ports/chatbot-service.port';

@Injectable()
export class DeleteDocumentService {
  constructor(private readonly chatBotService: ChatBotServicePort) {}

  execute(id: string): Promise<{ documentId: string; deleted: true }> {
    return this.chatBotService.deleteDocument(id);
  }
}
