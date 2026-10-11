/**
 * ============================================================================
 * REQUEST LOGGING MIDDLEWARE
 * Logs all incoming requests with timing
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('request');

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Attach request ID to response headers
  res.setHeader('x-request-id', requestId);
  (req as any).requestId = requestId;

  // Log request start
  logger.debug(`→ ${req.method} ${req.path}`, {
    requestId,
    query: req.query,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`← ${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      requestId,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
