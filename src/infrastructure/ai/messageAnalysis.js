const EchanApiClient = require('./echanApi.js');
const OpenRouterClient = require('./openRouterClient.js');
const { buildOpenRouterClientOptions, buildOpenRouterProviderOptions } = require('./openRouterConfig.js');
const { withKeyRotation } = require('./withKeyRotation.js');
const logger = require('../../utils/logger.js');
const {
  buildMessageAnalysisMessages,
  MESSAGE_ANALYSIS_JSON_SCHEMA,
  normalizeMessageAnalysisResult,
} = require('./tasks/messageAnalysisTask.js');
const {
  API_ENDPOINT,
  ADDITIONAL_API_KEY,
  ADDITIONAL_API_KEY_BACKUP,
  MESSAGE_ANALYSIS_PROVIDER,
  OPENROUTER_API_KEY,
  OPENROUTER_ANALYSIS_MODEL,
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

function logMessageAnalysisSuccess({
  provider,
  model,
  userId,
  hasImage,
  rawContent,
  parsedResult,
  usage,
  responseMode,
}) {
  logger.info('Message analysis API response', {
    aiTask: 'message_analysis',
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

function logMessageAnalysisFailure({
  provider,
  model,
  userId,
  hasImage,
  error,
  responseMode,
}) {
  logger.warn('Message analysis failed, returning null', {
    aiTask: 'message_analysis',
    provider,
    model,
    userId: String(userId),
    hasImage,
    responseMode,
    errorDetails: buildProviderErrorDetails(error),
  });
}

function makeLegacyClients() {
  return compact([ADDITIONAL_API_KEY, ADDITIONAL_API_KEY_BACKUP]).map(
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
  const configured = String(MESSAGE_ANALYSIS_PROVIDER || '').trim().toLowerCase();

  if (configured === 'openrouter') {
    if (OPENROUTER_CLIENTS.length > 0) return 'openrouter';
    if (LEGACY_CLIENTS.length > 0) return 'legacy';
    throw new Error('Message analysis provider is set to openrouter but no OpenRouter key is configured');
  }

  if (configured === 'legacy' || configured === 'dify') {
    if (LEGACY_CLIENTS.length > 0) return 'legacy';
    if (OPENROUTER_CLIENTS.length > 0) return 'openrouter';
    throw new Error('Message analysis provider is set to legacy but no legacy key is configured');
  }

  if (OPENROUTER_CLIENTS.length > 0) return 'openrouter';
  if (LEGACY_CLIENTS.length > 0) return 'legacy';

  throw new Error('No message analysis provider configured');
}

async function analyzeWithLegacy(query, userId, imageUrl) {
  return withKeyRotation(
    LEGACY_CLIENTS,
    async (client) => {
      const data = imageUrl
        ? await client.sendImageRequest(imageUrl, query, userId)
        : await client.sendTextRequest(query, userId);
      const normalized = normalizeMessageAnalysisResult(data?.answer);
      logMessageAnalysisSuccess({
        provider: 'legacy',
        model: 'dify-managed',
        userId,
        hasImage: Boolean(imageUrl),
        rawContent: data?.answer,
        parsedResult: normalized,
      });
      return normalized;
    }
  );
}

async function analyzeWithOpenRouter(query, userId, imageUrl) {
  const hasImage = Boolean(imageUrl);
  const messages = buildMessageAnalysisMessages(query, imageUrl);
  const model = OPENROUTER_ANALYSIS_MODEL;
  const providerOptions = buildOpenRouterProviderOptions();
  return withKeyRotation(
    OPENROUTER_CLIENTS,
    async (client) => {
      try {
        const response = await client.createStructuredOutput({
          model,
          messages,
        schema: MESSAGE_ANALYSIS_JSON_SCHEMA,
        schemaName: 'message_analysis',
        temperature: 0,
        provider: providerOptions,
      });
        const normalized = normalizeMessageAnalysisResult(response.content);
        logMessageAnalysisSuccess({
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

        logger.warn('Structured-output image analysis rejected by provider, retrying with plain JSON mode', {
          aiTask: 'message_analysis',
          provider: 'openrouter',
          model,
          userId: String(userId),
          hasImage,
          errorDetails: buildProviderErrorDetails(error),
        });

        const fallbackMessages = buildMessageAnalysisMessages(query, imageUrl, {
          compatibilityMode: true,
        });
        const fallbackResponse = await client.createTextCompletion({
          model,
          messages: fallbackMessages,
          temperature: 0,
          provider: providerOptions,
        });
        const normalized = normalizeMessageAnalysisResult(fallbackResponse.content);
        logMessageAnalysisSuccess({
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

async function runMessageAnalysis(query, userId, imageUrl = null) {
  const providerName = resolveProviderName();
  if (providerName === 'openrouter') {
    return analyzeWithOpenRouter(query, userId, imageUrl);
  }
  return analyzeWithLegacy(query, userId, imageUrl);
}

/**
 * Get message analysis.
 * @param {string} query
 * @param {string|number} userId
 * @returns {Promise<Object|null>}
 */
async function fetchMessageAnalysis(query, userId) {
  const providerName = resolveProviderName();
  try {
    const answer = await runMessageAnalysis(query, userId);
    logger.info(`Message analysis successful via ${providerName}`, {
      aiTask: 'message_analysis',
      provider: providerName,
      userId: String(userId),
      hasImage: false,
    });
    return answer;
  } catch (error) {
    logMessageAnalysisFailure({
      provider: providerName,
      model: providerName === 'openrouter' ? OPENROUTER_ANALYSIS_MODEL : 'dify-managed',
      userId,
      hasImage: false,
      error,
      responseMode: 'structured_output',
    });
    return null;
  }
}

/**
 * Get message analysis with image support.
 * @param {string} query - text content
 * @param {string|string[]} imageUrl - single image URL or array of image URLs
 * @param {string|number} userId
 * @returns {Promise<Object|null>}
 */
async function fetchMessageAnalysisWithImage(query, imageUrl, userId) {
  const providerName = resolveProviderName();
  const model = providerName === 'openrouter' ? OPENROUTER_ANALYSIS_MODEL : 'dify-managed';
  try {
    const answer = await runMessageAnalysis(query, userId, imageUrl);
    logger.info(`Image message analysis successful via ${providerName}`, {
      aiTask: 'message_analysis',
      provider: providerName,
      model,
      userId: String(userId),
      hasImage: true,
    });
    return answer;
  } catch (error) {
    logMessageAnalysisFailure({
      provider: providerName,
      model,
      userId,
      hasImage: true,
      error,
      responseMode: 'image_analysis',
    });
    return null;
  }
}

/**
 * Batch analyze messages.
 * @param {{query:string,userId:string|number}[]} messages
 * @returns {Promise<Array>}
 */
async function batchMessageAnalysis(messages) {
  const settled = await Promise.allSettled(
    messages.map((message) => fetchMessageAnalysis(message.query, message.userId))
  );
  return settled.map((result, i) => {
    const message = messages[i];
    if (result.status === 'fulfilled') {
      return { ...message, analysis: result.value };
    }
    console.error(`Batch analysis failed - message: ${message.query.substring(0, 50)}...`, result.reason?.message);
    return { ...message, analysis: null, error: result.reason?.message };
  });
}

/**
 * Check if a message needs response.
 * @param {string} query
 * @param {string|number} userId
 * @returns {Promise<boolean>}
 */
async function checkNeedsResponse(query, userId) {
  try {
    const analysis = await fetchMessageAnalysis(query, userId);
    return analysis?.needs_response === true;
  } catch (error) {
    console.error('Failed to check if response needed:', error.message);
    return false;
  }
}

module.exports = {
  fetchMessageAnalysis,
  fetchMessageAnalysisWithImage,
  batchMessageAnalysis,
  checkNeedsResponse,
};
