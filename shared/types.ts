/**
 * ============================================================================
 * SHARED TYPE DEFINITIONS
 * Frontend + Backend use these to ensure type safety across the full stack
 * ============================================================================
 */

// ============================================================================
// AUTH & USER
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'developer';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  tokenType: 'Bearer';
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: AuthToken;
  user?: User;
  error?: string;
}

// ============================================================================
// API MODELS & ROUTING
// ============================================================================

export type AIProvider = 'gemini' | 'anthropic' | 'openai' | 'deepseek' | 'llama';

export type AIModel =
  | 'gemini-3.8-flash'
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'claude-fable-5-1'
  | 'claude-mythos-5-1'
  | 'gpt-4o'
  | 'gpt-5'
  | 'openai-astra'
  | 'deepseek-v4-305b'
  | 'deepseek-r1'
  | 'llama-3.3-70b';

export type TaskType =
  | 'auto'
  | 'fast'
  | 'multimodal_free'
  | 'creative'
  | 'reasoning'
  | 'code'
  | 'chat';

export interface ModelInfo {
  id: AIModel;
  provider: AIProvider;
  name: string;
  description: string;
  speedRating: number; // 1-10, higher = faster
  costRating: number; // 1-10, higher = more expensive
  inputPricing: {
    perMillionTokens: number; // USD
  };
  outputPricing: {
    perMillionTokens: number; // USD
  };
  maxInputTokens: number;
  maxOutputTokens: number;
  capabilities: string[];
  enabled: boolean;
}

// ============================================================================
// AI CHAT REQUEST/RESPONSE
// ============================================================================

export interface AIImage {
  data: string; // base64 or data URL
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

export interface AIChatRequest {
  prompt: string;
  model?: AIModel; // if not provided, auto-route
  taskType?: TaskType;
  image?: AIImage | null;
  stream?: boolean;
  temperature?: number; // 0-1
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AIChatResponse {
  success: boolean;
  text: string;
  model: AIModel;
  provider: AIProvider;
  taskType: TaskType;
  usage: {
    inputTokens: number; // actual from API
    outputTokens: number; // actual from API
    totalTokens: number;
  };
  cost: {
    inputCostUSD: number;
    outputCostUSD: number;
    totalCostUSD: number;
  };
  latencyMs: number;
  timestamp: string; // ISO 8601
  guardrailStatus: 'PASSED' | 'BLOCKED';
  error?: string;
}

export interface AIChatStreamChunk {
  type: 'chunk' | 'complete' | 'error';
  text?: string;
  error?: string;
}

// ============================================================================
// TOOL INVOCATION
// ============================================================================

export type ToolName =
  | 'code_generator'
  | 'image_analyzer'
  | 'code_debugger'
  | 'doc_generator'
  | 'test_generator'
  | 'ui_converter';

export interface ToolInvokeRequest {
  toolName: ToolName;
  params: Record<string, any>;
  model?: AIModel;
}

export interface ToolInvokeResponse {
  success: boolean;
  tool: ToolName;
  result: any;
  error?: string;
}

// ============================================================================
// API USAGE & BILLING
// ============================================================================

export interface UsageRecord {
  id: string;
  userId: string;
  model: AIModel;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  taskType: TaskType;
  timestamp: Date;
}

export interface BillingRecord {
  id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCostUSD: number;
  totalRequests: number;
  modelBreakdown: Record<AIModel, number>; // cost per model
  status: 'pending' | 'paid' | 'overdue';
}

// ============================================================================
// HEALTH & STATUS
// ============================================================================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number; // seconds
  models: Record<AIModel, {
    status: 'online' | 'offline' | 'error';
    lastCheck: string;
    responseTimeMs?: number;
    error?: string;
  }>;
  database: {
    status: 'connected' | 'disconnected';
    latencyMs?: number;
  };
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId?: string; // for tracing
  };
}

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginationParams {
  page: number; // 1-indexed
  limit: number; // max items per page
  sort?: string; // field name
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
