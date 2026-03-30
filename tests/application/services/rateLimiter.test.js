import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '../../../src/application/services/rateLimiter.js';

function makeLimiter(overrides = {}) {
    return createRateLimiter({
        concurrency: 2,
        requestIntervalMs: 5000,
        dailyLimit: 10,
        dailyWindowMs: 86400000,
        maxQueueSize: 5,
        ...overrides,
    });
}

describe('createRateLimiter — config validation', () => {
    it('throws when a required option is missing', () => {
        expect(() => createRateLimiter({})).toThrow('rateLimiter: invalid');
    });
    it('throws when a value is zero', () => {
        expect(() => makeLimiter({ concurrency: 0 })).toThrow('rateLimiter: invalid');
    });
    it('throws when a value is negative', () => {
        expect(() => makeLimiter({ dailyLimit: -1 })).toThrow('rateLimiter: invalid');
    });
    it('exposes config via getConfig()', () => {
        const rl = makeLimiter();
        expect(rl.getConfig().dailyLimit).toBe(10);
    });
});

describe('checkAndConsume — cooldown', () => {
    it('allows first request immediately', () => {
        const rl = makeLimiter();
        const result = rl.checkAndConsume({ userId: 1 });
        expect(result.allowed).toBe(true);
    });
    it('blocks second request within cooldown window', () => {
        const rl = makeLimiter({ requestIntervalMs: 60000 });
        rl.checkAndConsume({ userId: 1 });
        const result = rl.checkAndConsume({ userId: 1 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('cooldown');
        expect(result.secondsLeft).toBeGreaterThan(0);
    });
    it('allows different users independently', () => {
        const rl = makeLimiter({ requestIntervalMs: 60000 });
        rl.checkAndConsume({ userId: 1 });
        const result = rl.checkAndConsume({ userId: 2 });
        expect(result.allowed).toBe(true);
    });
    it('bypass skips all checks', () => {
        const rl = makeLimiter({ requestIntervalMs: 60000 });
        rl.checkAndConsume({ userId: 1 });
        const result = rl.checkAndConsume({ userId: 1, bypass: true });
        expect(result.allowed).toBe(true);
    });
});

describe('checkAndConsume — daily quota', () => {
    it('blocks when daily limit is reached', () => {
        vi.useFakeTimers();
        const rl = makeLimiter({ requestIntervalMs: 1000, dailyLimit: 3 });
        // Advance time by cooldown between each call so cooldown never triggers
        for (let i = 0; i < 3; i++) {
            vi.advanceTimersByTime(1001);
            rl.checkAndConsume({ userId: 99 });
        }
        vi.advanceTimersByTime(1001);
        const result = rl.checkAndConsume({ userId: 99 });
        vi.useRealTimers();
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('quota');
        expect(result.msUntilReset).toBeGreaterThan(0);
    });
    it('tracks remaining count correctly', () => {
        const rl = makeLimiter({ requestIntervalMs: 60000, dailyLimit: 5 });
        const r1 = rl.checkAndConsume({ userId: 7 });
        expect(r1.allowed).toBe(true);
        expect(r1.remaining).toBe(4);
    });
});

describe('checkAndConsume — clearUser', () => {
    it('resets cooldown and quota after clearUser', () => {
        const rl = makeLimiter({ requestIntervalMs: 60000, dailyLimit: 1 });
        rl.checkAndConsume({ userId: 5 });
        rl.checkAndConsume({ userId: 5 }); // hits quota
        rl.clearUser(5);
        const result = rl.checkAndConsume({ userId: 5 });
        expect(result.allowed).toBe(true);
    });
});

describe('enqueue — queue limit', () => {
    it('rejects when queue is full', async () => {
        const rl = makeLimiter({ concurrency: 1, maxQueueSize: 2 });
        // Fill the queue with slow tasks (catch to avoid unhandled rejections)
        const slow = () => new Promise(r => setTimeout(r, 500));
        const p1 = rl.enqueue(slow).catch(() => {});
        const p2 = rl.enqueue(slow).catch(() => {});
        const p3 = rl.enqueue(slow).catch(() => {}); // 1 running + 2 queued = full
        await expect(rl.enqueue(slow)).rejects.toThrow('queue full');
        await Promise.all([p1, p2, p3]);
    });
    it('resolves with task result', async () => {
        const rl = makeLimiter();
        const result = await rl.enqueue(() => Promise.resolve(42));
        expect(result).toBe(42);
    });
    it('rejects when task throws', async () => {
        const rl = makeLimiter();
        await expect(rl.enqueue(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    });
});
