/**
 * ============================================================================
 * ENVIRONMENT VARIABLE VALIDATION
 * Ensures all required env vars are set on startup
 * ============================================================================
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_VARS = ['NODE_ENV', 'PORT'];

const AI_PROVIDER_KEYS = {
  GEMINI_API_KEY: 'ENABLE_GEMINI',
  ANTHROPIC_API_KEY: 'ENABLE_CLAUDE',
  OPENAI_API_KEY: 'ENABLE_OPENAI',
  TOGETHER_API_KEY: 'ENABLE_DEEPSEEK',
};

export function validateEnv(): ValidationResult {
  const errors: string[] = [];

  // Required runtime values
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required env var: ${varName}`);
    }
  }

  // Do not hard-fail if no AI provider keys are configured.
  // Production app should run in degraded / offline mode instead of crashing.
  const hasAnyAIKey = Object.keys(AI_PROVIDER_KEYS).some((key) => process.env[key]);
  if (!hasAnyAIKey) {
    console.warn('[env] No AI provider keys configured. App will run in degraded mode.');
  }

  // JWT secret is optional in local/dev but should be at least 32 chars when provided.
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  // Validate port is number
  if (process.env.PORT && isNaN(Number(process.env.PORT))) {
    errors.push('PORT must be a valid number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
