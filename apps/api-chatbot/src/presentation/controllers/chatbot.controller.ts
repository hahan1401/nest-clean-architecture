import { CHATBOT_PATTERNS } from '@app/common';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { ApiGenerateService } from '../../application/usecases/api-generate.service';
import { UpsertDocumentService } from '../../application/usecases/upsert-document.service';
import { UpdateDocumentService } from '../../application/usecases/update-document.service';
import { DeleteDocumentService } from '../../application/usecases/delete-document.service';
import type {
  UpdateDocumentInput,
  UpsertDocumentInput,
} from '../../domain/ports/chatbot-service.port';

@Controller()
export class ChatbotController {
  constructor(
    private readonly apiGenerateService: ApiGenerateService,
    private readonly upsertDocumentService: UpsertDocumentService,
    private readonly updateDocumentService: UpdateDocumentService,
    private readonly deleteDocumentService: DeleteDocumentService,
  ) {}

  @MessagePattern(CHATBOT_PATTERNS.ASK_SSE)
  askSse(@Payload() data: { prompt: string }): Observable<{ data: string }> {
    return this.apiGenerateService.executeSse(data.prompt);
  }

  @MessagePattern(CHATBOT_PATTERNS.ASK_STRICT_SSE)
  askStrictSse(@Payload() data: { prompt: string }): Observable<{ data: string }> {
    return this.apiGenerateService.executeStrictSse(data.prompt);
  }

  @MessagePattern(CHATBOT_PATTERNS.UPSERT_DOCUMENT)
  async upsertDocument(@Payload() data: UpsertDocumentInput) {
    return this.upsertDocumentService.execute(data);
  }

  @MessagePattern(CHATBOT_PATTERNS.UPDATE_DOCUMENT)
  async updateDocument(@Payload() data: UpdateDocumentInput) {
    return this.updateDocumentService.execute(data);
  }

  @MessagePattern(CHATBOT_PATTERNS.DELETE_DOCUMENT)
  async deleteDocument(@Payload() data: { id: number }) {
    return this.deleteDocumentService.execute(data.id);
  }
}
