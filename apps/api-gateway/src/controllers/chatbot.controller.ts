import { CHATBOT_PATTERNS, CHATBOT_SERVICE } from '@app/common';
import { Controller, HttpException, Inject, MessageEvent, Query, Sse } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, catchError, map, throwError } from 'rxjs';

@Controller()
export class ChatbotController {
  @Inject(CHATBOT_SERVICE) private readonly chatbotService: ClientProxy;

  @Sse('chatbot/sse')
  handleRequest(@Query('prompt') prompt: string): Observable<MessageEvent> {
    return this.chatbotService.send(CHATBOT_PATTERNS.ASK_SSE, { prompt }).pipe(
      map((chunk: any) => ({ data: chunk?.data ?? '' }) as MessageEvent),
      catchError((err: any) => {
        return throwError(
          () => new HttpException(err?.message ?? 'Internal error', err?.status ?? 500),
        );
      }),
    );
  }
}
