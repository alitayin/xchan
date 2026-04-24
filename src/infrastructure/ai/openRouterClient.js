const axios = require('axios');

class OpenRouterClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = String(options.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    this.httpReferer = options.httpReferer || '';
    this.appTitle = options.appTitle || '';
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 60 * 1000;
    this.telegramImageMode = options.telegramImageMode === 'data_url' ? 'data_url' : 'remote_url';
  }

  get defaultHeaders() {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.httpReferer) {
      headers['HTTP-Referer'] = this.httpReferer;
    }

    if (this.appTitle) {
      headers['X-Title'] = this.appTitle;
    }

    return headers;
  }

  async createStructuredOutput({ model, messages, schema, schemaName, temperature = 0, provider, maxTokens }) {
    return this._createChatCompletion({
      model,
      messages,
      temperature,
      provider,
      maxTokens,
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      },
    });
  }

  async createTextCompletion({ model, messages, temperature = 0, provider, maxTokens }) {
    return this._createChatCompletion({
      model,
      messages,
      temperature,
      provider,
      maxTokens,
    });
  }

  async _createChatCompletion({ model, messages, temperature = 0, provider, maxTokens, responseFormat }) {
    const preparedMessages = await this._prepareMessages(messages);
    const payload = {
      model,
      messages: preparedMessages,
      temperature,
    };

    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    if (provider && typeof provider === 'object' && Object.keys(provider).length > 0) {
      payload.provider = provider;
    }

    if (Number.isFinite(maxTokens)) {
      payload.max_tokens = maxTokens;
    }

    const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
      headers: this.defaultHeaders,
      timeout: this.timeoutMs,
    });

    const message = response?.data?.choices?.[0]?.message;
    const content = this._extractTextContent(message?.content);

    if (!content) {
      throw new Error('OpenRouter response missing content');
    }

    return {
      content,
      usage: response?.data?.usage,
      raw: response?.data,
    };
  }

  async _prepareMessages(messages) {
    const preparedMessages = [];
    for (const message of messages || []) {
      preparedMessages.push({
        ...message,
        content: await this._prepareContent(message?.content),
      });
    }
    return preparedMessages;
  }

  async _prepareContent(content) {
    if (typeof content === 'string' || !Array.isArray(content)) {
      return content;
    }

    const preparedParts = [];
    for (const part of content) {
      if (part?.type !== 'image_url') {
        preparedParts.push(part);
        continue;
      }

      preparedParts.push({
        ...part,
        image_url: await this._prepareImageUrl(part.image_url),
      });
    }

    return preparedParts;
  }

  async _prepareImageUrl(imageUrl) {
    const rawUrl = typeof imageUrl === 'string' ? imageUrl : imageUrl?.url;
    if (!rawUrl) {
      return imageUrl;
    }

    if (!this._shouldInlineImage(rawUrl)) {
      return typeof imageUrl === 'string' ? { url: rawUrl } : { ...imageUrl, url: rawUrl };
    }

    if (this.telegramImageMode === 'remote_url') {
      return typeof imageUrl === 'string' ? { url: rawUrl } : { ...imageUrl, url: rawUrl };
    }

    const dataUrl = await this._downloadImageAsDataUrl(rawUrl);
    return { url: dataUrl };
  }

  _shouldInlineImage(imageUrl) {
    return typeof imageUrl === 'string' && imageUrl.includes('api.telegram.org/file/bot');
  }

  async _downloadImageAsDataUrl(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30 * 1000,
    });

    const mimeType = this._resolveMimeType(imageUrl, response?.headers?.['content-type']);
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  _resolveMimeType(imageUrl, headerValue) {
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.split(';')[0].trim();
    }

    const lower = String(imageUrl || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  _extractTextContent(content) {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (!Array.isArray(content)) {
      return '';
    }

    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
}

module.exports = OpenRouterClient;
