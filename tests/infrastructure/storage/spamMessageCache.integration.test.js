import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spamMessageCache, isSimilarToSpam, addSpamMessage } =
    require('../../../src/infrastructure/storage/spamMessageCache.js');

beforeEach(() => {
    spamMessageCache.clear();
});

describe('spamMessageCache – integration: capacity boundary', () => {
    it('evicts oldest when capacity is exceeded', () => {
        const original = spamMessageCache.maxSize;
        spamMessageCache.maxSize = 5;

        for (let i = 0; i < 7; i++) {
            spamMessageCache.add(`message_${i}`);
        }

        const all = spamMessageCache.getAll();
        expect(all.length).toBe(5);
        // Oldest two (message_0, message_1) must be gone
        expect(all).not.toContain('message_0');
        expect(all).not.toContain('message_1');
        // Newest must be present
        expect(all).toContain('message_6');

        spamMessageCache.maxSize = original;
    });

    it('accepts exactly maxSize messages without eviction', () => {
        const original = spamMessageCache.maxSize;
        spamMessageCache.maxSize = 4;
        for (let i = 0; i < 4; i++) spamMessageCache.add(`msg_${i}`);
        expect(spamMessageCache.size()).toBe(4);
        spamMessageCache.maxSize = original;
    });
});

describe('spamMessageCache – integration: TTL expiry via fake timers', () => {
    it('getAll() drops messages older than 24 h and keeps newer ones', () => {
        vi.useFakeTimers();

        spamMessageCache.add('old_1');
        spamMessageCache.add('old_2');

        vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000); // 24h + 1s

        spamMessageCache.add('new_1');
        spamMessageCache.add('new_2');

        const all = spamMessageCache.getAll();
        vi.useRealTimers();

        expect(all).not.toContain('old_1');
        expect(all).not.toContain('old_2');
        expect(all).toContain('new_1');
        expect(all).toContain('new_2');
    });

    it('message added exactly at 24h boundary is treated as expired', () => {
        vi.useFakeTimers();
        spamMessageCache.add('boundary_msg');
        vi.advanceTimersByTime(24 * 60 * 60 * 1000); // exactly 24h
        const all = spamMessageCache.getAll();
        vi.useRealTimers();
        expect(all).not.toContain('boundary_msg');
    });

    it('size() counts raw array length (does not auto-expire)', () => {
        vi.useFakeTimers();
        spamMessageCache.add('stale');
        vi.advanceTimersByTime(25 * 60 * 60 * 1000);
        // size() is a raw count — expiry only happens in getAll()
        const rawSize = spamMessageCache.size();
        expect(rawSize).toBe(1);
        vi.useRealTimers();
    });
});

describe('spamMessageCache – integration: isSimilarToSpam under load', () => {
    it('detects duplicate across 100 cached messages', () => {
        const target = 'Win free XEC tokens by clicking this link immediately!';
        for (let i = 0; i < 99; i++) {
            addSpamMessage(`filler message number ${i} with different content abc def ghi`);
        }
        addSpamMessage(target);
        expect(isSimilarToSpam(target, 95)).toBe(true);
    });

    it('length pre-filter prevents false positive for very different lengths', () => {
        addSpamMessage('short');
        // 'short' is 5 chars; this long message is 60+ chars — ratio << 95%
        expect(isSimilarToSpam('short message padded with a lot of extra words to make it very long indeed', 95)).toBe(false);
    });

    it('returns false when cache is empty (no crash)', () => {
        expect(isSimilarToSpam('anything', 95)).toBe(false);
    });

    it('concurrent addSpamMessage calls produce consistent cache size', async () => {
        const promises = Array.from({ length: 50 }, (_, i) =>
            Promise.resolve(addSpamMessage(`concurrent spam message ${i}`))
        );
        await Promise.all(promises);
        // All 50 fit within default maxSize of 1000
        expect(spamMessageCache.size()).toBe(50);
    });
});

describe('spamMessageCache – integration: clear then reuse', () => {
    it('cache is fully operational after clear', () => {
        addSpamMessage('before clear');
        spamMessageCache.clear();
        addSpamMessage('after clear');
        expect(spamMessageCache.size()).toBe(1);
        expect(spamMessageCache.getAll()).toContain('after clear');
    });

    it('isSimilarToSpam after clear does not match pre-clear data', () => {
        const spam = 'pre-clear spam content XYZ';
        addSpamMessage(spam);
        spamMessageCache.clear();
        expect(isSimilarToSpam(spam, 95)).toBe(false);
    });
});
