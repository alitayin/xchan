const EchanApiClient = require('./echanApi.js');
const OpenRouterClient = require('./openRouterClient.js');
const { withKeyRotation } = require('./withKeyRotation.js');
const { buildOpenRouterClientOptions, buildOpenRouterProviderOptions } = require('./openRouterConfig.js');
const logger = require('../../utils/logger.js');
const {
  SECONDARY_CONTENT_JSON_SCHEMA,
  buildSecondaryContentMessages,
  normalizeSecondaryContentResult,
} = require('./tasks/secondaryContentTask.js');
const {
  API_ENDPOINT,
  SECONDARY_SPAM_API_KEY,
  SECONDARY_SPAM_API_KEY_BACKUP,
  SECONDARY_SPAM_PROVIDER,
  OPENROUTER_API_KEY,
  OPENROUTER_SECONDARY_MODEL,
} = require('../../../config/config.js');

function compact(values) {
  return values.filter((value) => typeof value === 'string' && value.trim());
}

function stringifyResponseContent(value) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function buildProviderErrorDetails(error) {
  const providerError = error?.response ? error : (error?.cause || error?.lastError);

  if (!providerError?.response) {
    return error?.message || providerError?.message || 'unknown error';
  }

  const status = providerError.response.status;
  const data = providerError.response.data;
  let details = '';

  if (typeof data === 'string') {
    details = data;
  } else if (data && typeof data === 'object') {
    details = data?.error?.message || data?.message || JSON.stringify(data);
  }

  return `status=${status}${details ? ` body=${details}` : ''}`;
}

function logSecondaryEvaluationSuccess({
  mode,
  provider,
  model,
  userId,
  hasImage,
  rawContent,
  parsedResult,
  usage,
  responseMode,
}) {
  logger.info('Secondary content API response', {
    aiTask: 'secondary_content',
    mode,
    provider,
    model,
    userId: String(userId),
    hasImage,
    responseMode,
    responseContent: stringifyResponseContent(rawContent),
    responseParsed: parsedResult,
    usage,
  });
}

function logSecondaryEvaluationFailure({
  mode,
  provider,
  model,
  userId,
  hasImage,
  error,
  responseMode,
}) {
  logger.warn('Secondary content evaluation failed', {
    aiTask: 'secondary_content',
    mode,
    provider,
    model,
    userId: String(userId),
    hasImage,
    responseMode,
    errorDetails: buildProviderErrorDetails(error),
  });
}

function makeLegacyClients() {
  return compact([SECONDARY_SPAM_API_KEY, SECONDARY_SPAM_API_KEY_BACKUP]).map(
    (apiKey) => new EchanApiClient(apiKey, API_ENDPOINT)
  );
}

function makeOpenRouterClients() {
  return compact([OPENROUTER_API_KEY]).map(
    (apiKey) => new OpenRouterClient(apiKey, buildOpenRouterClientOptions())
  );
}

const LEGACY_CLIENTS = makeLegacyClients();
const OPENROUTER_CLIENTS = makeOpenRouterClients();

function resolveProviderName() {
  const configured = String(SECONDARY_SPAM_PROVIDER || '').trim().toLowerCase();

  if (configured === 'openrouter') {
    if (OPENROUTER_CLIENTS.length > 0) return 'openrouter';
    if (LEGACY_CLIENTS.length > 0) return 'legacy';
    throw new Error('Secondary spam provider is set to openrouter but no OpenRouter key is configured');
  }

  if (configured === 'legacy' || configured === 'dify') {
    if (LEGACY_CLIENTS.length > 0) return 'legacy';
    if (OPENROUTER_CLIENTS.length > 0) return 'openrouter';
    throw new Error('Secondary spam provider is set to legacy but no legacy key is configured');
  }

  if (OPENROUTER_CLIENTS.length > 0) return 'openrouter';
  if (LEGACY_CLIENTS.length > 0) return 'legacy';

  throw new Error('No secondary spam provider configured');
}

