require('dotenv').config();

function parseBooleanEnv(name) {
  const raw = process.env[name];
  if (raw == null || raw === '') {
    return undefined;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseListEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return [];
  }
  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseStringEnumEnv(name, allowedValues, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = String(raw).trim().toLowerCase();
  return allowedValues.includes(value) ? value : fallback;
}

// --- Required env vars (bot cannot start without these) ---
const REQUIRED_ALWAYS = [
  'API_KEY',
  'API_ENDPOINT',
  'TELEGRAM_TOKEN',
  'BOT_USERNAME',
  'TARGET_GROUP_IDS',
  'NOTIFICATION_GROUP_ID',
  'SPAM_THRESHOLD',
];

const missing = REQUIRED_ALWAYS.filter((key) => !process.env[key]);

if (!process.env.ADDITIONAL_API_KEY && !process.env.OPENROUTER_API_KEY) {
  missing.push('ADDITIONAL_API_KEY or OPENROUTER_API_KEY');
}

if (!process.env.SECONDARY_SPAM_API_KEY && !process.env.OPENROUTER_API_KEY) {
  missing.push('SECONDARY_SPAM_API_KEY or OPENROUTER_API_KEY');
}

if (missing.length > 0) {
  throw new Error(
    `[config] Missing required environment variables: ${missing.join(', ')}\n` +
    'Please check your .env file.'
  );
}

const messageAnalysisProvider = (() => {
  const explicit = String(process.env.MESSAGE_ANALYSIS_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'legacy' || explicit === 'dify') {
    return 'legacy';
  }
  if (explicit === 'openrouter') {
    return 'openrouter';
  }
  return process.env.OPENROUTER_API_KEY ? 'openrouter' : 'legacy';
})();

const secondarySpamProvider = (() => {
  const explicit = String(process.env.SECONDARY_SPAM_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'legacy' || explicit === 'dify') {
    return 'legacy';
  }
  if (explicit === 'openrouter') {
    return 'openrouter';
  }
  return process.env.OPENROUTER_API_KEY ? 'openrouter' : 'legacy';
})();

module.exports = {
  // --- AI / API ---
  API_KEY: process.env.API_KEY,
  ADDITIONAL_API_KEY: process.env.ADDITIONAL_API_KEY,
  ADDITIONAL_API_KEY_BACKUP: process.env.ADDITIONAL_API_KEY_BACKUP,
  API_ENDPOINT: process.env.API_ENDPOINT,
  SECONDARY_SPAM_API_KEY: process.env.SECONDARY_SPAM_API_KEY,
  SECONDARY_SPAM_API_KEY_BACKUP: process.env.SECONDARY_SPAM_API_KEY_BACKUP,
  EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY,
  MESSAGE_ANALYSIS_PROVIDER: messageAnalysisProvider,
  SECONDARY_SPAM_PROVIDER: secondarySpamProvider,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  OPENROUTER_ANALYSIS_MODEL: process.env.OPENROUTER_ANALYSIS_MODEL || 'openai/gpt-4.1-mini',
  OPENROUTER_SECONDARY_MODEL: process.env.OPENROUTER_SECONDARY_MODEL || 'openai/gpt-5.1',
  OPENROUTER_HTTP_REFERER: process.env.OPENROUTER_HTTP_REFERER,
  OPENROUTER_APP_TITLE: process.env.OPENROUTER_APP_TITLE || 'xecbot',
  OPENROUTER_TIMEOUT_MS: parseInt(process.env.OPENROUTER_TIMEOUT_MS || '60000'),
  OPENROUTER_TELEGRAM_IMAGE_MODE: parseStringEnumEnv(
    'OPENROUTER_TELEGRAM_IMAGE_MODE',
    ['remote_url', 'data_url'],
    'remote_url'
  ),
  OPENROUTER_PROVIDER_ORDER: parseListEnv('OPENROUTER_PROVIDER_ORDER'),
  OPENROUTER_PROVIDER_ONLY: parseListEnv('OPENROUTER_PROVIDER_ONLY'),
  OPENROUTER_PROVIDER_IGNORE: parseListEnv('OPENROUTER_PROVIDER_IGNORE'),
  OPENROUTER_PROVIDER_ALLOW_FALLBACKS: parseBooleanEnv('OPENROUTER_PROVIDER_ALLOW_FALLBACKS'),
  OPENROUTER_PROVIDER_SORT: process.env.OPENROUTER_PROVIDER_SORT,
  OPENROUTER_PROVIDER_ZDR: parseBooleanEnv('OPENROUTER_PROVIDER_ZDR'),

  // --- Telegram ---
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,
  TARGET_GROUP_IDS: process.env.TARGET_GROUP_IDS.split(','),
  KOUSH_USER_ID: process.env.KOUSH_USER_ID,
  ALITAYIN_USER_ID: process.env.ALITAYIN_USER_ID,
  NOTIFICATION_GROUP_ID: process.env.NOTIFICATION_GROUP_ID,
  // Kept as hardcode — not expected to change between deployments.
  ECASH_ARMY_GROUP_ID: '-1001533588498',

  // --- User lists ---
  ALLOWED_USERS: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : [],
  BLOCKED_USERS: process.env.BLOCKED_USERS ? process.env.BLOCKED_USERS.split(',') : [],

  // --- Spam detection ---
  SPAM_THRESHOLD: parseInt(process.env.SPAM_THRESHOLD),
  USERNAME_LENGTH_THRESHOLD: parseInt(process.env.USERNAME_LENGTH_THRESHOLD || '30'),
  NORMAL_STREAK_THRESHOLD: parseInt(process.env.NORMAL_STREAK_THRESHOLD || '3'),

  // --- Rate limiting / concurrency ---
  GLOBAL_CONCURRENCY: parseInt(process.env.GLOBAL_CONCURRENCY || '20'),
  REQUEST_INTERVAL_MS: parseInt(process.env.REQUEST_INTERVAL_MS || String(10 * 1000)),
  DAILY_LIMIT: parseInt(process.env.DAILY_LIMIT || '10'),
  DAILY_WINDOW_MS: parseInt(process.env.DAILY_WINDOW_MS || String(24 * 60 * 60 * 1000)),

  // --- Price data APIs ---
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  CMC_API_KEY: process.env.CMC_API_KEY,

  // --- Keyword config ---
  RELEVANT_KEYWORDS: process.env.RELEVANT_KEYWORDS ? process.env.RELEVANT_KEYWORDS.split(',') : [],
  DATA_KEYWORDS: process.env.DATA_KEYWORDS ? process.env.DATA_KEYWORDS.split(',') : [],

  // --- Chronik ---
  CHRONIK_URLS: (process.env.CHRONIK_URLS || 'https://chronik.e.cash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  CHRONIK_TIMEOUT_MS: parseInt(process.env.CHRONIK_TIMEOUT_MS || '8000'),

  // --- MCP ---
  MCP_ECASH_URL: process.env.MCP_ECASH_URL || 'https://teamsocket.net/mcp',
  MCP_TIMEOUT_MS: parseInt(process.env.MCP_TIMEOUT_MS || '15000'),

  // --- Auto-delete ---
  AUTO_DELETE_PROMPT_MS: parseInt(process.env.AUTO_DELETE_PROMPT_MS || String(30 * 1000)),
};
