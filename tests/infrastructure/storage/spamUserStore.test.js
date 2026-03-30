import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { updateSpamRecord, getSpamRecord, resetSpamRecord, TRACKING_WINDOW_MS } =
    require('../../../src/infrastructure/storage/spamUserStore.js');

beforeEach(() => {
    // Clear state between tests by resetting each user we use
    resetSpamRecord(1);
    resetSpamRecord(2);
});

describe('updateSpamRecord', () => {
    it('creates a new record with count 1 on first offense', () => {
        const record = updateSpamRecord(1);
        expect(record.count).toBe(1);
        expect(typeof record.firstSpamTime).toBe('number');
    });

    it('increments count on repeated offense within window', () => {
        updateSpamRecord(1);
        const record = updateSpamRecord(1);
        expect(record.count).toBe(2);
    });

    it('resets count when window has expired', () => {
        vi.useFakeTimers();
        updateSpamRecord(1);
        // Advance past the 3h tracking window
        vi.advanceTimersByTime(TRACKING_WINDOW_MS + 1);
        const record = updateSpamRecord(1);
        vi.useRealTimers();
        expect(record.count).toBe(1);
    });

    it('tracks different users independently', () => {
        updateSpamRecord(1);
        updateSpamRecord(1);
        updateSpamRecord(2);
        expect(getSpamRecord(1).count).toBe(2);
        expect(getSpamRecord(2).count).toBe(1);
    });
});

describe('getSpamRecord', () => {
    it('returns null for unknown user', () => {
        expect(getSpamRecord(9999)).toBeNull();
    });

    it('returns record after update', () => {
        updateSpamRecord(1);
        const record = getSpamRecord(1);
        expect(record).not.toBeNull();
        expect(record.count).toBe(1);
    });
});

describe('resetSpamRecord', () => {
    it('removes record for user', () => {
        updateSpamRecord(1);
        resetSpamRecord(1);
        expect(getSpamRecord(1)).toBeNull();
    });

    it('is a no-op for unknown user', () => {
        expect(() => resetSpamRecord(9999)).not.toThrow();
    });
});
