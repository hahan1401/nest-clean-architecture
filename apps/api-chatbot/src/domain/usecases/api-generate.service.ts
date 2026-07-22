import { Injectable } from "@nestjs/common";
import { ChatBotServicePort } from "../ports/chatbot-service.port";
import { Observable } from 'rxjs';

@Injectable()
export class ApiGenerateService {
  constructor(private readonly chatBotService: ChatBotServicePort) {}

  executeSse(prompt: string): Observable<{ data: string }> {
    return this.chatBotService.apiGenerateSSe(prompt);
  }
}