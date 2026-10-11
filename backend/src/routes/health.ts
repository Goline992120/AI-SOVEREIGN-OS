/**
 * ============================================================================
 * HEALTH CHECK ROUTE
 * Exposes server health and model availability
 * ============================================================================
 */

import { Router, Response } from 'express';
import { HealthResponse } from '../../shared/types';
import { createLogger } from '../utils/logger';
import { MODEL_REGISTRY } from '../services/aiGateway';

const router = Router();
const logger = createLogger('health-route');
const startupTime = Date.now();

router.get('/', async (req, res: Response<HealthResponse>) => {
  const models: Record<string, any> = {};

  // Check each model's API key availability
  for (const [modelName, config] of Object.entries(MODEL_REGISTRY)) {
    models[modelName] = {
      status: config.apiKey ? 'online' : 'offline',
      lastCheck: new Date().toISOString(),
    };
  }

  const uptime = Math.floor((Date.now() - startupTime) / 1000);

  const response: HealthResponse = {
    status: Object.values(models).some((m) => m.status === 'online') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime,
    models,
    database: {
      status: 'connected', // TODO: Check actual DB connection
    },
  };

  res.json(response);
});

export default router;
