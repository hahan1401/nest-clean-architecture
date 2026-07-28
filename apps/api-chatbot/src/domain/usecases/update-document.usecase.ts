import { DocumentMutationResult, UpdateDocumentInput } from "../ports/chatbot-service.port";

export interface UpdateDocumentUseCase {
  execute(input: UpdateDocumentInput): Promise<DocumentMutationResult>;
}
