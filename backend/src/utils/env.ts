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

const REQUIRED_VARS = [
  'NODE_ENV',
  'PORT',
  'JWT_SECRET',
];

const AI_PROVIDER_KEYS = {
  GEMINI_API_KEY: 'ENABLE_GEMINI',
  ANTHROPIC_API_KEY: 'ENABLE_CLAUDE',
  OPENAI_API_KEY: 'ENABLE_OPENAI',
  TOGETHER_API_KEY: 'ENABLE_DEEPSEEK',
};

export function validateEnv(): ValidationResult {
  const errors: string[] = [];

  // Check required vars
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required env var: ${varName}`);
    }
  }

  // Check at least ONE AI provider key is configured
  const hasAnyAIKey = Object.keys(AI_PROVIDER_KEYS).some(
    (key) => process.env[key]
  );
  if (!hasAnyAIKey) {
    errors.push(
      'At least one AI provider key must be configured (GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, TOGETHER_API_KEY)'
    );
  }

  // Validate JWT secret length
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
