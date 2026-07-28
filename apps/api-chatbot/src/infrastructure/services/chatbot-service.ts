import { Injectable } from '@nestjs/common';
import {
  ChatBotServicePort,
  DocumentMutationResult,
  UpdateDocumentInput,
  UpsertDocumentInput,
} from '../../domain/ports/chatbot-service.port';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/database';
import { Prisma } from '@prisma/client';

type DocumentRow = {
  id: string;
  file_name: string;
};

type RetrievedChunkRow = {
  chunk_content: string;
  file_name: string;
  similarity: number;
};

@Injectable()
export class ChatBotService extends ChatBotServicePort {
  private static readonly DEFAULT_CHUNK_SIZE = 1000;
  private static readonly DEFAULT_CHUNK_OVERLAP = 100;
  private static readonly DEFAULT_MATCH_COUNT = 5;
  private static readonly DEFAULT_MAX_DISTANCE = 0.35;
  private static readonly FALLBACK_MESSAGE =
    'I cannot find this information in internal documents.';

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super();
  }

  async upsertDocument(input: UpsertDocumentInput): Promise<DocumentMutationResult> {
    this.validateContentInput(input.fileName, input.content);

    const chunks = this.splitIntoChunks(input.content, input.chunkSize, input.chunkOverlap);

    if (!chunks.length) {
      throw new Error('Document content is empty after chunking');
    }

    const embeddings = await this.createEmbeddings(chunks);

    return this.prismaService.$transaction(async (tx) => {
      const existing = await tx.$queryRawUnsafe<DocumentRow[]>(
        'SELECT "id", "file_name" FROM "documents" WHERE "file_name" = $1 LIMIT 1',
        input.fileName,
      );

      let documentId = existing[0]?.id;

      if (!documentId) {
        const inserted = await tx.$queryRawUnsafe<DocumentRow[]>(
          'INSERT INTO "documents" ("file_name", "created_at", "updated_at") VALUES ($1, NOW(), NOW()) RETURNING "id", "file_name"',
          input.fileName,
        );
        documentId = inserted[0]?.id;
      } else {
        await tx.$executeRawUnsafe(
          'UPDATE "documents" SET "updated_at" = NOW() WHERE "id" = $1',
          documentId,
        );
      }

      if (!documentId) {
        throw new Error('Failed to create or locate document');
      }

      await tx.$executeRawUnsafe(
        'DELETE FROM "document_chunks" WHERE "document_id" = $1',
        documentId,
      );
      await this.insertChunks(tx, documentId, chunks, embeddings);

      return {
        documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
      };
    });
  }

  async updateDocument(input: UpdateDocumentInput): Promise<DocumentMutationResult> {
    if (!input.id?.trim()) {
      throw new Error('Document id is required');
    }

    if (!input.fileName && input.content === undefined) {
      throw new Error('Nothing to update. Provide fileName or content');
    }

    return this.prismaService.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<DocumentRow[]>(
        'SELECT "id", "file_name" FROM "documents" WHERE "id" = $1 LIMIT 1',
        input.id,
      );

      const existing = rows[0];

      if (!existing) {
        throw new Error('Document not found');
      }

      const nextFileName = input.fileName?.trim() || existing.file_name;

      if (input.content === undefined) {
        await tx.$executeRawUnsafe(
          'UPDATE "documents" SET "file_name" = $1, "updated_at" = NOW() WHERE "id" = $2',
          nextFileName,
          input.id,
        );

        const chunkCountRows = await tx.$queryRawUnsafe<Array<{ count: bigint | number }>>(
          'SELECT COUNT(*)::bigint AS "count" FROM "document_chunks" WHERE "document_id" = $1',
          input.id,
        );

        return {
          documentId: input.id,
          fileName: nextFileName,
          chunkCount: Number(chunkCountRows[0]?.count ?? 0),
        };
      }

      this.validateContentInput(nextFileName, input.content);

      const chunks = this.splitIntoChunks(input.content, input.chunkSize, input.chunkOverlap);

      if (!chunks.length) {
        throw new Error('Document content is empty after chunking');
      }

      const embeddings = await this.createEmbeddings(chunks);

      await tx.$executeRawUnsafe(
        'UPDATE "documents" SET "file_name" = $1, "updated_at" = NOW() WHERE "id" = $2',
        nextFileName,
        input.id,
      );
      await tx.$executeRawUnsafe(
        'DELETE FROM "document_chunks" WHERE "document_id" = $1',
        input.id,
      );
      await this.insertChunks(tx, input.id, chunks, embeddings);

      return {
        documentId: input.id,
        fileName: nextFileName,
        chunkCount: chunks.length,
      };
    });
  }

  async deleteDocument(id: string): Promise<{ documentId: string; deleted: true }> {
    if (!id?.trim()) {
      throw new Error('Document id is required');
    }

    const deleted = await this.prismaService.$queryRawUnsafe<Array<{ id: string }>>(
      'DELETE FROM "documents" WHERE "id" = $1 RETURNING "id"',
      id,
    );

    if (!deleted[0]?.id) {
      throw new Error('Document not found');
    }

    return {
      documentId: deleted[0].id,
      deleted: true,
    };
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
              model: 'qwen2.5:3b',
              prompt: prompt,
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

  apiStrictlyGenerateSSe(prompt: string): Observable<{ data: string }> {
    return new Observable((observer) => {
      const controller = new AbortController();
      const decoder = new TextDecoder();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let isClosed = false;
      let buffer = '';

      const run = async () => {
        try {
          const groundedPrompt = await this.buildGroundedPrompt(prompt);

          if (!groundedPrompt) {
            observer.next({ data: ChatBotService.FALLBACK_MESSAGE });
            observer.complete();
            return;
          }

          const response = await fetch(`${this.configService.get('OLLAMA_API_URL')}/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'qwen2.5:3b',
              prompt: groundedPrompt,
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

  private validateContentInput(fileName: string, content: string) {
    if (!fileName?.trim()) {
      throw new Error('fileName is required');
    }

    if (!content?.trim()) {
      throw new Error('content is required');
    }
  }

  private splitIntoChunks(
    text: string,
    size = ChatBotService.DEFAULT_CHUNK_SIZE,
    overlap = ChatBotService.DEFAULT_CHUNK_OVERLAP,
  ): string[] {
    if (size <= 0) {
      throw new Error('chunkSize must be greater than 0');
    }

    if (overlap < 0 || overlap >= size) {
      throw new Error('chunkOverlap must be between 0 and chunkSize - 1');
    }

    const normalized = text.trim();

    if (!normalized) {
      return [];
    }

    const chunks: string[] = [];
    let start = 0;
    const step = size - overlap;

    while (start < normalized.length) {
      const chunk = normalized.slice(start, start + size).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      start += step;
    }

    return chunks;
  }

  private async createEmbeddings(chunks: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const vector = await this.embedChunk(chunk);
      embeddings.push(vector);
    }

    return embeddings;
  }

  private async embedChunk(chunk: string): Promise<number[]> {
    const embeddingApiUrl = this.configService.get('OLLAMA_API_URL');
    const embeddingModel = this.configService.get('OLLAMA_EMBED_MODEL') || 'nomic-embed-text';

    if (!embeddingApiUrl) {
      throw new Error('OLLAMA_API_URL is not configured');
    }

    const response = await fetch(`${embeddingApiUrl}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: chunk,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { embeddings?: number[][] };
    const embedding = body?.embeddings?.[0];

    if (!embedding || !Array.isArray(embedding) || !embedding.length) {
      throw new Error('Invalid embedding response from Ollama');
    }

    return embedding;
  }

  private async insertChunks(
    tx: Prisma.TransactionClient,
    documentId: string,
    chunks: string[],
    embeddings: number[][],
  ) {
    for (let index = 0; index < chunks.length; index += 1) {
      const vectorLiteral = this.toVectorLiteral(embeddings[index]);

      await tx.$executeRawUnsafe(
        'INSERT INTO "document_chunks" ("document_id", "chunk_index", "content", "embedding", "created_at") VALUES ($1, $2, $3, $4::vector, NOW())',
        documentId,
        index,
        chunks[index],
        vectorLiteral,
      );
    }
  }

  private toVectorLiteral(values: number[]): string {
    if (!values.length || values.some((value) => !Number.isFinite(value))) {
      throw new Error('Embedding vector contains invalid values');
    }

    return `[${values.join(',')}]`;
  }

  private async buildGroundedPrompt(question: string): Promise<string | null> {
    if (!question?.trim()) {
      return null;
    }

    const questionEmbedding = await this.embedChunk(question.trim());
    const matches = await this.searchRelevantChunks(questionEmbedding);

    if (!matches.length) {
      return null;
    }

    const context = matches
      .map((match, index) => `[Doc ${index + 1}: ${match.file_name}]\n${match.chunk_content}`)
      .join('\n\n');

    return [
      'You are an internal document assistant.',
      'Answer strictly and only from the CONTEXT below.',
      'If the answer is not present in the CONTEXT, reply exactly: "I cannot find this information in internal documents."',
      'Do not use external knowledge. Do not guess.',
      '',
      'CONTEXT:',
      context,
      '',
      'QUESTION:',
      question.trim(),
      '',
      'ANSWER:',
    ].join('\n');
  }

  private async searchRelevantChunks(questionEmbedding: number[]): Promise<RetrievedChunkRow[]> {
    const maxDistance = this.getMaxDistance();
    const matchCount = this.getMatchCount();
    const vectorLiteral = this.toVectorLiteral(questionEmbedding);

    return this.prismaService.$queryRawUnsafe<RetrievedChunkRow[]>(
      `
      SELECT
        dc."content" AS "chunk_content",
        d."file_name" AS "file_name",
        (dc."embedding" <=> $1::vector) AS "similarity"
      FROM "document_chunks" dc
      INNER JOIN "documents" d ON d."id" = dc."document_id"
      WHERE (dc."embedding" <=> $1::vector) <= $2
      ORDER BY dc."embedding" <=> $1::vector ASC
      LIMIT $3
      `,
      vectorLiteral,
      maxDistance,
      matchCount,
    );
  }

  private getMaxDistance(): number {
    const configured = this.configService.get<string>('CHATBOT_MAX_VECTOR_DISTANCE');

    if (!configured) {
      return ChatBotService.DEFAULT_MAX_DISTANCE;
    }

    const parsed = Number(configured);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return ChatBotService.DEFAULT_MAX_DISTANCE;
    }

    return parsed;
  }

  private getMatchCount(): number {
    const configured = this.configService.get<string>('CHATBOT_MATCH_COUNT');

    if (!configured) {
      return ChatBotService.DEFAULT_MATCH_COUNT;
    }

    const parsed = Number(configured);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return ChatBotService.DEFAULT_MATCH_COUNT;
    }

    return Math.min(Math.floor(parsed), 20);
  }
}
