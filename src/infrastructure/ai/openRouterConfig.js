const {
  OPENROUTER_BASE_URL,
  OPENROUTER_HTTP_REFERER,
  OPENROUTER_APP_TITLE,
  OPENROUTER_TIMEOUT_MS,
  OPENROUTER_TELEGRAM_IMAGE_MODE,
  OPENROUTER_PROVIDER_ORDER,
  OPENROUTER_PROVIDER_ONLY,
  OPENROUTER_PROVIDER_IGNORE,
  OPENROUTER_PROVIDER_ALLOW_FALLBACKS,
  OPENROUTER_PROVIDER_SORT,
  OPENROUTER_PROVIDER_ZDR,
} = require('../../../config/config.js');

function buildOpenRouterClientOptions() {
  return {
    baseUrl: OPENROUTER_BASE_URL,
    httpReferer: OPENROUTER_HTTP_REFERER,
    appTitle: OPENROUTER_APP_TITLE,
    timeoutMs: OPENROUTER_TIMEOUT_MS,
    telegramImageMode: OPENROUTER_TELEGRAM_IMAGE_MODE,
  };
}

function buildOpenRouterProviderOptions() {
  const provider = {
    require_parameters: true,
  };

  if (Array.isArray(OPENROUTER_PROVIDER_ORDER) && OPENROUTER_PROVIDER_ORDER.length > 0) {
    provider.order = OPENROUTER_PROVIDER_ORDER;
  }

  if (Array.isArray(OPENROUTER_PROVIDER_ONLY) && OPENROUTER_PROVIDER_ONLY.length > 0) {
    provider.only = OPENROUTER_PROVIDER_ONLY;
  }

  if (Array.isArray(OPENROUTER_PROVIDER_IGNORE) && OPENROUTER_PROVIDER_IGNORE.length > 0) {
    provider.ignore = OPENROUTER_PROVIDER_IGNORE;
  }

  if (typeof OPENROUTER_PROVIDER_ALLOW_FALLBACKS === 'boolean') {
    provider.allow_fallbacks = OPENROUTER_PROVIDER_ALLOW_FALLBACKS;
  }

  if (typeof OPENROUTER_PROVIDER_ZDR === 'boolean') {
    provider.zdr = OPENROUTER_PROVIDER_ZDR;
  }

  if (typeof OPENROUTER_PROVIDER_SORT === 'string' && OPENROUTER_PROVIDER_SORT.trim()) {
    provider.sort = OPENROUTER_PROVIDER_SORT.trim();
  }

  return provider;
}

module.exports = {
  buildOpenRouterClientOptions,
  buildOpenRouterProviderOptions,
};
