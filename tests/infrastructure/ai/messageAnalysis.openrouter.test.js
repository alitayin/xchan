import { createRequire } from 'module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

const state = vi.hoisted(() => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        axiomOnly: vi.fn(),
    },
}));

vi.mock('../../../config/config.js', () => ({
    API_ENDPOINT: 'https://legacy.example/chat-messages',
    ADDITIONAL_API_KEY: '',
    ADDITIONAL_API_KEY_BACKUP: '',
    MESSAGE_ANALYSIS_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'or-key',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_ANALYSIS_MODEL: 'openai/gpt-4.1-mini',
    OPENROUTER_HTTP_REFERER: '',
    OPENROUTER_APP_TITLE: 'xecbot-tests',
    OPENROUTER_TIMEOUT_MS: 60000,
}));

vi.mock('../../../src/utils/logger.js', () => state.logger);

const require = createRequire(import.meta.url);
const axios = require('axios');
const { fetchMessageAnalysisWithImage } = require('../../../src/infrastructure/ai/messageAnalysis.js');

describe('messageAnalysis OpenRouter image fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('falls back to plain JSON mode on image structured-output provider rejection', async () => {
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
                            content: '{"deviation":0,"suspicion":0,"inducement":0,"spam":false,"is_english":true,"is_help":false,"needs_response":false,"needs_tool":false,"wants_latest_data":false}',
                        },
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20 },
                },
            });

        const result = await fetchMessageAnalysisWithImage(
            'Analyze this image for spam content',
            ['https://example.com/image.jpg'],
            '12345'
        );

        expect(result).toEqual({
            deviation: 0,
            suspicion: 0,
            inducement: 0,
            spam: false,
            is_english: true,
            is_help: false,
            needs_response: false,
            needs_tool: false,
            wants_latest_data: false,
        });

        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(axios.post.mock.calls[0][1].response_format).toBeDefined();
        expect(axios.post.mock.calls[1][1].response_format).toBeUndefined();
    });
});
