import { ArgumentsHost, Catch, Logger, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { normalizeError } from './normalize';

/**
 * Global filter for microservices: translates every thrown value into a stable
 * `{ code, status, message, requestId }` envelope carried by RpcException.
 */
@Catch()
export class AllExceptionsRpcFilter implements RpcExceptionFilter {
  private readonly logger = new Logger('RpcExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    const { code, status, message } = normalizeError(exception);
    const data = host.switchToRpc().getData() as { requestId?: string } | undefined;
    const requestId = data?.requestId;

    this.logger.error(
      { code, status, requestId, err: exception instanceof Error ? exception.stack : exception },
      message,
    );

    return throwError(() => new RpcException({ code, status, message, requestId }));
  }
}
