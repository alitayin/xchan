import { describe, it, expect, vi } from 'vitest';
import { withKeyRotation } from '../../../src/infrastructure/ai/withKeyRotation.js';

const makeClient = (id) => ({ id });

describe('withKeyRotation', () => {
    it('resolves immediately on first success', async () => {
        const clients = [makeClient(1)];
        const fn = vi.fn().mockResolvedValue('ok');
        const result = await withKeyRotation(clients, fn);
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws when clients array is empty', async () => {
        await expect(withKeyRotation([], vi.fn())).rejects.toThrow('clients array must not be empty');
    });

    it('throws when clients is null', async () => {
        await expect(withKeyRotation(null, vi.fn())).rejects.toThrow('clients array must not be empty');
    });

    it('rotates to backup key on 400 error', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const fn = vi.fn()
            .mockRejectedValueOnce({ response: { status: 400 } })
            .mockResolvedValue('ok from backup');
        const result = await withKeyRotation(clients, fn);
        expect(result).toBe('ok from backup');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn.mock.calls[0][0]).toBe(clients[0]);
        expect(fn.mock.calls[1][0]).toBe(clients[1]);
    });

    it('supports custom status codes for key switching', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const fn = vi.fn()
            .mockRejectedValueOnce({ response: { status: 429 } })
            .mockResolvedValue('ok from backup');
        const result = await withKeyRotation(clients, fn, { switchOnStatuses: [429] });
        expect(result).toBe('ok from backup');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn.mock.calls[0][0]).toBe(clients[0]);
        expect(fn.mock.calls[1][0]).toBe(clients[1]);
    });

    it('does not retry the same client on switch-only statuses when no backup key exists', async () => {
        const clients = [makeClient(1)];
        const fn = vi.fn().mockRejectedValue({ response: { status: 403 } });
        await expect(
            withKeyRotation(clients, fn, { switchOnStatuses: [403], maxRetriesPerKey: 3 })
        ).rejects.toThrow('all attempts exhausted');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on non-400 errors up to maxRetriesPerKey', async () => {
        const clients = [makeClient(1)];
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('flaky'))
            .mockRejectedValueOnce(new Error('flaky'))
            .mockResolvedValue('recovered');
        const result = await withKeyRotation(clients, fn, { maxRetriesPerKey: 3 });
        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws after all attempts exhausted', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const fn = vi.fn().mockRejectedValue(new Error('always fails'));
        await expect(
            withKeyRotation(clients, fn, { maxRetriesPerKey: 2, maxTotalAttempts: 4 })
        ).rejects.toThrow('all attempts exhausted');
    });

    it('preserves the final provider error as cause', async () => {
        const clients = [makeClient(1)];
        const originalError = Object.assign(new Error('forbidden'), {
            response: { status: 403, data: { error: { message: 'Forbidden' } } },
        });
        const fn = vi.fn().mockRejectedValue(originalError);
        await expect(
            withKeyRotation(clients, fn, { switchOnStatuses: [403] })
        ).rejects.toMatchObject({
            message: 'withKeyRotation: all attempts exhausted',
            cause: originalError,
        });
    });

    it('respects maxTotalAttempts hard cap', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const fn = vi.fn().mockRejectedValue(new Error('fail'));
        await expect(
            withKeyRotation(clients, fn, { maxRetriesPerKey: 10, maxTotalAttempts: 3 })
        ).rejects.toThrow('all attempts exhausted');
        expect(fn).toHaveBeenCalledTimes(3);
    });
});
