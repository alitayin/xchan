import { describe, it, expect } from 'vitest';
import {
    isPotentialNameImpersonation,
    decideAfterAvatarCheck,
    isWhitelistValid,
    DEFAULT_WHITELIST_DURATION_MS,
} from '../../../src/domain/policies/impersonationPolicy.js';

describe('isPotentialNameImpersonation', () => {
    const admin = { userId: 1, username: 'realadmin', fullName: 'Alice Smith' };
    const user  = { id: 2,  username: 'impostor',  fullName: 'Alice Smith' };

    it('returns true when names match and ids differ', () => {
        expect(isPotentialNameImpersonation({ user, admin })).toBe(true);
    });
    it('returns false when names differ', () => {
        expect(isPotentialNameImpersonation({ user: { ...user, fullName: 'Bob' }, admin })).toBe(false);
    });
    it('returns false when user is actually the admin (same id)', () => {
        expect(isPotentialNameImpersonation({ user: { ...user, id: 1 }, admin })).toBe(false);
    });
    it('returns false when both have the same username', () => {
        expect(isPotentialNameImpersonation({
            user: { ...user, username: 'realadmin' },
            admin,
        })).toBe(false);
    });
    it('returns false when user fullName is empty', () => {
        expect(isPotentialNameImpersonation({ user: { ...user, fullName: '' }, admin })).toBe(false);
    });
    it('returns false when admin fullName is empty', () => {
        expect(isPotentialNameImpersonation({ user, admin: { ...admin, fullName: '   ' } })).toBe(false);
    });
});

describe('decideAfterAvatarCheck', () => {
    it('flags impersonation when avatars are similar', () => {
        const result = decideAfterAvatarCheck({ avatarsSimilar: true });
        expect(result.isImpersonation).toBe(true);
        expect(result.addToWhitelist).toBe(false);
    });
    it('clears and whitelists when avatars differ', () => {
        const result = decideAfterAvatarCheck({ avatarsSimilar: false });
        expect(result.isImpersonation).toBe(false);
        expect(result.addToWhitelist).toBe(true);
    });
});

describe('isWhitelistValid', () => {
    it('returns true when entry is within TTL', () => {
        const now = Date.now();
        expect(isWhitelistValid(now - 1000, now)).toBe(true);
    });
    it('returns false when entry has expired', () => {
        const now = Date.now();
        expect(isWhitelistValid(now - DEFAULT_WHITELIST_DURATION_MS - 1, now)).toBe(false);
    });
    it('returns false for null timestamp', () => {
        expect(isWhitelistValid(null)).toBe(false);
    });
    it('respects custom TTL', () => {
        const now = Date.now();
        expect(isWhitelistValid(now - 5000, now, 3000)).toBe(false);
        expect(isWhitelistValid(now - 5000, now, 10000)).toBe(true);
    });
});
