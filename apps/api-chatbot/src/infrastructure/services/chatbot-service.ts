import { Injectable } from '@nestjs/common';
import { ChatBotServicePort } from '../../domain/ports/chatbot-service.port';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatBotService extends ChatBotServicePort {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  apiGenerateSSe(prompt: string): Observable<{ data: string }> {
    return new Observable((observer) => {
      const controller = new AbortController();
      const decoder = new TextDecoder();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let isClosed = false;
      let buffer = '';

      const run = async () => {
        try {
          const response = await fetch(`${this.configService.get('OLLAMA_API_URL')}/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'qwen3:4b',
              prompt,
              stream: true,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Ollama request failed with status ${response.status}`);
          }

          reader = response.body?.getReader();

          if (!reader) {
            throw new Error('No stream');
          }

          while (!isClosed) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) {
                continue;
              }

              const json = JSON.parse(line);

              if (json.done) {
                continue;
              }

              observer.next({
                data: json.response ?? '',
              });
            }
          }

          if (buffer.trim()) {
            const json = JSON.parse(buffer);

            if (!json.done) {
              observer.next({
                data: json.response ?? '',
              });
            }
          }

          if (!isClosed) {
            observer.complete();
          }
        } catch (error: any) {
          if (!isClosed && error?.name !== 'AbortError') {
            observer.error(error);
          }
        }
      };

      run();

      return () => {
        isClosed = true;
        controller.abort();
        void reader?.cancel();
      };
    });
  }
}
