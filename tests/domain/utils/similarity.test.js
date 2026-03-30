import { describe, it, expect } from 'vitest';
import {
    calculateStringSimilarity,
    calculateTextSimilarity,
    levenshteinDistance,
    tokenize,
} from '../../../src/domain/utils/similarity.js';

describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
        expect(levenshteinDistance('abc', 'abc')).toBe(0);
    });
    it('returns string length for empty vs non-empty', () => {
        expect(levenshteinDistance('', 'abc')).toBe(3);
        expect(levenshteinDistance('abc', '')).toBe(3);
    });
    it('returns 1 for single substitution', () => {
        expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });
    it('returns 1 for single insertion', () => {
        expect(levenshteinDistance('ab', 'abc')).toBe(1);
    });
    it('returns 1 for single deletion', () => {
        expect(levenshteinDistance('abc', 'ab')).toBe(1);
    });
});

describe('calculateStringSimilarity', () => {
    it('returns 100 for identical strings', () => {
        expect(calculateStringSimilarity('hello', 'hello')).toBe(100);
    });
    it('returns 100 for case-insensitive identical strings', () => {
        expect(calculateStringSimilarity('Hello', 'hello')).toBe(100);
    });
    it('returns 0 for completely different strings of same length', () => {
        // 'abc' vs 'xyz' — distance 3, maxLen 3 → 0%
        expect(calculateStringSimilarity('abc', 'xyz')).toBe(0);
    });
    it('returns value between 0 and 100 for partial match', () => {
        const score = calculateStringSimilarity('kitten', 'sitting');
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(100);
    });
    it('handles empty strings', () => {
        expect(calculateStringSimilarity('', '')).toBe(100);
    });
});

describe('calculateTextSimilarity', () => {
    it('returns 100 for identical texts', () => {
        expect(calculateTextSimilarity('buy crypto now', 'buy crypto now')).toBe(100);
    });
    it('returns 0 for completely different texts', () => {
        expect(calculateTextSimilarity('abc', 'xyz')).toBe(0);
    });
    it('returns value between 0 and 100 for similar texts', () => {
        const score = calculateTextSimilarity('buy cheap crypto', 'buy cheap token');
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(100);
    });
    it('returns 100 for two empty strings (both equal)', () => {
        expect(calculateTextSimilarity('', '')).toBe(100);
    });
    it('returns 0 when one side is empty', () => {
        expect(calculateTextSimilarity('hello', '')).toBe(0);
        expect(calculateTextSimilarity('', 'hello')).toBe(0);
    });
});

describe('tokenize', () => {
    it('lowercases and splits on whitespace', () => {
        expect(tokenize('Hello World')).toEqual(['hello', 'world']);
    });
    it('strips punctuation', () => {
        expect(tokenize('hello, world!')).toEqual(['hello', 'world']);
    });
    it('filters empty tokens', () => {
        expect(tokenize('  a  b  ')).toEqual(['a', 'b']);
    });
    it('returns empty array for empty string', () => {
        expect(tokenize('')).toEqual([]);
    });
});
