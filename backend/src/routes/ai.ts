/**
 * ============================================================================
 * AI CHAT ROUTE
 * Main endpoint for AI requests with streaming support
 * ============================================================================
 */

import { Router, Response } from 'express';
import { AIChatRequest, AIChatResponse, AIChatStreamChunk } from '../../shared/types';
import { aiGateway } from '../services/aiGateway';
import { createLogger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const logger = createLogger('ai-route');

router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const request: AIChatRequest = req.body;

    // Validate request
    if (!request.prompt) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Prompt is required',
        },
      });
    }

    // TODO: Check user quota before calling gateway

    // Call AI gateway
    const response = await aiGateway(request);

    // TODO: Log usage to database

    res.json(response);
  } catch (error) {
    logger.error('AI chat error', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process request',
      },
    });
  }
});

// Streaming endpoint
router.post('/chat-stream', async (req: AuthRequest, res: Response) => {
  try {
    const request: AIChatRequest = req.body;

    if (!request.prompt) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Prompt required' },
      });
    }

    // Set response headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // TODO: Implement actual streaming with AI providers
    // For now, send non-streaming response as stream
    const response = await aiGateway(request);

    res.write(`data: ${JSON.stringify({ type: 'chunk', text: response.text })}

`);
    res.write(`data: ${JSON.stringify({ type: 'complete', response })}

`);
    res.end();
  } catch (error) {
    logger.error('Stream error', error as Error);
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })}

`
    );
    res.end();
  }
});

export default router;
