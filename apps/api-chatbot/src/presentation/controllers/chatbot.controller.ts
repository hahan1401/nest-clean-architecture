import { CHATBOT_PATTERNS } from '@app/common';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
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
    try {
      return this.apiGenerateService.executeSse(data.prompt);
    } catch (err: any) {
      throw new RpcException({
        status: err?.status ?? 500,
        message: err?.message ?? 'Failed to process chatbot request',
      });
    }
  }

  @MessagePattern(CHATBOT_PATTERNS.ASK_STRICT_SSE)
  askStrictSse(@Payload() data: { prompt: string }): Observable<{ data: string }> {
    try {
      return this.apiGenerateService.executeStrictSse(data.prompt);
    } catch (err: any) {
      throw new RpcException({
        status: err?.status ?? 500,
        message: err?.message ?? 'Failed to process chatbot request',
      });
    }
  }

  @MessagePattern(CHATBOT_PATTERNS.UPSERT_DOCUMENT)
  async upsertDocument(@Payload() data: UpsertDocumentInput) {
    try {
      return await this.upsertDocumentService.execute(data);
    } catch (err: any) {
      throw new RpcException({
        status: err?.status ?? 400,
        message: err?.message ?? 'Failed to upsert document',
      });
    }
  }

  @MessagePattern(CHATBOT_PATTERNS.UPDATE_DOCUMENT)
  async updateDocument(@Payload() data: UpdateDocumentInput) {
    try {
      return await this.updateDocumentService.execute(data);
    } catch (err: any) {
      throw new RpcException({
        status: err?.status ?? 400,
        message: err?.message ?? 'Failed to update document',
      });
    }
  }

  @MessagePattern(CHATBOT_PATTERNS.DELETE_DOCUMENT)
  async deleteDocument(@Payload() data: { id: string }) {
    try {
      return await this.deleteDocumentService.execute(data.id);
    } catch (err: any) {
      throw new RpcException({
        status: err?.status ?? 400,
        message: err?.message ?? 'Failed to delete document',
      });
    }
  }
}
