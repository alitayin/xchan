import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);

const {
    buildMessageAnalysisMessages,
    normalizeMessageAnalysisResult,
} = require('../../../src/infrastructure/ai/tasks/messageAnalysisTask.js');

describe('messageAnalysisTask', () => {
    it('builds text-only messages without image parts', () => {
        const messages = buildMessageAnalysisMessages('hello world');
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
        expect(typeof messages[1].content).toBe('string');
        expect(messages[1].content).toContain('hello world');
    });

    it('builds multimodal messages when image URLs are provided', () => {
        const messages = buildMessageAnalysisMessages('inspect this', ['https://example.com/a.png']);
        expect(Array.isArray(messages[1].content)).toBe(true);
        expect(messages[1].content[0]).toMatchObject({ type: 'text' });
        expect(messages[1].content[1]).toEqual({
            type: 'image_url',
            image_url: { url: 'https://example.com/a.png' },
        });
    });

    it('includes explicit schema instructions in compatibility mode', () => {
        const messages = buildMessageAnalysisMessages('inspect this', ['https://example.com/a.png'], {
            compatibilityMode: true,
        });
        expect(messages[1].content[0].text).toContain('Return exactly one JSON object');
        expect(messages[1].content[0].text).toContain('"required"');
    });

    it('normalizes valid JSON string payloads', () => {
        const normalized = normalizeMessageAnalysisResult(JSON.stringify({
            deviation: 0,
            suspicion: 0,
            inducement: 0,
            spam: false,
            is_english: true,
            is_help: false,
            needs_response: true,
            needs_tool: false,
            wants_latest_data: false,
        }));

        expect(normalized).toEqual({
            deviation: 0,
            suspicion: 0,
            inducement: 0,
            spam: false,
            is_english: true,
            is_help: false,
            needs_response: true,
            needs_tool: false,
            wants_latest_data: false,
        });
    });

    it('rejects payloads missing required fields', () => {
        expect(() => normalizeMessageAnalysisResult('{"deviation":0}')).toThrow('Invalid numeric field');
    });
});
