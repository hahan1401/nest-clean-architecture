export interface DeleteDocumentUseCase {
  execute(id: number): Promise<{ documentId: number; deleted: true }>;
}
