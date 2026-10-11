/**
 * ============================================================================
 * AI GATEWAY - Multi-Model Router with Retry & Fallback
 * Production-grade adapter pattern for all AI providers
 * ============================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createLogger } from '../utils/logger';
import { AIChatRequest, AIChatResponse, AIModel, AIProvider, AIImage } from '../../shared/types';

const logger = createLogger('ai-gateway');

// ============================================================================
// MODEL CONFIGURATION & PRICING
// ============================================================================

export const MODEL_REGISTRY: Record<AIModel, {
  provider: AIProvider;
  apiKey: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  inputPricingPer1M: number;
  outputPricingPer1M: number;
  speedScore: number;
}> = {
  'gemini-3.8-flash': {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    maxInputTokens: 1_000_000,
    maxOutputTokens: 8_000,
    inputPricingPer1M: 0.075,
    outputPricingPer1M: 0.30,
    speedScore: 10,
  },
  'gemini-2.5-flash': {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    maxInputTokens: 1_000_000,
    maxOutputTokens: 8_000,
    inputPricingPer1M: 0.075,
    outputPricingPer1M: 0.30,
    speedScore: 9,
  },
  'gemini-2.0-flash': {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    maxInputTokens: 1_000_000,
    maxOutputTokens: 8_000,
    inputPricingPer1M: 0.10,
    outputPricingPer1M: 0.40,
    speedScore: 8,
  },
  'claude-fable-5-1': {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    maxInputTokens: 200_000,
    maxOutputTokens: 4_096,
    inputPricingPer1M: 3.00,
    outputPricingPer1M: 15.00,
    speedScore: 6,
  },
  'claude-mythos-5-1': {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    maxInputTokens: 200_000,
    maxOutputTokens: 4_096,
    inputPricingPer1M: 5.00,
    outputPricingPer1M: 25.00,
    speedScore: 5,
  },
  'gpt-4o': {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    maxInputTokens: 128_000,
    maxOutputTokens: 4_096,
    inputPricingPer1M: 2.50,
    outputPricingPer1M: 10.00,
    speedScore: 7,
  },
  'gpt-5': {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    maxInputTokens: 128_000,
    maxOutputTokens: 4_096,
    inputPricingPer1M: 5.00,
    outputPricingPer1M: 20.00,
    speedScore: 4,
  },
  'openai-astra': {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    maxInputTokens: 200_000,
    maxOutputTokens: 8_000,
    inputPricingPer1M: 8.00,
    outputPricingPer1M: 32.00,
    speedScore: 3,
  },
  'deepseek-v4-305b': {
    provider: 'deepseek',
    apiKey: process.env.TOGETHER_API_KEY || '',
    maxInputTokens: 500_000,
    maxOutputTokens: 4_096,
    inputPricingPer1M: 0.00, // Free tier
    outputPricingPer1M: 0.00,
    speedScore: 8,
  },
  'deepseek-r1': {
    provider: 'deepseek',
    apiKey: process.env.TOGETHER_API_KEY || '',
    maxInputTokens: 200_000,
    maxOutputTokens: 4_096,
    inputPricingPer1M: 0.55,
    outputPricingPer1M: 2.19,
    speedScore: 4,
  },
  'llama-3.3-70b': {
    provider: 'llama',
    apiKey: process.env.REPLICATE_API_KEY || '',
    maxInputTokens: 8_000,
    maxOutputTokens: 4_096,
    inputPricingPer1M: 0.00, // Open source
    outputPricingPer1M: 0.00,
    speedScore: 6,
  },
};

// ============================================================================
// RETRY & TIMEOUT CONFIGURATION
// ============================================================================

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

const REQUEST_TIMEOUT_MS = 60_000; // 60 seconds

// ============================================================================
// SAFETY GUARDRAILS
// ============================================================================

const BANNED_PATTERNS = [
  /\b(?:build|synthesize|manufacture)\s+(?:biological|chemical|nuclear)\s+weapon/i,
  /\b(?:exploit|zero-day)\s+payload\s+for\s+(?:critical|scada|infrastructure)/i,
  /\bhow\s+to\s+(?:create|distribute)\s+(?:ransomware|destructive\s+malware)/i,
];

function checkSafetyGuardrails(text: string): { safe: boolean; reason?: string } {
  if (text.length > 1_000_000) {
    return { safe: false, reason: 'Content exceeds maximum length (1M characters)' };
  }

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: 'Content violates safety policy' };
    }
  }

  return { safe: true };
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
        ),
      ]);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
          RETRY_CONFIG.maxDelayMs
        );

        logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          error: lastError.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${RETRY_CONFIG.maxRetries} retries`);
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 3.8 characters
  return Math.ceil(text.length / 3.8);
}

// ============================================================================
// COST CALCULATION
// ============================================================================

function calculateCost(
  model: AIModel,
  inputTokens: number,
  outputTokens: number
): { inputCostUSD: number; outputCostUSD: number; totalCostUSD: number } {
  const config = MODEL_REGISTRY[model];
  if (!config) {
    return { inputCostUSD: 0, outputCostUSD: 0, totalCostUSD: 0 };
  }

  const inputCostUSD = (inputTokens / 1_000_000) * config.inputPricingPer1M;
  const outputCostUSD = (outputTokens / 1_000_000) * config.outputPricingPer1M;

  return {
    inputCostUSD: Number(inputCostUSD.toFixed(6)),
    outputCostUSD: Number(outputCostUSD.toFixed(6)),
    totalCostUSD: Number((inputCostUSD + outputCostUSD).toFixed(6)),
  };
}

// ============================================================================
// MODEL-SPECIFIC IMPLEMENTATIONS
// ============================================================================

async function callGemini(
  model: AIModel,
  prompt: string,
  image: AIImage | null,
  temperature: number
): Promise<{ text: string; actualInputTokens: number; actualOutputTokens: number }> {
  const config = MODEL_REGISTRY[model];
  if (!config.apiKey) {
    throw new Error(`Gemini API key not configured`);
  }

  const genAI = new GoogleGenerativeAI(config.apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const parts: any[] = [];

  if (image) {
    parts.push({
      inlineData: {
        data: image.data.split(',')[1] || image.data, // Remove data: prefix if present
        mimeType: image.mimeType,
      },
    });
  }

  parts.push({ text: prompt });

  const result = await withRetry(
    () => geminiModel.generateContent({ contents: [{ role: 'user', parts }], generationConfig: { temperature } }),
    `Gemini ${model} generation`
  );

  const text = result.response.text();
  const usageMetadata = (result.response as any).usageMetadata;

  return {
    text,
    actualInputTokens: usageMetadata?.promptTokenCount || estimateTokens(prompt),
    actualOutputTokens: usageMetadata?.candidatesTokenCount || estimateTokens(text),
  };
}

async function callClaude(
  model: AIModel,
  prompt: string,
  temperature: number
): Promise<{ text: string; actualInputTokens: number; actualOutputTokens: number }> {
  const config = MODEL_REGISTRY[model];
  if (!config.apiKey) {
    throw new Error(`Anthropic API key not configured`);
  }

  const anthropic = new Anthropic({ apiKey: config.apiKey });

  const result = await withRetry(
    () =>
      anthropic.messages.create({
        model,
        max_tokens: config.maxOutputTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    `Claude ${model} generation`
  );

  const text = result.content.map((c) => (c.type === 'text' ? c.text : '')).join('');

  return {
    text,
    actualInputTokens: result.usage.input_tokens,
    actualOutputTokens: result.usage.output_tokens,
  };
}

async function callOpenAI(
  model: AIModel,
  prompt: string,
  temperature: number
): Promise<{ text: string; actualInputTokens: number; actualOutputTokens: number }> {
  const config = MODEL_REGISTRY[model];
  if (!config.apiKey) {
    throw new Error(`OpenAI API key not configured`);
  }

  const openai = new OpenAI({ apiKey: config.apiKey });

  const result = await withRetry(
    () =>
      openai.chat.completions.create({
        model,
        temperature,
        max_tokens: config.maxOutputTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    `OpenAI ${model} generation`
  );

  const text = result.choices[0]?.message?.content || '';

  return {
    text,
    actualInputTokens: result.usage?.prompt_tokens || estimateTokens(prompt),
    actualOutputTokens: result.usage?.completion_tokens || estimateTokens(text),
  };
}

async function callDeepSeek(
  model: AIModel,
  prompt: string,
  temperature: number
): Promise<{ text: string; actualInputTokens: number; actualOutputTokens: number }> {
  const config = MODEL_REGISTRY[model];
  if (!config.apiKey) {
    throw new Error(`DeepSeek/Together API key not configured`);
  }

  const together = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://api.together.xyz/v1',
  });

  const result = await withRetry(
    () =>
      together.chat.completions.create({
        model: 'deepseek-ai/deepseek-v4-305b',
        temperature,
        max_tokens: config.maxOutputTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    `DeepSeek ${model} generation`
  );

  const text = result.choices[0]?.message?.content || '';

  return {
    text,
    actualInputTokens: result.usage?.prompt_tokens || estimateTokens(prompt),
    actualOutputTokens: result.usage?.completion_tokens || estimateTokens(text),
  };
}

// ============================================================================
// AUTO-ROUTING LOGIC
// ============================================================================

function selectBestModel(prompt: string, image: AIImage | null, taskType: string): AIModel {
  const lowerPrompt = prompt.toLowerCase();

  // Code/Reasoning tasks → Claude Mythos
  const codeKeywords = ['code', 'debug', 'function', 'class', 'algorithm', 'optimize'];
  if (codeKeywords.some((kw) => lowerPrompt.includes(kw))) {
    return 'claude-mythos-5-1';
  }

  // Creative writing → Claude Fable
  const creativeKeywords = ['story', 'write', 'poem', 'novel', 'character', 'dialogue'];
  if (creativeKeywords.some((kw) => lowerPrompt.includes(kw))) {
    return 'claude-fable-5-1';
  }

  // Image analysis → DeepSeek (free multimodal)
  if (image) {
    return 'deepseek-v4-305b';
  }

  // Reasoning → Claude Mythos
  const reasoningKeywords = ['reason', 'logic', 'proof', 'think', 'analyze'];
  if (reasoningKeywords.some((kw) => lowerPrompt.includes(kw))) {
    return 'claude-mythos-5-1';
  }

  // Default → Gemini Flash (fastest & cheapest)
  return 'gemini-3.8-flash';
}

// ============================================================================
// MAIN GATEWAY FUNCTION
// ============================================================================

export async function aiGateway(request: AIChatRequest): Promise<AIChatResponse> {
  const startTime = Date.now();

  try {
    // 1. Validate input
    const inputGuardrail = checkSafetyGuardrails(request.prompt);
    if (!inputGuardrail.safe) {
      logger.warn('Input blocked by safety guardrails', { reason: inputGuardrail.reason });
      return {
        success: false,
        text: `⚠️ Your request was blocked: ${inputGuardrail.reason}`,
        model: 'none' as any,
        provider: 'safety' as any,
        taskType: request.taskType || 'auto',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { inputCostUSD: 0, outputCostUSD: 0, totalCostUSD: 0 },
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        guardrailStatus: 'BLOCKED',
        error: inputGuardrail.reason,
      };
    }

    // 2. Select model
    const selectedModel = request.model || selectBestModel(request.prompt, request.image || null, request.taskType || 'auto');
    const config = MODEL_REGISTRY[selectedModel];

    if (!config) {
      throw new Error(`Unknown model: ${selectedModel}`);
    }

    if (!config.apiKey) {
      throw new Error(`API key not configured for ${selectedModel}`);
    }

    // 3. Call appropriate provider
    let result;
    switch (config.provider) {
      case 'gemini':
        result = await callGemini(
          selectedModel,
          request.prompt,
          request.image || null,
          request.temperature || 0.7
        );
        break;

      case 'anthropic':
        result = await callClaude(
          selectedModel,
          request.prompt,
          request.temperature || 0.7
        );
        break;

      case 'openai':
        result = await callOpenAI(
          selectedModel,
          request.prompt,
          request.temperature || 0.7
        );
        break;

      case 'deepseek':
        result = await callDeepSeek(
          selectedModel,
          request.prompt,
          request.temperature || 0.7
        );
        break;

      default:
        throw new Error(`Provider not implemented: ${config.provider}`);
    }

    // 4. Validate output
    const outputGuardrail = checkSafetyGuardrails(result.text);
    if (!outputGuardrail.safe) {
      logger.warn('Output blocked by safety guardrails');
      return {
        success: false,
        text: '⚠️ Response was blocked by safety filters',
        model: selectedModel,
        provider: config.provider,
        taskType: request.taskType || 'auto',
        usage: {
          inputTokens: result.actualInputTokens,
          outputTokens: 0,
          totalTokens: result.actualInputTokens,
        },
        cost: calculateCost(selectedModel, result.actualInputTokens, 0),
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        guardrailStatus: 'BLOCKED',
        error: 'Output blocked by safety policy',
      };
    }

    // 5. Calculate cost
    const cost = calculateCost(
      selectedModel,
      result.actualInputTokens,
      result.actualOutputTokens
    );

    logger.info(`AI Gateway success: ${selectedModel}`, {
      inputTokens: result.actualInputTokens,
      outputTokens: result.actualOutputTokens,
      costUSD: cost.totalCostUSD,
      latencyMs: Date.now() - startTime,
    });

    return {
      success: true,
      text: result.text,
      model: selectedModel,
      provider: config.provider,
      taskType: request.taskType || 'auto',
      usage: {
        inputTokens: result.actualInputTokens,
        outputTokens: result.actualOutputTokens,
        totalTokens: result.actualInputTokens + result.actualOutputTokens,
      },
      cost,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      guardrailStatus: 'PASSED',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('AI Gateway error', error as Error, { prompt: request.prompt.slice(0, 100) });

    return {
      success: false,
      text: `❌ Error: ${errorMessage}. Please try again or use a different model.`,
      model: request.model || 'unknown' as any,
      provider: 'error' as any,
      taskType: request.taskType || 'auto',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { inputCostUSD: 0, outputCostUSD: 0, totalCostUSD: 0 },
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      guardrailStatus: 'PASSED',
      error: errorMessage,
    };
  }
}

export default aiGateway;
