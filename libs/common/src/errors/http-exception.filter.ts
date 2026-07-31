import { ArgumentsHost, Catch, ExceptionFilter, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { normalizeError } from './normalize';

/**
 * Global filter for the HTTP gateway: maps any thrown value (including error
 * envelopes forwarded from TCP microservices) into a consistent JSON body.
 */
@Injectable()
@Catch()
export class AllExceptionsHttpFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    logger.setContext('HttpExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const { code, status, message } = normalizeError(exception);
    const requestId = request.requestId;

    this.logger.error(
      { code, status, requestId, path: request.url, method: request.method },
      message,
    );

    response.status(status).json({
      statusCode: status,
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
