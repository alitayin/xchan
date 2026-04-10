function parseDisplayAmountToAtoms(rawAmount, decimals) {
    if (!Number.isInteger(decimals) || decimals < 0) {
        throw new Error(`Invalid decimals: ${decimals}`);
    }

    const normalized = String(rawAmount || '').trim();
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
        throw new Error('Invalid amount format');
    }

    const [wholePart, fractionalPart = ''] = normalized.split('.');
    if (fractionalPart.length > decimals) {
        throw new Error(`Amount exceeds supported precision of ${decimals} decimal places`);
    }

    const paddedFraction = fractionalPart.padEnd(decimals, '0');
    const atomsString = `${wholePart}${paddedFraction}`.replace(/^0+(?=\d)/, '');
    const atoms = BigInt(atomsString || '0');

    if (atoms <= 0n) {
        throw new Error('Amount must be greater than zero');
    }

    return atoms;
}

function formatAtomsToDisplay(atoms, decimals) {
    if (typeof atoms !== 'bigint') {
        throw new Error('atoms must be a bigint');
    }
    if (!Number.isInteger(decimals) || decimals < 0) {
        throw new Error(`Invalid decimals: ${decimals}`);
    }

    const isNegative = atoms < 0n;
    const absoluteAtoms = isNegative ? -atoms : atoms;

    if (decimals === 0) {
        return `${isNegative ? '-' : ''}${absoluteAtoms.toString()}`;
    }

    const padded = absoluteAtoms.toString().padStart(decimals + 1, '0');
    const whole = padded.slice(0, -decimals) || '0';
    const fraction = padded.slice(-decimals).replace(/0+$/, '');
    const display = fraction ? `${whole}.${fraction}` : whole;

    return `${isNegative ? '-' : ''}${display}`;
}

module.exports = {
    parseDisplayAmountToAtoms,
    formatAtomsToDisplay,
};
