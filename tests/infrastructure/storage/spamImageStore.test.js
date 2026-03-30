import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spamImageCache, clearSpamImageCache, getAllSpamImageHashes } =
    require('../../../src/infrastructure/storage/spamImageStore.js');

beforeEach(() => {
    clearSpamImageCache();
});

describe('spamImageCache', () => {
    it('starts empty', () => {
        expect(spamImageCache.size()).toBe(0);
    });

    it('adds an image entry', () => {
        spamImageCache.add({
            hash: 'deadbeef01234567',
            fileId: 'file1',
            userId: 1,
            metadata: {},
            addedAt: Date.now(),
            imageSize: 1024,
            imageData: null,
        });
        expect(spamImageCache.size()).toBe(1);
    });

    it('respects maxSize by evicting oldest entry', () => {
        const original = spamImageCache.maxSize;
        spamImageCache.maxSize = 2;
        for (let i = 0; i < 3; i++) {
            spamImageCache.add({
                hash: `hash${i}`,
                fileId: `file${i}`,
                userId: i,
                metadata: {},
                addedAt: Date.now(),
                imageSize: 100,
                imageData: null,
            });
        }
        expect(spamImageCache.size()).toBe(2);
        spamImageCache.maxSize = original;
    });

    it('clear() empties the cache', () => {
        spamImageCache.add({
            hash: 'abc', fileId: 'f1', userId: 1,
            metadata: {}, addedAt: Date.now(), imageSize: 0, imageData: null,
        });
        clearSpamImageCache();
        expect(spamImageCache.size()).toBe(0);
    });
});

describe('getAllSpamImageHashes', () => {
    it('returns empty array when cache is empty', async () => {
        const hashes = await getAllSpamImageHashes();
        expect(hashes).toEqual([]);
    });

    it('returns hash entries for cached images', async () => {
        spamImageCache.add({
            hash: 'abc123',
            fileId: 'f1',
            userId: 42,
            metadata: {},
            addedAt: Date.now(),
            imageSize: 500,
            imageData: null,
        });
        const hashes = await getAllSpamImageHashes();
        expect(hashes).toHaveLength(1);
        expect(hashes[0].hash).toBe('abc123');
        expect(hashes[0].userId).toBe(42);
    });
});
