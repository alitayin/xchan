import { createRequire } from 'module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
    safelyEvaluateSecondaryContent: vi.fn(),
};

const require = createRequire(import.meta.url);
const evaluatorPath = require.resolve('../../../src/infrastructure/ai/secondaryContentEvaluator.js');
const secondarySpamPath = require.resolve('../../../src/infrastructure/ai/secondarySpamCheck.js');
const avatarComparisonPath = require.resolve('../../../src/infrastructure/ai/avatarComparison.js');

function installEvaluatorStub() {
    delete require.cache[evaluatorPath];
    require.cache[evaluatorPath] = {
        id: evaluatorPath,
        filename: evaluatorPath,
        loaded: true,
        exports: {
            safelyEvaluateSecondaryContent: state.safelyEvaluateSecondaryContent,
        },
    };
    delete require.cache[secondarySpamPath];
    delete require.cache[avatarComparisonPath];
}

describe('secondary content wrappers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        installEvaluatorStub();
    });

    it('maps evaluator spam result to boolean for secondary spam checks', async () => {
        state.safelyEvaluateSecondaryContent.mockResolvedValue({
            spam: true,
            similar_avatar: false,
        });

        const { performSecondarySpamCheck } = require(secondarySpamPath);
        const result = await performSecondarySpamCheck(
            'DM me to buy USDT',
            101,
            'https://example.com/message.jpg'
        );

        expect(result).toBe(true);
        expect(state.safelyEvaluateSecondaryContent).toHaveBeenCalledWith({
            query: 'DM me to buy USDT',
            userId: 101,
            imageUrls: ['https://example.com/message.jpg'],
            mode: 'spam_check',
        });
    });

    it('returns false when secondary spam evaluation fails or is non-spam', async () => {
        const { performSecondarySpamCheck } = require(secondarySpamPath);

        state.safelyEvaluateSecondaryContent.mockResolvedValueOnce(null);
        await expect(performSecondarySpamCheck('hello', 202)).resolves.toBe(false);

        state.safelyEvaluateSecondaryContent.mockResolvedValueOnce({
            spam: false,
            similar_avatar: false,
        });
        await expect(performSecondarySpamCheck('hello again', 202)).resolves.toBe(false);
    });

    it('only accepts avatar matches when similar_avatar is true and spam is false', async () => {
        const { compareAvatars } = require(avatarComparisonPath);

        state.safelyEvaluateSecondaryContent.mockResolvedValueOnce({
            spam: false,
            similar_avatar: true,
        });

        await expect(
            compareAvatars('https://example.com/user.png', 'https://example.com/admin.png', 303)
        ).resolves.toBe(true);

        expect(state.safelyEvaluateSecondaryContent).toHaveBeenCalledWith({
            query: 'Compare these two avatar images and determine whether they are the same avatar or person.',
            userId: 303,
            imageUrls: ['https://example.com/user.png', 'https://example.com/admin.png'],
            mode: 'avatar_compare',
        });

        state.safelyEvaluateSecondaryContent.mockResolvedValueOnce({
            spam: true,
            similar_avatar: true,
        });

        await expect(
            compareAvatars('https://example.com/user.png', 'https://example.com/admin.png', 303)
        ).resolves.toBe(false);
    });
});
