import { describe, it, expect } from 'vitest';
import {
    calculateSpamScore,
    isSpamMessage,
    decideDisciplinaryAction,
    decideSecondarySpamCheck,
    containsRelevantKeywords,
} from '../../../src/domain/policies/spamPolicy.js';

describe('calculateSpamScore', () => {
    it('sums deviation + suspicion + inducement', () => {
        expect(calculateSpamScore({ deviation: 2, suspicion: 3, inducement: 1 })).toBe(6);
    });
    it('returns 0 when all measures are 0', () => {
        expect(calculateSpamScore({ deviation: 0, suspicion: 0, inducement: 0 })).toBe(0);
    });
    it('handles undefined input gracefully', () => {
        expect(calculateSpamScore(undefined)).toBe(0);
        expect(calculateSpamScore({})).toBe(0);
    });
    it('coerces string numbers', () => {
        expect(calculateSpamScore({ deviation: '1', suspicion: '2', inducement: '3' })).toBe(6);
    });
});

describe('containsRelevantKeywords', () => {
    it('returns true when keyword present (case-insensitive)', () => {
        expect(containsRelevantKeywords('Buy XEC now!', ['xec'])).toBe(true);
    });
    it('returns false when no keyword matches', () => {
        expect(containsRelevantKeywords('hello world', ['xec', 'ecash'])).toBe(false);
    });
    it('returns false for empty keywords array', () => {
        expect(containsRelevantKeywords('Buy XEC', [])).toBe(false);
    });
    it('handles null/undefined text gracefully', () => {
        expect(containsRelevantKeywords(null, ['xec'])).toBe(false);
        expect(containsRelevantKeywords(undefined, ['xec'])).toBe(false);
    });
});

describe('isSpamMessage', () => {
    const base = {
        spamFlag: true,
        deviation: 3,
        suspicion: 3,
        inducement: 3,
        spamThreshold: 5,
        query: 'buy crypto now get rich quick',
        relevantKeywords: ['xec'],
        minWordCount: 1,
    };

    it('returns true when all spam conditions met', () => {
        expect(isSpamMessage(base)).toBe(true);
    });
    it('returns false when spamFlag is false', () => {
        expect(isSpamMessage({ ...base, spamFlag: false })).toBe(false);
    });
    it('returns false when score <= threshold', () => {
        expect(isSpamMessage({ ...base, deviation: 1, suspicion: 1, inducement: 1 })).toBe(false);
    });
    it('returns false when query contains relevant keyword', () => {
        expect(isSpamMessage({ ...base, query: 'buy xec now' })).toBe(false);
    });
    it('returns false when word count below minimum', () => {
        expect(isSpamMessage({ ...base, query: 'buy', minWordCount: 3 })).toBe(false);
    });
    it('returns false for empty query', () => {
        expect(isSpamMessage({ ...base, query: '' })).toBe(false);
    });
    it('handles undefined params gracefully', () => {
        expect(isSpamMessage(undefined)).toBe(false);
        expect(isSpamMessage({})).toBe(false);
    });
});

describe('decideDisciplinaryAction', () => {
    it('returns warn on first offense', () => {
        expect(decideDisciplinaryAction({ currentSpamCountInWindow: 1 })).toBe('warn');
    });
    it('returns kick on second offense', () => {
        expect(decideDisciplinaryAction({ currentSpamCountInWindow: 2 })).toBe('kick');
    });
    it('returns kick on higher counts', () => {
        expect(decideDisciplinaryAction({ currentSpamCountInWindow: 5 })).toBe('kick');
    });
    it('handles undefined gracefully (count=0 → kick)', () => {
        expect(decideDisciplinaryAction(undefined)).toBe('kick');
    });
});

describe('decideSecondarySpamCheck', () => {
    it('returns true when primary is spam', () => {
        expect(decideSecondarySpamCheck(true)).toBe(true);
    });
    it('returns false when primary is not spam', () => {
        expect(decideSecondarySpamCheck(false)).toBe(false);
    });
});
