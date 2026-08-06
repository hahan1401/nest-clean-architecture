import { Injectable } from '@nestjs/common';
import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { DeleteDocumentUseCase } from '../../domain/usecases/delete-document.usecase';

@Injectable()
export class DeleteDocumentService implements DeleteDocumentUseCase {
  constructor(private readonly chatBotService: ChatBotServicePort) {}

  execute(id: string): Promise<{ documentId: string; deleted: true }> {
    return this.chatBotService.deleteDocument(id);
  }
}
