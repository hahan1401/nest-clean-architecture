import { CHATBOT_PATTERNS } from '@app/common';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { ApiGenerateService } from '../../domain/usecases/api-generate.service';

@Controller()
export class ChatbotController {
  constructor(private readonly apiGenerateService: ApiGenerateService) {}

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
}
