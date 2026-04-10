import { describe, expect, it } from 'vitest';

import {
    parseDisplayAmountToAtoms,
    formatAtomsToDisplay,
} from '../../../src/domain/utils/amounts.js';

describe('amounts utils', () => {
    it('parses display amounts into bigint atoms', () => {
        expect(parseDisplayAmountToAtoms('12.34', 2)).toBe(1234n);
        expect(parseDisplayAmountToAtoms('0.00000001', 8)).toBe(1n);
        expect(parseDisplayAmountToAtoms('42', 0)).toBe(42n);
    });

    it('rejects amounts that exceed supported precision', () => {
        expect(() => parseDisplayAmountToAtoms('1.234', 2)).toThrow(/precision/i);
    });

    it('formats bigint atoms into display amounts', () => {
        expect(formatAtomsToDisplay(1234n, 2)).toBe('12.34');
        expect(formatAtomsToDisplay(1200n, 2)).toBe('12');
        expect(formatAtomsToDisplay(1n, 8)).toBe('0.00000001');
    });
});
