import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
    buildSecondaryContentMessages,
    normalizeSecondaryContentResult,
} = require('../../../src/infrastructure/ai/tasks/secondaryContentTask.js');

describe('secondaryContentTask', () => {
    it('builds text-only spam-check messages', () => {
        const messages = buildSecondaryContentMessages({
            query: 'DM me to trade USDT',
            mode: 'spam_check',
        });
        expect(messages).toHaveLength(2);
        expect(messages[1].content).toContain('Evaluate whether this message or image content is spam');
        expect(messages[1].content).toContain('DM me to trade USDT');
    });

    it('builds multimodal avatar-compare messages', () => {
        const messages = buildSecondaryContentMessages({
            query: 'Compare these avatars',
            imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
            mode: 'avatar_compare',
        });
        expect(Array.isArray(messages[1].content)).toBe(true);
        expect(messages[1].content[0].text).toContain('Compare the two provided avatar images');
        expect(messages[1].content[1].image_url.url).toBe('https://example.com/a.png');
        expect(messages[1].content[2].image_url.url).toBe('https://example.com/b.png');
    });

    it('normalizes strict result payloads', () => {
        const normalized = normalizeSecondaryContentResult('{"spam":false,"similar_avatar":true}');
        expect(normalized).toEqual({
            spam: false,
            similar_avatar: true,
        });
    });

    it('rejects invalid payloads', () => {
        expect(() => normalizeSecondaryContentResult('{"spam":1}')).toThrow('Invalid boolean field');
    });
});
