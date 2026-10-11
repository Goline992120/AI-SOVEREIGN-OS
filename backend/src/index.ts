/**
 * ============================================================================
 * SOVEREIGN OS BACKEND - PRODUCTION GRADE
 * Main entry point for Express server
 * ============================================================================
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger';
import { validateEnv } from './utils/env';
import aiRouter from './routes/ai';
import authRouter from './routes/auth';
import healthRouter from './routes/health';
import toolsRouter from './routes/tools';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { authenticate } from './middleware/auth';

// Load environment variables
dotenv.config();

// Validate environment on startup
const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error('Environment validation failed:', envValidation.errors);
  process.exit(1);
}

const logger = createLogger('server');
const app: Express = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:5173',
    credentials: true,
  })
);

// ============================================================================
// BODY PARSING
// ============================================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================================
// LOGGING & RATE LIMITING
// ============================================================================

app.use(requestLogger);
app.use(rateLimiter);

// ============================================================================
// ROUTES
// ============================================================================

// Health check (no auth required)
app.use('/api/health', healthRouter);

// Authentication (no auth required)
app.use('/api/auth', authRouter);

// Protected routes (require authentication)
app.use('/api/ai', authenticate, aiRouter);
app.use('/api/tools', authenticate, toolsRouter);

// ============================================================================
// 404 HANDLER
// ============================================================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// ============================================================================
// ERROR HANDLER (MUST BE LAST)
// ============================================================================

app.use(errorHandler);

// ============================================================================
// STARTUP
// ============================================================================

async function startServer() {
  try {
    // Initialize database (if needed)
    // await initializeDatabase();

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on http://0.0.0.0:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Available routes: /api/health, /api/auth, /api/ai, /api/tools`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.warn('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
