import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spamImageCache, clearSpamImageCache, getAllSpamImageHashes } =
    require('../../../src/infrastructure/storage/spamImageStore.js');

// Helper: build a minimal image entry
function makeEntry(overrides = {}) {
    return {
        hash: overrides.hash ?? 'deadbeef01234567deadbeef01234567deadbeef01234567deadbeef01234567',
        fileId: overrides.fileId ?? 'file_default',
        userId: overrides.userId ?? 1,
        metadata: overrides.metadata ?? {},
        addedAt: overrides.addedAt ?? Date.now(),
        imageSize: overrides.imageSize ?? 1024,
        imageData: overrides.imageData ?? null,
    };
}

beforeEach(() => {
    clearSpamImageCache();
});

describe('spamImageCache – integration: LRU eviction boundary', () => {
    it('evicts the oldest entry when maxSize is exceeded', () => {
        const original = spamImageCache.maxSize;
        spamImageCache.maxSize = 3;

        for (let i = 0; i < 4; i++) {
            spamImageCache.add(makeEntry({ hash: `hash_${i}`, fileId: `file_${i}`, userId: i }));
        }

        const cached = spamImageCache.getAll();
        expect(cached.length).toBe(3);
        // hash_0 must have been evicted
        expect(cached.find(e => e.hash === 'hash_0')).toBeUndefined();
        // hash_3 must be present
        expect(cached.find(e => e.hash === 'hash_3')).toBeDefined();

        spamImageCache.maxSize = original;
    });

    it('accepts exactly maxSize entries without eviction', () => {
        const original = spamImageCache.maxSize;
        spamImageCache.maxSize = 4;
        for (let i = 0; i < 4; i++) {
            spamImageCache.add(makeEntry({ hash: `h${i}`, fileId: `f${i}`, userId: i }));
        }
        expect(spamImageCache.size()).toBe(4);
        spamImageCache.maxSize = original;
    });

    it('evicts multiple entries when many are added over capacity', () => {
        const original = spamImageCache.maxSize;
        spamImageCache.maxSize = 2;
        for (let i = 0; i < 10; i++) {
            spamImageCache.add(makeEntry({ hash: `bulk_${i}`, fileId: `f${i}`, userId: i }));
        }
        expect(spamImageCache.size()).toBe(2);
        const cached = spamImageCache.getAll();
        expect(cached[0].hash).toBe('bulk_8');
        expect(cached[1].hash).toBe('bulk_9');
        spamImageCache.maxSize = original;
    });
});

describe('spamImageCache – integration: TTL expiry', () => {
    it('getAll() filters out images older than 24h', () => {
        vi.useFakeTimers();

        spamImageCache.add(makeEntry({ hash: 'old_hash', addedAt: Date.now() }));

        vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000); // 24h + 1s

        spamImageCache.add(makeEntry({ hash: 'new_hash', fileId: 'file2', userId: 2, addedAt: Date.now() }));

        const all = spamImageCache.getAll();
        vi.useRealTimers();

        expect(all.find(e => e.hash === 'old_hash')).toBeUndefined();
        expect(all.find(e => e.hash === 'new_hash')).toBeDefined();
    });

    it('image at exactly 24h boundary is treated as expired', () => {
        vi.useFakeTimers();
        const ts = Date.now();
        spamImageCache.add(makeEntry({ hash: 'boundary', addedAt: ts }));
        vi.advanceTimersByTime(24 * 60 * 60 * 1000);
        const all = spamImageCache.getAll();
        vi.useRealTimers();
        expect(all.find(e => e.hash === 'boundary')).toBeUndefined();
    });
});

describe('spamImageCache – integration: concurrent writes', () => {
    it('10 concurrent adds all persist within capacity', async () => {
        const entries = Array.from({ length: 10 }, (_, i) =>
            makeEntry({ hash: `concurrent_${i}`, fileId: `f${i}`, userId: i })
        );
        await Promise.all(entries.map(e => Promise.resolve(spamImageCache.add(e))));
        // Default maxSize is 20, so all 10 should fit
        expect(spamImageCache.size()).toBe(10);
    });

    it('concurrent adds followed by clear leaves cache empty', async () => {
        await Promise.all(
            Array.from({ length: 5 }, (_, i) =>
                Promise.resolve(spamImageCache.add(makeEntry({ hash: `c${i}`, fileId: `f${i}`, userId: i })))
            )
        );
        clearSpamImageCache();
        expect(spamImageCache.size()).toBe(0);
    });
});

describe('getAllSpamImageHashes – integration', () => {
    it('returns empty array when cache is empty', async () => {
        const hashes = await getAllSpamImageHashes();
        expect(hashes).toEqual([]);
    });

    it('returns correct shape for each entry', async () => {
        spamImageCache.add(makeEntry({ hash: 'aabbccdd', userId: 77 }));
        const hashes = await getAllSpamImageHashes();
        expect(hashes).toHaveLength(1);
        expect(hashes[0]).toMatchObject({
            hash: 'aabbccdd',
            userId: 77,
        });
        expect(typeof hashes[0].addedAt).toBe('number');
    });

    it('does not expose imageData or imageSize', async () => {
        spamImageCache.add(makeEntry({ hash: 'secure_hash', imageData: 'base64abc', imageSize: 9999 }));
        const hashes = await getAllSpamImageHashes();
        expect(hashes[0].imageData).toBeUndefined();
        expect(hashes[0].imageSize).toBeUndefined();
    });

    it('respects TTL — expired images are not returned', async () => {
        vi.useFakeTimers();
        spamImageCache.add(makeEntry({ hash: 'ttl_hash', addedAt: Date.now() }));
        vi.advanceTimersByTime(25 * 60 * 60 * 1000);
        const hashes = await getAllSpamImageHashes();
        vi.useRealTimers();
        expect(hashes.find(h => h.hash === 'ttl_hash')).toBeUndefined();
    });

    it('returns multiple entries correctly', async () => {
        for (let i = 0; i < 5; i++) {
            spamImageCache.add(makeEntry({ hash: `multi_${i}`, fileId: `f${i}`, userId: i }));
        }
        const hashes = await getAllSpamImageHashes();
        expect(hashes).toHaveLength(5);
        const hashValues = hashes.map(h => h.hash);
        for (let i = 0; i < 5; i++) {
            expect(hashValues).toContain(`multi_${i}`);
        }
    });
});

describe('spamImageCache – integration: clear then reuse', () => {
    it('cache is fully operational after clear', () => {
        spamImageCache.add(makeEntry({ hash: 'before' }));
        clearSpamImageCache();
        spamImageCache.add(makeEntry({ hash: 'after' }));
        const all = spamImageCache.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].hash).toBe('after');
    });
});
