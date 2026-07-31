import { CHATBOT_PATTERNS, CHATBOT_SERVICE, normalizeError } from '@app/common';
import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Inject,
  MessageEvent,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, catchError, firstValueFrom, map, throwError } from 'rxjs';

type AnswerChunk = { data?: string };

type UploadDocumentBody = {
  fileName?: string;
  chunkSize?: number | string;
  chunkOverlap?: number | string;
};

type UploadedTextFile = {
  buffer: Buffer;
  originalname: string;
};

@Controller()
export class ChatbotController {
  @Inject(CHATBOT_SERVICE) private readonly chatbotService: ClientProxy;

  @Sse('chatbot/sse')
  handleRequest(@Query('prompt') prompt: string): Observable<MessageEvent> {
    return this.chatbotService.send<AnswerChunk>(CHATBOT_PATTERNS.ASK_SSE, { prompt }).pipe(
      map((chunk): MessageEvent => ({ data: chunk?.data ?? '' })),
      catchError((err: unknown) => {
        const { status, message } = normalizeError(err);
        return throwError(() => new HttpException(message, status));
      }),
    );
  }

  @Sse('chatbot/strict-sse')
  handleStrictRequest(@Query('prompt') prompt: string): Observable<MessageEvent> {
    return this.chatbotService.send<AnswerChunk>(CHATBOT_PATTERNS.ASK_STRICT_SSE, { prompt }).pipe(
      map((chunk): MessageEvent => ({ data: chunk?.data ?? '' })),
      catchError((err: unknown) => {
        const { status, message } = normalizeError(err);
        return throwError(() => new HttpException(message, status));
      }),
    );
  }

  @Post('chatbot/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: UploadedTextFile,
    @Body() body: UploadDocumentBody,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }

    const content = file.buffer.toString('utf-8').trim();

    if (!content) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const fileName = (body.fileName || file.originalname || '').trim();

    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const chunkSize = this.parseOptionalNumber(body.chunkSize, 'chunkSize');
    const chunkOverlap = this.parseOptionalNumber(body.chunkOverlap, 'chunkOverlap');

    const payload = {
      fileName,
      content,
      ...(chunkSize ? { chunkSize } : {}),
      ...(chunkOverlap !== undefined ? { chunkOverlap } : {}),
    };
    return firstValueFrom(this.chatbotService.send(CHATBOT_PATTERNS.UPSERT_DOCUMENT, payload));
  }

  private parseOptionalNumber(value: number | string | undefined, fieldName: string): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }

    return parsed;
  }
}
