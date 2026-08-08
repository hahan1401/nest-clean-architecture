import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ConflictError, ErrorCode, NotFoundError } from './domain-error';
import { normalizeError } from './normalize';

describe('normalizeError', () => {
  it('maps a DomainError to its code and status', () => {
    expect(normalizeError(new ConflictError('taken'))).toEqual({
      code: ErrorCode.CONFLICT,
      status: 409,
      message: 'taken',
    });
  });

  it('unwraps an RpcException', () => {
    const rpc = new RpcException(new NotFoundError('gone'));

    expect(normalizeError(rpc)).toMatchObject({ code: ErrorCode.NOT_FOUND, status: 404 });
  });

  /**
   * The shape a DomainError actually has after crossing TCP - captured from a
   * live api-booking call. Nest serializes an RpcException carrying an object as
   * `{ error: <payload>, message }`, so the code sits one level down. Getting
   * this wrong turns every microservice 404/409 into a 500 at the gateway.
   */
  it('unwraps the envelope Nest puts a DomainError in when it crosses TCP', () => {
    const overTheWire = {
      error: {
        code: 'CONFLICT',
        status: 409,
        message: 'Those dates are no longer available for this room',
        requestId: 'req-1',
      },
      message: 'Those dates are no longer available for this room',
    };

    expect(normalizeError(overTheWire)).toEqual({
      code: ErrorCode.CONFLICT,
      status: 409,
      message: 'Those dates are no longer available for this room',
    });
  });

  it('reads a flat serialized envelope', () => {
    expect(normalizeError({ code: 'NOT_FOUND', status: 404, message: 'nope' })).toEqual({
      code: ErrorCode.NOT_FOUND,
      status: 404,
      message: 'nope',
    });
  });

  it('maps an HttpException by its status', () => {
    expect(normalizeError(new HttpException('bad', HttpStatus.BAD_REQUEST))).toMatchObject({
      code: ErrorCode.VALIDATION,
      status: 400,
    });
  });

  it('falls back to a 500 for an unrecognised error', () => {
    expect(normalizeError(new Error('boom'))).toEqual({
      code: ErrorCode.INTERNAL,
      status: 500,
      message: 'boom',
    });
  });

  it('does not recurse forever on a self-referencing envelope', () => {
    const looped: Record<string, unknown> = { message: 'loop' };
    looped.error = looped;

    expect(normalizeError(looped)).toEqual({
      code: ErrorCode.INTERNAL,
      status: 500,
      message: 'loop',
    });
  });
});