async function evaluateWithLegacy({ query, userId, imageUrls, mode }) {
  return withKeyRotation(
    LEGACY_CLIENTS,
    async (client) => {
      const effectiveQuery = mode === 'avatar_compare'
        ? (query || 'Compare these two avatar images. Return spam=false unless the images themselves are obvious spam, and set similar_avatar based on whether they match.')
        : query;
      const data = imageUrls && imageUrls.length > 0
        ? await client.sendImageRequest(imageUrls, effectiveQuery, userId)
        : await client.sendTextRequest(effectiveQuery, userId);
      const normalized = normalizeSecondaryContentResult(data?.answer);
      logSecondaryEvaluationSuccess({
        mode,
        provider: 'legacy',
        model: 'dify-managed',
        userId,
        hasImage: Boolean(imageUrls && imageUrls.length > 0),
        rawContent: data?.answer,
        parsedResult: normalized,
      });
      return normalized;
    }
  );
}

async function evaluateWithOpenRouter({ query, userId, imageUrls, mode }) {
  const hasImage = Boolean(imageUrls && imageUrls.length > 0);
  const model = OPENROUTER_SECONDARY_MODEL;
  const providerOptions = buildOpenRouterProviderOptions();
  const messages = buildSecondaryContentMessages({ query, imageUrls, mode });

  return withKeyRotation(
    OPENROUTER_CLIENTS,
    async (client) => {
      try {
        const response = await client.createStructuredOutput({
          model,
          messages,
          schema: SECONDARY_CONTENT_JSON_SCHEMA,
          schemaName: 'evaluate_content',
          temperature: 0,
          provider: providerOptions,
        });
        const normalized = normalizeSecondaryContentResult(response.content);
        logSecondaryEvaluationSuccess({
          mode,
          provider: 'openrouter',
          model,
          userId,
          hasImage,
          responseMode: 'structured_output',
          rawContent: response.content,
          parsedResult: normalized,
          usage: response.usage,
        });
        return normalized;
      } catch (error) {
        const status = error?.response?.status;
        const shouldFallbackToPlainJson = hasImage && status === 400;
        if (!shouldFallbackToPlainJson) {
          throw error;
        }

        logger.warn('Structured-output secondary image evaluation rejected by provider, retrying with plain JSON mode', {
          aiTask: 'secondary_content',
          mode,
          provider: 'openrouter',
          model,
          userId: String(userId),
          hasImage,
          errorDetails: buildProviderErrorDetails(error),
        });

        const fallbackMessages = buildSecondaryContentMessages({
          query,
          imageUrls,
          mode,
          compatibilityMode: true,
        });
        const fallbackResponse = await client.createTextCompletion({
          model,
          messages: fallbackMessages,
          temperature: 0,
          provider: providerOptions,
        });
        const normalized = normalizeSecondaryContentResult(fallbackResponse.content);
        logSecondaryEvaluationSuccess({
          mode,
          provider: 'openrouter',
          model,
          userId,
          hasImage,
          responseMode: 'plain_json_fallback',
          rawContent: fallbackResponse.content,
          parsedResult: normalized,
          usage: fallbackResponse.usage,
        });
        return normalized;
      }
    },
    {
      switchOnStatuses: [400, 401, 402, 403, 422, 429],
    }
  );
}

async function evaluateSecondaryContent({ query = '', userId, imageUrls = [], mode = 'spam_check' }) {
  const providerName = resolveProviderName();
  if (providerName === 'openrouter') {
    return evaluateWithOpenRouter({ query, userId, imageUrls, mode });
  }
  return evaluateWithLegacy({ query, userId, imageUrls, mode });
}

async function safelyEvaluateSecondaryContent({ query = '', userId, imageUrls = [], mode = 'spam_check' }) {
  const providerName = resolveProviderName();
  const model = providerName === 'openrouter' ? OPENROUTER_SECONDARY_MODEL : 'dify-managed';

  try {
    const result = await evaluateSecondaryContent({ query, userId, imageUrls, mode });
    logger.info(`Secondary content evaluation successful via ${providerName}`, {
      aiTask: 'secondary_content',
      mode,
      provider: providerName,
      model,
      userId: String(userId),
      hasImage: Boolean(imageUrls && imageUrls.length > 0),
    });
    return result;
  } catch (error) {
    logSecondaryEvaluationFailure({
      mode,
      provider: providerName,
      model,
      userId,
      hasImage: Boolean(imageUrls && imageUrls.length > 0),
      error,
      responseMode: 'secondary_evaluation',
    });
    return null;
  }
}

module.exports = {
  evaluateSecondaryContent,
  safelyEvaluateSecondaryContent,
};
