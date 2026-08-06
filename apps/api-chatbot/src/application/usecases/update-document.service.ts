import { Injectable } from '@nestjs/common';
import {
  ChatBotServicePort,
  DocumentMutationResult,
  UpdateDocumentInput,
} from '../../domain/ports/chatbot-service.port';
import { UpdateDocumentUseCase } from '../../domain/usecases/update-document.usecase';

@Injectable()
export class UpdateDocumentService implements UpdateDocumentUseCase {
  constructor(private readonly chatBotService: ChatBotServicePort) {}

  execute(input: UpdateDocumentInput): Promise<DocumentMutationResult> {
    return this.chatBotService.updateDocument(input);
  }
}
