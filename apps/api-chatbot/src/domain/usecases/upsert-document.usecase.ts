import { DocumentMutationResult, UpsertDocumentInput } from '../ports/chatbot-service.port';

export interface UpsertDocumentUseCase {
  execute(input: UpsertDocumentInput): Promise<DocumentMutationResult>;
}
