import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ChatBotServicePort,
  DocumentMutationResult,
  UpdateDocumentInput,
  UpsertDocumentInput,
} from '../../domain/ports/chatbot-service.port';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiAIService extends ChatBotServicePort {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  private get ai() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in the environment variables.');
    }
    return new GoogleGenAI({ apiKey });
  }

  apiGenerateSSe(prompt: string): Observable<{ data: string }> {
    return new Observable((observer) => {
      (async () => {
        const stream = await this.ai.interactions.create({
          model: 'gemini-3.6-flash',
          input: prompt,
          stream: true,
        });
        let n = 0;
        for await (const event of stream) {
          console.log('Event:', event);
          if (event.event_type === 'step.delta' && event.delta.type === 'text') {
            observer.next({ data: event.delta.text });
          }
          continue;
        }
        observer.complete();
      })();
      return () => {
        console.log('Observable unsubscribed');
      };
    });
  }
  apiStrictlyGenerateSSe(prompt: string): Observable<{ data: string }> {
    return new Observable((observer) => {
      // Simulate an asynchronous operation (e.g., API call)
      setTimeout(() => {
        // Simulated response data
        const responseData = { data: `Strictly generated response for prompt: ${prompt}` };
        observer.next(responseData);
        observer.complete();
      }, 1000); // Simulate a 1-second delay
    });
  }
  deleteDocument(id: string): Promise<{ documentId: string; deleted: true }> {
    return new Promise((resolve) => {
      // Simulate an asynchronous operation (e.g., database deletion)
      setTimeout(() => {
        resolve({ documentId: id, deleted: true });
      }, 1000); // Simulate a 1-second delay
    });
  }
  updateDocument(input: UpdateDocumentInput): Promise<DocumentMutationResult> {
    return new Promise((resolve) => {
      // Simulate an asynchronous operation (e.g., database update)
      setTimeout(() => {
        const result: DocumentMutationResult = {
          documentId: input.id,
          chunkCount: 1, // Simulated chunk count
          fileName: input.fileName || 'updated-file-name', // Simulated file name
        };
        resolve(result);
      }, 1000); // Simulate a 1-second delay
    });
  }
  upsertDocument(input: UpsertDocumentInput): Promise<DocumentMutationResult> {
    return new Promise((resolve) => {
      // Simulate an asynchronous operation (e.g., database upsert)
      setTimeout(() => {
        const result: DocumentMutationResult = {
          documentId: 'generated-document-id',
          fileName: input.fileName,
          chunkCount: 1, // Simulated chunk count
        };
        resolve(result);
      }, 1000); // Simulate a 1-second delay
    });
  }
}
