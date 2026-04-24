import { createRequire } from 'module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

vi.mock('../../../config/config.js', () => ({
    API_ENDPOINT: 'https://legacy.example/chat-messages',
    SECONDARY_SPAM_API_KEY: '',
    SECONDARY_SPAM_API_KEY_BACKUP: '',
    SECONDARY_SPAM_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'or-key',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_SECONDARY_MODEL: 'openai/gpt-5.1',
    OPENROUTER_HTTP_REFERER: '',
    OPENROUTER_APP_TITLE: 'xecbot-tests',
    OPENROUTER_TIMEOUT_MS: 60000,
    OPENROUTER_TELEGRAM_IMAGE_MODE: 'remote_url',
    OPENROUTER_PROVIDER_ORDER: [],
    OPENROUTER_PROVIDER_ONLY: [],
    OPENROUTER_PROVIDER_IGNORE: [],
    OPENROUTER_PROVIDER_ALLOW_FALLBACKS: undefined,
    OPENROUTER_PROVIDER_SORT: '',
    OPENROUTER_PROVIDER_ZDR: undefined,
}));

const require = createRequire(import.meta.url);
const axios = require('axios');
const {
    safelyEvaluateSecondaryContent,
} = require('../../../src/infrastructure/ai/secondaryContentEvaluator.js');

describe('secondaryContentEvaluator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
