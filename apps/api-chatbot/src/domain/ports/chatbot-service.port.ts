import { Observable } from 'rxjs';

export interface UpsertDocumentInput {
  fileName: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface UpdateDocumentInput {
  id: string;
  fileName?: string;
  content?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface DocumentMutationResult {
  documentId: string;
  fileName: string;
  chunkCount: number;
}

export abstract class ChatBotServicePort {
  abstract apiGenerateSSe(prompt: string): Observable<{ data: string }>;
  abstract apiStrictlyGenerateSSe(prompt: string): Observable<{ data: string }>;
  abstract upsertDocument(input: UpsertDocumentInput): Promise<DocumentMutationResult>;
  abstract updateDocument(input: UpdateDocumentInput): Promise<DocumentMutationResult>;
  abstract deleteDocument(id: string): Promise<{ documentId: string; deleted: true }>;
}
