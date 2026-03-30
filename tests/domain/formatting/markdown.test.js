import { describe, it, expect } from 'vitest';
import { escapeMarkdown } from '../../../src/domain/formatting/markdown.js';

describe('escapeMarkdown', () => {
    it('escapes all special Telegram Markdown characters', () => {
        const special = '_*[]()~`>#+\-=|{}.!';
        const escaped = escapeMarkdown(special);
        expect(escaped).not.toMatch(/(?<!\\)[_*[\]()~`>#+\-=|{}.!]/);
    });
    it('leaves plain text unchanged', () => {
        expect(escapeMarkdown('hello world 123')).toBe('hello world 123');
    });
    it('escapes underscores in usernames', () => {
        expect(escapeMarkdown('@user_name')).toBe('@user\\_name');
    });
    it('escapes asterisks', () => {
        expect(escapeMarkdown('bold *text*')).toBe('bold \\*text\\*');
    });
    it('escapes dots', () => {
        expect(escapeMarkdown('v1.2.3')).toBe('v1\\.2\\.3');
    });
    it('escapes parentheses', () => {
        expect(escapeMarkdown('(hello)')).toBe('\\(hello\\)');
    });
    it('handles empty string', () => {
        expect(escapeMarkdown('')).toBe('');
    });
});
