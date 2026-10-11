/**
 * ============================================================================
 * TOOLS ROUTE
 * Tool invocation for code generation, analysis, etc.
 * ============================================================================
 */

import { Router, Response } from 'express';
import { ToolInvokeRequest, ToolInvokeResponse } from '../../shared/types';
import { createLogger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { aiGateway } from '../services/aiGateway';

const router = Router();
const logger = createLogger('tools-route');

router.post('/:toolName', async (req: AuthRequest, res: Response<ToolInvokeResponse>) => {
  try {
    const { toolName } = req.params;
    const { params, model } = req.body as ToolInvokeRequest;

    logger.info(`Tool invoked: ${toolName}`, { userId: req.user?.id });

    // Route to specific tool implementation
    let result;
    switch (toolName) {
      case 'code_generator':
        result = await codeGenerator(params, model);
        break;

      case 'image_analyzer':
        result = await imageAnalyzer(params, model);
        break;

      case 'code_debugger':
        result = await codeDebugger(params, model);
        break;

      case 'doc_generator':
        result = await docGenerator(params, model);
        break;

      case 'test_generator':
        result = await testGenerator(params, model);
        break;

      case 'ui_converter':
        result = await uiConverter(params, model);
        break;

      default:
        return res.status(404).json({
          success: false,
          tool: toolName as any,
          result: null,
          error: `Tool '${toolName}' not found`,
        });
    }

    res.json({
      success: true,
      tool: toolName as any,
      result,
    });
  } catch (error) {
    logger.error('Tool error', error as Error);
    res.status(500).json({
      success: false,
      tool: req.params.toolName as any,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Tool implementations

async function codeGenerator(params: any, model?: string) {
  const prompt = `Generate clean, production-ready code for: ${params.description}`;
  const response = await aiGateway({
    prompt,
    model: (model as any) || 'claude-mythos-5-1',
    taskType: 'code',
  });
  return { code: response.text, model: response.model };
}

async function imageAnalyzer(params: any, model?: string) {
  const response = await aiGateway({
    prompt: `Analyze this image and describe what you see: ${params.description || ''}`,
    image: params.image,
    model: (model as any) || 'deepseek-v4-305b',
    taskType: 'multimodal_free',
  });
  return { analysis: response.text, model: response.model };
}

async function codeDebugger(params: any, model?: string) {
  const prompt = `Debug this code and explain the issues:\n\`\`\`\n${params.code}\n\`\`\``;
  const response = await aiGateway({
    prompt,
    model: (model as any) || 'claude-mythos-5-1',
    taskType: 'code',
  });
  return { debugOutput: response.text, model: response.model };
}

async function docGenerator(params: any, model?: string) {
  const prompt = `Generate comprehensive documentation for: ${params.description}`;
  const response = await aiGateway({
    prompt,
    model: (model as any) || 'claude-fable-5-1',
    taskType: 'creative',
  });
  return { documentation: response.text, model: response.model };
}

async function testGenerator(params: any, model?: string) {
  const prompt = `Generate test cases for this code:\n\`\`\`\n${params.code}\n\`\`\``;
  const response = await aiGateway({
    prompt,
    model: (model as any) || 'claude-mythos-5-1',
    taskType: 'code',
  });
  return { tests: response.text, model: response.model };
}

async function uiConverter(params: any, model?: string) {
  const prompt = `Convert this design to React code:\n${params.description}`;
  const response = await aiGateway({
    prompt,
    image: params.image,
    model: (model as any) || 'claude-mythos-5-1',
    taskType: 'code',
  });
  return { reactCode: response.text, model: response.model };
}

export default router;
