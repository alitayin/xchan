import { createRequire } from 'module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

const require = createRequire(import.meta.url);
const configPath = require.resolve('../../../config/config.js');
const openRouterConfigPath = require.resolve('../../../src/infrastructure/ai/openRouterConfig.js');
const evaluatorPath = require.resolve('../../../src/infrastructure/ai/secondaryContentEvaluator.js');
const ORIGINAL_ENV = { ...process.env };
let axios;
let safelyEvaluateSecondaryContent;

function restoreEnv() {
    for (const key of Object.keys(process.env)) {
        if (!(key in ORIGINAL_ENV)) {
            delete process.env[key];
        }
    }
    Object.assign(process.env, ORIGINAL_ENV);
}

function prepareOpenRouterEnv() {
    process.env.API_ENDPOINT = 'https://legacy.example/chat-messages';
    process.env.SECONDARY_SPAM_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENROUTER_SECONDARY_MODEL = 'openai/gpt-5.1';
    process.env.OPENROUTER_HTTP_REFERER = '';
    process.env.OPENROUTER_APP_TITLE = 'xecbot-tests';
    process.env.OPENROUTER_TIMEOUT_MS = '60000';
    process.env.OPENROUTER_TELEGRAM_IMAGE_MODE = 'remote_url';
    delete process.env.SECONDARY_SPAM_API_KEY;
    delete process.env.SECONDARY_SPAM_API_KEY_BACKUP;
}

describe('secondaryContentEvaluator', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        restoreEnv();
        prepareOpenRouterEnv();
        delete require.cache[configPath];
        delete require.cache[openRouterConfigPath];
        delete require.cache[evaluatorPath];
        axios = require('axios');
        ({
            safelyEvaluateSecondaryContent,
        } = require(evaluatorPath));
    });

    afterEach(() => {
        restoreEnv();
    });

    it('uses OpenRouter structured output with the GPT-5.1 secondary model', async () => {
        axios.post = vi.fn().mockResolvedValue({
            data: {
                choices: [{
                    message: {
                        content: '{"spam":true,"similar_avatar":false}',
                    },
                }],
                usage: { prompt_tokens: 18, completion_tokens: 5 },
            },
        });

        const result = await safelyEvaluateSecondaryContent({
            query: 'DM me to trade USDT directly',
            userId: '12345',
            mode: 'spam_check',
        });

        expect(result).toEqual({
            spam: true,
            similar_avatar: false,
        });
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.post.mock.calls[0][1]).toEqual(expect.objectContaining({
            model: 'openai/gpt-5.1',
            response_format: expect.objectContaining({
                type: 'json_schema',
                json_schema: expect.objectContaining({
                    name: 'evaluate_content',
                    strict: true,
                }),
            }),
        }));
        expect(axios.post.mock.calls[0][1].messages[1].content).toContain('DM me to trade USDT directly');
    });

    it('falls back to plain JSON mode for image requests when structured output is rejected', async () => {
        axios.post = vi.fn()
            .mockRejectedValueOnce({
                response: {
                    status: 400,
                    data: { message: 'Provider returned error' },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '{"spam":false,"similar_avatar":true}',
                        },
                    }],
                    usage: { prompt_tokens: 20, completion_tokens: 7 },
                },
            });

        const result = await safelyEvaluateSecondaryContent({
            query: 'Compare the admin avatar and the new user avatar',
            userId: '9988',
            imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
            mode: 'avatar_compare',
        });

        expect(result).toEqual({
            spam: false,
            similar_avatar: true,
        });
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(axios.post.mock.calls[0][1].response_format).toBeDefined();
        expect(axios.post.mock.calls[1][1].response_format).toBeUndefined();
    });
});
