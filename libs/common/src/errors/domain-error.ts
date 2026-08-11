export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION = 'VALIDATION',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',
  INTERNAL = 'INTERNAL',
}

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.VALIDATION]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.DEPENDENCY_FAILURE]: 502,
  [ErrorCode.INTERNAL]: 500,
};

/**
 * Framework-agnostic error thrown by the domain/application layers.
 * Transport translation happens only at the boundary (exception filters).
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = ErrorCode.NOT_FOUND;
}

export class ConflictError extends DomainError {
  readonly code = ErrorCode.CONFLICT;
}

export class ValidationError extends DomainError {
  readonly code = ErrorCode.VALIDATION;
}

export class DependencyError extends DomainError {
  readonly code = ErrorCode.DEPENDENCY_FAILURE;
}
