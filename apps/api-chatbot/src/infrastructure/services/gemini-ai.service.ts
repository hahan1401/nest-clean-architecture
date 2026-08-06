import { GoogleGenAI } from '@google/genai';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import {
  ChatBotServicePort,
  DocumentMutationResult,
  UpdateDocumentInput,
  UpsertDocumentInput,
} from '../../domain/ports/chatbot-service.port';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { DependencyError, NotFoundError, ValidationError } from '@app/common';

type DocumentRow = {
  id: string;
  file_name: string;
};

type RetrievedChunkRow = {
  chunk_content: string;
  file_name: string;
  similarity: number;
  chunk_id?: string;
  chunk_index?: number;
};

@Injectable()
export class GeminiAIService extends ChatBotServicePort implements OnModuleInit {
  private readonly DEFAULT_CHUNK_SIZE = 1000;
  private readonly DEFAULT_CHUNK_OVERLAP = 100;
  private readonly DEFAULT_MATCH_COUNT = 5;
  private readonly DEFAULT_MAX_DISTANCE = 0.5;
  private readonly FALLBACK_MESSAGE = 'I cannot find this information in internal documents.';

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {
    super();
    logger.setContext(GeminiAIService.name);
  }

  /**
   * The `documents` / `document_chunks` tables use the pgvector `vector` type,
   * which TypeORM cannot model, so they are created idempotently here instead of
   * via entity synchronization. Mirrors the former Prisma migrations.
   */
  async onModuleInit(): Promise<void> {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "file_name" text NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "document_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
        "chunk_index" integer NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1536),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(
      'CREATE INDEX IF NOT EXISTS "document_chunks_document_id_idx" ON "document_chunks" ("document_id")',
    );
  }

  private get ai() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new DependencyError('GEMINI_API_KEY is not set in the environment variables.');
    }
    return new GoogleGenAI({ apiKey });
  }

  private getMaxDistance(): number {
    const configured = this.configService.get<string>('CHATBOT_MAX_VECTOR_DISTANCE');

    if (!configured) {
      return this.DEFAULT_MAX_DISTANCE;
    }

    const parsed = Number(configured);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : this.DEFAULT_MAX_DISTANCE;
  }

  private getMatchCount(): number {
    const configured = this.configService.get<string>('CHATBOT_MATCH_COUNT');

    if (!configured) {
      return this.DEFAULT_MATCH_COUNT;
    }

    const parsed = Number(configured);

    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : this.DEFAULT_MATCH_COUNT;
  }

  private validateContentInput(fileName: string, content: string) {
    if (!fileName?.trim()) {
      throw new ValidationError('fileName is required');
    }

    if (!content?.trim()) {
      throw new ValidationError('content is required');
    }
  }

  private splitIntoChunks(
    text: string,
    size = this.DEFAULT_CHUNK_SIZE,
    overlap = this.DEFAULT_CHUNK_OVERLAP,
  ): string[] {
    if (size <= 0) {
      throw new ValidationError('chunkSize must be greater than 0');
    }

    if (overlap < 0 || overlap >= size) {
      throw new ValidationError('chunkOverlap must be between 0 and chunkSize - 1');
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
    const embeddingModel = 'gemini-embedding-2';

    try {
      const response = await this.ai.models.embedContent({
        model: embeddingModel,
        contents: { text: chunk },
        config: {
          outputDimensionality: 1536,
        },
      });

      const embedding = response?.embeddings?.[0]?.values ?? [];

      if (!embedding || !Array.isArray(embedding) || !embedding.length) {
        throw new DependencyError('Invalid embedding response from Gemini AI');
      }

      return embedding;
    } catch (error: unknown) {
      this.logger.error({ err: error }, 'Error generating embedding');
      throw new DependencyError('Failed to generate embedding for the chunk', error);
    }
  }

  private async insertChunks(
    manager: EntityManager,
    documentId: string,
    chunks: string[],
    embeddings: number[][],
  ) {
    for (let index = 0; index < chunks.length; index += 1) {
      const vectorLiteral = this.toVectorLiteral(embeddings[index]);

      await manager.query(
        `INSERT INTO
            "document_chunks" ("document_id", "chunk_index", "content", "embedding", "created_at")
            VALUES ($1, $2, $3, $4::vector, NOW())`,
        [documentId, index, chunks[index], vectorLiteral],
      );
    }
  }

  private toVectorLiteral(values: number[]): string {
    if (!values.length || values.some((value) => !Number.isFinite(value))) {
      throw new DependencyError('Embedding vector contains invalid values');
    }

    return `[${values.join(',')}]`;
  }

  private async searchRelevantChunks(questionEmbedding: number[]): Promise<RetrievedChunkRow[]> {
    const matchCount = this.getMatchCount();
    const maxDistance = this.getMaxDistance();

    const vectorLiteral = this.toVectorLiteral(questionEmbedding);

    try {
      const result = await this.dataSource.query<RetrievedChunkRow[]>(
        `
        SELECT
          dc."id" AS "chunk_id",
          dc."content" AS "chunk_content",
          dc."chunk_index" AS "chunk_index",
          (dc."embedding" <=> $1::vector) AS "similarity"
        FROM "document_chunks" dc
        WHERE (dc."embedding" <=> $1::vector) <= $2
        ORDER BY dc."embedding" <=> $1::vector ASC
        LIMIT $3
        `,
        [vectorLiteral, maxDistance, matchCount],
      );

      return result;
    } catch (e: unknown) {
      this.logger.error({ err: e }, 'Chunk match query failed');
      throw e;
    }
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
      .map((match, index) => {
        return `[Chunk ${index + 1}] Source: ${match.chunk_content}`;
      })
      .join('\n\n');

    return `
      You are an internal document assistant.

      VERY IMPORTANT RULES:

      1. Answer ONLY from the CONTEXT.
      2. Never use external knowledge.
      3. Never guess.
      4. Never assume.
      5. If the answer is not explicitly found in the CONTEXT, reply exactly:

      ${this.FALLBACK_MESSAGE}

      CONTEXT:

      ${context}

      QUESTION:

      ${question}

      ANSWER:
    `.trim();
  }

  apiGenerateSSe(prompt: string): Observable<{ data: string }> {
    return new Observable((observer) => {
      let isCancelled = false;

      void (async () => {
        try {
          const stream = await this.ai.interactions.create({
            model: 'gemini-3.6-flash',
            input: prompt,
            stream: true,
          });

          for await (const event of stream) {
            if (isCancelled) {
              break;
            }

            if (event.event_type === 'step.delta' && event.delta.type === 'text') {
              observer.next({ data: event.delta.text });
            }
          }

          if (!isCancelled) {
            observer.complete();
          }
        } catch (error: unknown) {
          if (!isCancelled) {
            observer.error(error);
          }
        }
      })();

      return () => {
        isCancelled = true;
        this.logger.debug('Observable unsubscribed');
      };
    });
  }
  apiStrictlyGenerateSSe(prompt: string): Observable<{ data: string }> {
    return new Observable((observer) => {
      void (async () => {
        try {
          let groundedPrompt: string | null;

          try {
            groundedPrompt = await this.buildGroundedPrompt(prompt);
          } catch (error: unknown) {
            this.logger.error({ err: error }, 'Failed to build grounded prompt');
            throw error;
          }

          if (!groundedPrompt) {
            observer.next({
              data: this.FALLBACK_MESSAGE,
            });

            observer.complete();
            return;
          }

          try {
            const stream = await this.ai.models.generateContentStream({
              model: 'gemini-3.6-flash',
              contents: groundedPrompt,
            });

            for await (const chunk of stream) {
              const text = chunk.text;

              if (text) {
                observer.next({
                  data: text,
                });
              }
            }

            observer.complete();
          } catch (error: unknown) {
            this.logger.error({ err: error }, 'Failed while streaming AI response');
            throw error;
          }
        } catch (error: unknown) {
          this.logger.error({ err: error }, 'apiStrictlyGenerateSSe failed');

          observer.next({
            data: this.FALLBACK_MESSAGE,
          });

          observer.complete();

          // Alternative:
          // observer.error(error);
        }
      })();

      return () => {
        this.logger.debug('Observable unsubscribed');
      };
    });
  }
  async deleteDocument(id: string): Promise<{ documentId: string; deleted: true }> {
    if (!id?.trim()) {
      throw new ValidationError('Document id is required');
    }

    const deleted = await this.dataSource.query<Array<{ id: string }>>(
      'DELETE FROM "documents" WHERE "id" = $1 RETURNING "id"',
      [id],
    );

    if (!deleted[0]?.id) {
      throw new NotFoundError('Document not found');
    }

    return {
      documentId: deleted[0].id,
      deleted: true,
    };
  }

  async updateDocument(input: UpdateDocumentInput): Promise<DocumentMutationResult> {
    if (!input.id?.trim()) {
      throw new ValidationError('Document id is required');
    }

    if (!input.fileName && input.content === undefined) {
      throw new ValidationError('Nothing to update. Provide fileName or content');
    }

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<DocumentRow[]>(
        'SELECT "id", "file_name" FROM "documents" WHERE "id" = $1 LIMIT 1',
        [input.id],
      );

      const existing = rows[0];

      if (!existing) {
        throw new NotFoundError('Document not found');
      }

      const nextFileName = input.fileName?.trim() || existing.file_name;

      if (input.content === undefined) {
        await manager.query(
          'UPDATE "documents" SET "file_name" = $1, "updated_at" = NOW() WHERE "id" = $2',
          [nextFileName, input.id],
        );

        const chunkCountRows = await manager.query<Array<{ count: bigint | number }>>(
          'SELECT COUNT(*)::bigint AS "count" FROM "document_chunks" WHERE "document_id" = $1',
          [input.id],
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
        throw new ValidationError('Document content is empty after chunking');
      }

      const embeddings = await this.createEmbeddings(chunks);

      await manager.query(
        'UPDATE "documents" SET "file_name" = $1, "updated_at" = NOW() WHERE "id" = $2',
        [nextFileName, input.id],
      );
      await manager.query('DELETE FROM "document_chunks" WHERE "document_id" = $1', [input.id]);
      await this.insertChunks(manager, input.id, chunks, embeddings);

      return {
        documentId: input.id,
        fileName: nextFileName,
        chunkCount: chunks.length,
      };
    });
  }

  async upsertDocument(input: UpsertDocumentInput): Promise<DocumentMutationResult> {
    this.validateContentInput(input.fileName, input.content);

    const chunks = this.splitIntoChunks(input.content, input.chunkSize, input.chunkOverlap);

    if (!chunks.length) {
      throw new ValidationError('Document content is empty after chunking');
    }

    const embeddings = await this.createEmbeddings(chunks);

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.query<DocumentRow[]>(
        'SELECT "id", "file_name" FROM "documents" WHERE "file_name" = $1 LIMIT 1',
        [input.fileName],
      );
      let documentId = existing[0]?.id;

      if (!documentId) {
        try {
          const inserted = await manager.query<DocumentRow[]>(
            `INSERT INTO
                "documents" ("file_name", "created_at", "updated_at")
                VALUES ($1, NOW(), NOW())
                RETURNING "id", "file_name"`,
            [input.fileName],
          );
          documentId = inserted[0]?.id;
        } catch (error: unknown) {
          this.logger.error({ err: error, fileName: input.fileName }, 'Error inserting document');
          throw new DependencyError(`Failed to insert document`, error);
        }
      } else {
        await manager.query('UPDATE "documents" SET "updated_at" = NOW() WHERE "id" = $1', [
          documentId,
        ]);
      }

      if (!documentId) {
        throw new DependencyError('Failed to create or locate document');
      }

      await manager.query('DELETE FROM "document_chunks" WHERE "document_id" = $1', [documentId]);
      await this.insertChunks(manager, documentId, chunks, embeddings);
      return {
        documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
      };
    });
  }
}
