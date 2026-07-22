import { Observable } from 'rxjs';

export abstract class ChatBotServicePort {
  abstract apiGenerateSSe(prompt: string): Observable<{ data: string }>;
}
