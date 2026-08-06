import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { ApiGenerateUseCase } from '../../domain/usecases/api-generate.usecase';

@Injectable()
export class ApiGenerateService implements ApiGenerateUseCase {
  constructor(private readonly chatBotService: ChatBotServicePort) {}

  executeSse(prompt: string): Observable<{ data: string }> {
    return this.chatBotService.apiGenerateSSe(prompt);
  }

  executeStrictSse(prompt: string): Observable<{ data: string }> {
    return this.chatBotService.apiStrictlyGenerateSSe(prompt);
  }
}
