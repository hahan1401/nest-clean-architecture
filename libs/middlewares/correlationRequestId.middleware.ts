import { CorrelatedRequest } from '@app/common';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class CorrelationRequestIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: CorrelatedRequest, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    const requestId = (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    this.logger.info({
      requestId,
      method: req.method,
    });
    next();
  }
}
