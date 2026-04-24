import { createRequire } from 'module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

const require = createRequire(import.meta.url);
const axios = require('axios');
const OpenRouterClient = require('../../../src/infrastructure/ai/openRouterClient.js');

describe('OpenRouterClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends structured-output chat completions with OpenRouter headers', async () => {
        axios.post = vi.fn().mockResolvedValue({
            data: {
                choices: [{ message: { content: '{"ok":true}' } }],
                usage: { prompt_tokens: 12, completion_tokens: 7 },
            },
        });

        const client = new OpenRouterClient('or-key', {
            baseUrl: 'https://openrouter.ai/api/v1',
            httpReferer: 'https://example.com',
            appTitle: 'xecbot-tests',
            timeoutMs: 12345,
        });

        const result = await client.createStructuredOutput({
            model: 'openai/gpt-4.1-mini',
            messages: [{ role: 'user', content: 'hello' }],
            schema: { type: 'object' },
            schemaName: 'message_analysis',
            temperature: 0,
            provider: { require_parameters: true },
        });

        expect(result.content).toBe('{"ok":true}');
        expect(axios.post).toHaveBeenCalledWith(
            'https://openrouter.ai/api/v1/chat/completions',
            expect.objectContaining({
                model: 'openai/gpt-4.1-mini',
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'message_analysis',
                        strict: true,
                        schema: { type: 'object' },
                    },
                },
                provider: { require_parameters: true },
            }),
            expect.objectContaining({
                timeout: 12345,
                headers: expect.objectContaining({
                    Authorization: 'Bearer or-key',
                    'HTTP-Referer': 'https://example.com',
                    'X-Title': 'xecbot-tests',
                }),
            })
        );
    });

    it('inlines Telegram image URLs as data URLs before sending to OpenRouter', async () => {
        axios.get = vi.fn().mockResolvedValue({
            data: Buffer.from('image-bytes'),
            headers: { 'content-type': 'image/png' },
        });
        axios.post = vi.fn().mockResolvedValue({
            data: {
                choices: [{ message: { content: '{"ok":true}' } }],
            },
        });

        const client = new OpenRouterClient('or-key', {
            telegramImageMode: 'data_url',
        });

        await client.createStructuredOutput({
            model: 'openai/gpt-4.1-mini',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'inspect this image' },
                    { type: 'image_url', image_url: { url: 'https://api.telegram.org/file/botSECRET/path/file.jpg' } },
                ],
            }],
            schema: { type: 'object' },
            schemaName: 'message_analysis',
        });

        expect(axios.get).toHaveBeenCalledWith(
            'https://api.telegram.org/file/botSECRET/path/file.jpg',
            expect.objectContaining({
                responseType: 'arraybuffer',
            })
        );

        const payload = axios.post.mock.calls[0][1];
        expect(payload.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
    });

    it('passes Telegram image URLs through directly in remote_url mode', async () => {
        axios.get = vi.fn();
        axios.post = vi.fn().mockResolvedValue({
            data: {
                choices: [{ message: { content: '{"ok":true}' } }],
            },
        });

        const client = new OpenRouterClient('or-key');

        await client.createStructuredOutput({
            model: 'openai/gpt-4.1-mini',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'inspect this image' },
                    { type: 'image_url', image_url: { url: 'https://api.telegram.org/file/botSECRET/path/file.jpg' } },
                ],
            }],
            schema: { type: 'object' },
            schemaName: 'message_analysis',
        });

        expect(axios.get).not.toHaveBeenCalled();
        const payload = axios.post.mock.calls[0][1];
        expect(payload.messages[0].content[1].image_url.url).toBe(
            'https://api.telegram.org/file/botSECRET/path/file.jpg'
        );
    });

    it('supports plain chat completions without response_format', async () => {
        axios.post = vi.fn().mockResolvedValue({
            data: {
                choices: [{ message: { content: '{"ok":true}' } }],
            },
        });

        const client = new OpenRouterClient('or-key');
        await client.createTextCompletion({
            model: 'openai/gpt-4.1-mini',
            messages: [{ role: 'user', content: 'hello' }],
            temperature: 0,
        });

        const payload = axios.post.mock.calls[0][1];
        expect(payload.model).toBe('openai/gpt-4.1-mini');
        expect(payload.messages).toEqual([{ role: 'user', content: 'hello' }]);
        expect(payload.response_format).toBeUndefined();
    });
});
