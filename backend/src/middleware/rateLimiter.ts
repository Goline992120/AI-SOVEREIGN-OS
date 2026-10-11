/**
 * ============================================================================
 * RATE LIMITER MIDDLEWARE
 * Prevents API abuse with per-user request limits
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('rate-limiter');

interface RateLimitEntry {
  requests: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000); // 1 minute
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Get identifier (user ID from JWT, or IP)
  const identifier = (req as any).user?.id || req.ip || 'unknown';

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(identifier, {
      requests: 1,
      resetTime: now + WINDOW_MS,
    });
    return next();
  }

  entry.requests++;

  if (entry.requests > MAX_REQUESTS) {
    logger.warn('Rate limit exceeded', {
      identifier,
      requests: entry.requests,
      limit: MAX_REQUESTS,
    });

    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Max ${MAX_REQUESTS} requests per ${WINDOW_MS}ms`,
      },
    });
  }

  next();
}
