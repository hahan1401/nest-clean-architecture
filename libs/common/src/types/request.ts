import type { Request } from 'express';

/** Request decorated by CorrelationRequestIdMiddleware. */
export type CorrelatedRequest = Request & { requestId?: string };
