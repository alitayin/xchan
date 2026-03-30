import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { processGroupMessage, buildCombinedAnalysisQuery } = require('../../../src/application/usecases/spamHandler.js');

describe('spamHandler module exports', () => {
    it('exports processGroupMessage', () => {
        expect(typeof processGroupMessage).toBe('function');
    });
    it('exports buildCombinedAnalysisQuery', () => {
        expect(typeof buildCombinedAnalysisQuery).toBe('function');
    });
});

describe('buildCombinedAnalysisQuery', () => {
    it('returns plain text message content', () => {
        const msg = { text: 'buy crypto now', from: { first_name: 'Bob', last_name: '' } };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('buy crypto now');
    });

    it('falls back to caption when no text', () => {
        const msg = { caption: 'photo caption', from: { first_name: 'A', last_name: '' } };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('photo caption');
    });

    it('includes [Forwarded from] prefix for forwarded messages', () => {
        const msg = {
            text: 'forwarded text',
            forward_from: { username: 'spammer' },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Forwarded from @spammer]');
    });

    it('includes poll question', () => {
        const msg = {
            poll: { question: 'Win free XEC?', options: [{ text: 'Yes' }, { text: 'No' }] },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Poll]: Win free XEC?');
        expect(result).toContain('Yes | No');
    });

    it('includes contact info', () => {
        const msg = {
            contact: { first_name: 'Eve', last_name: 'Smith', phone_number: '+1234' },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Contact]: Eve Smith +1234');
    });

    it('includes location coordinates', () => {
        const msg = {
            location: { latitude: 1.23, longitude: 4.56 },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Location]: 1.23, 4.56');
    });

    it('includes inline keyboard button text', () => {
        const msg = {
            text: 'click me',
            reply_markup: { inline_keyboard: [[{ text: 'Claim reward', url: 'http://spam.com' }]] },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Button]: Claim reward');
    });

    it('includes channel name for channel messages', () => {
        const msg = {
            text: 'channel post',
            sender_chat: { title: 'Crypto Pump Channel' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Channel]: Crypto Pump Channel');
    });

    it('includes quoted text', () => {
        const msg = {
            text: 'reply',
            quote: { text: 'original message' },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Quoted]: original message');
    });

    it('returns empty string for empty message', () => {
        const result = buildCombinedAnalysisQuery({});
        expect(typeof result).toBe('string');
    });

    it('returns empty string for null input', () => {
        const result = buildCombinedAnalysisQuery(null);
        expect(result).toBe('');
    });
});
