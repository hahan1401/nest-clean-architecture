import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';

/**
 * Logs the start, outcome and duration of every handler for both HTTP and RPC
 * contexts. This is what gives TCP microservices request logging, since
 * pino-http `autoLogging` is disabled and message patterns are not HTTP.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const type = context.getType();

    if (type === 'rpc') {
      const data = context.switchToRpc().getData() as { requestId?: string } | undefined;
      const requestId = data?.requestId;
      const pattern = context.getHandler().name;
      this.logger.info({ requestId, pattern }, `RPC ${pattern} received`);
      return next.handle().pipe(
        tap({
          next: () =>
            this.logger.info(
              { requestId, pattern, ms: Date.now() - start },
              `RPC ${pattern} completed`,
            ),
          error: (err: unknown) =>
            this.logger.warn(
              { requestId, pattern, ms: Date.now() - start, err: (err as Error)?.message },
              `RPC ${pattern} failed`,
            ),
        }),
      );
    }

    if (type === 'http') {
      const req = context.switchToHttp().getRequest<{
        requestId?: string;
        method?: string;
        url?: string;
      }>();
      const requestId = req?.requestId;
      const route = `${req?.method ?? ''} ${req?.url?.split('?')[0] ?? ''}`.trim();
      return next.handle().pipe(
        tap({
          next: () =>
            this.logger.info({ requestId, ms: Date.now() - start }, `${route} completed`),
          error: (err: unknown) =>
            this.logger.warn(
              { requestId, ms: Date.now() - start, err: (err as Error)?.message },
              `${route} failed`,
            ),
        }),
      );
    }

    return next.handle();
  }
}
