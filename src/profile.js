import { readSecret } from './secrets.js';

export const claudeEnvNames = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_CUSTOM_MODEL_OPTION',
  'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME',
  'ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION',
  'ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_CUSTOM_HEADERS',
  'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
  'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB',
  'API_TIMEOUT_MS',
  'API_FORCE_IDLE_TIMEOUT',
  'CLAUDE_STREAM_IDLE_TIMEOUT_MS'
];

export function validateProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') errors.push('profile must be an object');
  if (!profile.baseUrl || !/^https?:\/\//.test(profile.baseUrl)) errors.push('baseUrl must start with http:// or https://');
  if (!['bearer', 'api-key', 'none'].includes(profile.authMode)) errors.push('authMode must be bearer, api-key, or none');
  if (profile.authMode !== 'none' && !profile.secretRef) errors.push('secretRef is required unless authMode is none');
  if (!profile.model) errors.push('model is required');
  return errors;
}

export async function buildEnv(profile, options = {}) {
  const env = {
    ANTHROPIC_BASE_URL: profile.baseUrl,
    ANTHROPIC_MODEL: profile.model,
    ...modelEnv(profile.models || {}),
    ...(profile.env || {})
  };

  if (options.includeSecrets !== false && profile.authMode !== 'none') {
    const secret = await readSecret(profile.secretRef);
    if (profile.authMode === 'bearer') env.ANTHROPIC_AUTH_TOKEN = secret;
    if (profile.authMode === 'api-key') env.ANTHROPIC_API_KEY = secret;
  }

  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export function redactProfile(profile) {
  return {
    ...profile,
    secretRef: profile.secretRef ? redactSecretRef(profile.secretRef) : null
  };
}

function modelEnv(models) {
  const env = {};
  if (models.sonnet) env.ANTHROPIC_DEFAULT_SONNET_MODEL = models.sonnet;
  if (models.opus) env.ANTHROPIC_DEFAULT_OPUS_MODEL = models.opus;
  if (models.haiku) env.ANTHROPIC_DEFAULT_HAIKU_MODEL = models.haiku;
  if (models.fable) env.ANTHROPIC_DEFAULT_FABLE_MODEL = models.fable;
  return env;
}

function redactSecretRef(ref) {
  if (ref.startsWith('file:')) return ref;
  if (ref.startsWith('env:')) return ref;
  return '***';
}
