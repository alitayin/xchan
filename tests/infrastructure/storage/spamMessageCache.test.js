import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spamMessageCache, isSimilarToSpam, addSpamMessage } =
    require('../../../src/infrastructure/storage/spamMessageCache.js');

beforeEach(() => {
    spamMessageCache.clear();
});

describe('spamMessageCache', () => {
    it('starts empty', () => {
        expect(spamMessageCache.size()).toBe(0);
    });

    it('adds a message and increases size', () => {
        spamMessageCache.add('spam content');
        expect(spamMessageCache.size()).toBe(1);
    });

    it('respects maxSize by evicting oldest entry', () => {
        const original = spamMessageCache.maxSize;
        spamMessageCache.maxSize = 3;
        spamMessageCache.add('a');
        spamMessageCache.add('b');
        spamMessageCache.add('c');
        spamMessageCache.add('d');
        expect(spamMessageCache.size()).toBe(3);
        spamMessageCache.maxSize = original;
    });

    it('getAll() filters out messages older than 24h', () => {
        vi.useFakeTimers();
        spamMessageCache.add('old message');
        vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
        spamMessageCache.add('new message');
        const all = spamMessageCache.getAll();
        vi.useRealTimers();
        expect(all).not.toContain('old message');
        expect(all).toContain('new message');
    });

    it('clear() empties the cache', () => {
        spamMessageCache.add('msg');
        spamMessageCache.clear();
        expect(spamMessageCache.size()).toBe(0);
    });
});

describe('addSpamMessage', () => {
    it('adds non-empty message to cache', () => {
        addSpamMessage('buy crypto now');
        expect(spamMessageCache.size()).toBe(1);
    });

    it('ignores empty string', () => {
        addSpamMessage('');
        expect(spamMessageCache.size()).toBe(0);
    });

    it('ignores whitespace-only string', () => {
        addSpamMessage('   ');
        expect(spamMessageCache.size()).toBe(0);
    });

    it('ignores null/undefined', () => {
        addSpamMessage(null);
        addSpamMessage(undefined);
        expect(spamMessageCache.size()).toBe(0);
    });
});

describe('isSimilarToSpam', () => {
    it('returns false when cache is empty', () => {
        expect(isSimilarToSpam('some message')).toBe(false);
    });

    it('returns true for exact duplicate message', () => {
        const spam = 'Click here to win free XEC tokens now!';
        addSpamMessage(spam);
        expect(isSimilarToSpam(spam, 95)).toBe(true);
    });

    it('returns true for nearly identical message', () => {
        addSpamMessage('Click here to win free XEC tokens now!');
        // One word changed — still very similar
        expect(isSimilarToSpam('Click here to win free XEC tokens today!', 80)).toBe(true);
    });

    it('returns false for clearly different message', () => {
        addSpamMessage('buy cheap crypto investment guaranteed returns');
        expect(isSimilarToSpam('hello how are you doing today', 95)).toBe(false);
    });

    it('skips length pre-filter correctly — short vs long', () => {
        addSpamMessage('abc');
        // 'abcdefghijklmnopqrstuvwxyz' is much longer → pre-filter skips similarity check
        expect(isSimilarToSpam('abcdefghijklmnopqrstuvwxyz', 95)).toBe(false);
    });
});
