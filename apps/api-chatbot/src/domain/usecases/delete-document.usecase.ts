export interface DeleteDocumentUseCase {
  execute(id: string): Promise<{ documentId: string; deleted: true }>;
}