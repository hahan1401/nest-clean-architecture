import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { DeleteDocumentService } from './delete-document.service';

describe('DeleteDocumentService', () => {
  let service: DeleteDocumentService;
  let chatBotService: jest.Mocked<ChatBotServicePort>;

  beforeEach(() => {
    chatBotService = {
      deleteDocument: jest.fn(),
    } as unknown as jest.Mocked<ChatBotServicePort>;
    service = new DeleteDocumentService(chatBotService);
  });

  it('delegates deletion to the port', async () => {
    chatBotService.deleteDocument.mockResolvedValue({ documentId: 'd1', deleted: true });

    await expect(service.execute('d1')).resolves.toEqual({
      documentId: 'd1',
      deleted: true,
    });
    expect(chatBotService.deleteDocument).toHaveBeenCalledWith('d1');
  });
});
