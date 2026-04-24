import { createRequire } from 'module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

const state = vi.hoisted(() => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        axiomOnly: vi.fn(),
    },
}));

vi.mock('../../../src/utils/logger.js', () => state.logger);

const require = createRequire(import.meta.url);
const configPath = require.resolve('../../../config/config.js');
const openRouterConfigPath = require.resolve('../../../src/infrastructure/ai/openRouterConfig.js');
const messageAnalysisPath = require.resolve('../../../src/infrastructure/ai/messageAnalysis.js');
const ORIGINAL_ENV = { ...process.env };
let axios;
let fetchMessageAnalysisWithImage;

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
    process.env.MESSAGE_ANALYSIS_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENROUTER_ANALYSIS_MODEL = 'openai/gpt-4.1-mini';
    process.env.OPENROUTER_HTTP_REFERER = '';
    process.env.OPENROUTER_APP_TITLE = 'xecbot-tests';
    process.env.OPENROUTER_TIMEOUT_MS = '60000';
    delete process.env.ADDITIONAL_API_KEY;
    delete process.env.ADDITIONAL_API_KEY_BACKUP;
}

describe('messageAnalysis OpenRouter image fallback', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        restoreEnv();
        prepareOpenRouterEnv();
        delete require.cache[configPath];
        delete require.cache[openRouterConfigPath];
        delete require.cache[messageAnalysisPath];
        axios = require('axios');
        ({ fetchMessageAnalysisWithImage } = require(messageAnalysisPath));
    });

    afterEach(() => {
        restoreEnv();
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
