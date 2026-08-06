import { HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DomainError, ErrorCode, HTTP_STATUS_BY_CODE } from './domain-error';

export interface NormalizedError {
  code: ErrorCode;
  status: number;
  message: string;
}

function codeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 502:
      return ErrorCode.DEPENDENCY_FAILURE;
    default:
      return status >= 500 ? ErrorCode.INTERNAL : ErrorCode.VALIDATION;
  }
}

/**
 * Collapses any thrown value (domain error, Nest HttpException, RpcException,
 * a serialized envelope forwarded over TCP, or a plain Error) into a single
 * `{ code, status, message }` shape used by the exception filters.
 */
export function normalizeError(exception: unknown): NormalizedError {
  if (exception instanceof DomainError) {
    return {
      code: exception.code,
      status: HTTP_STATUS_BY_CODE[exception.code],
      message: exception.message,
    };
  }

  if (exception instanceof RpcException) {
    return normalizeError(exception.getError());
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const raw =
      typeof response === 'string'
        ? response
        : ((response as Record<string, unknown>)?.message ?? exception.message);
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'string'
        ? raw
        : exception.message;
    return {
      code: codeFromStatus(status),
      status,
      message,
    };
  }

  if (exception && typeof exception === 'object') {
    const e = exception as { code?: unknown; status?: unknown; message?: unknown };

    if (typeof e.code === 'string' && e.code in HTTP_STATUS_BY_CODE) {
      const code = e.code as ErrorCode;
      return {
        code,
        status: typeof e.status === 'number' ? e.status : HTTP_STATUS_BY_CODE[code],
        message: typeof e.message === 'string' ? e.message : 'Error',
      };
    }

    if (typeof e.status === 'number') {
      return {
        code: codeFromStatus(e.status),
        status: e.status,
        message: typeof e.message === 'string' ? e.message : 'Error',
      };
    }

    if (typeof e.message === 'string') {
      return { code: ErrorCode.INTERNAL, status: 500, message: e.message };
    }
  }

  return { code: ErrorCode.INTERNAL, status: 500, message: 'Internal server error' };
}
