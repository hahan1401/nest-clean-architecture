import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { ApiGenerateUseCase } from '../../domain/usecases/api-generate.usecase';
import { GeminiAIService } from '../../infrastructure/services/gemini-ai.service';

@Injectable()
export class ApiGenerateService implements ApiGenerateUseCase {
  constructor(
    private readonly chatBotService: ChatBotServicePort,
    private readonly geminiAIService: GeminiAIService,
  ) {}

  executeSse(prompt: string): Observable<{ data: string }> {
    return this.geminiAIService.apiGenerateSSe(prompt);
  }

  executeStrictSse(prompt: string): Observable<{ data: string }> {
    return this.geminiAIService.apiStrictlyGenerateSSe(prompt);
  }
}
