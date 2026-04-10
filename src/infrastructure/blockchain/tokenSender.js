// Token sending operations via ecash-quicksend
// Infrastructure layer module

const { ChronikClient } = require('chronik-client');
const { CHRONIK_URLS } = require('../../../config/config.js');
const { getQuicksendApi } = require('./quicksendClient.js');

function assertRecipientsUseBigInt(recipients) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('Recipients must be a non-empty array');
    }

    for (const recipient of recipients) {
        if (!recipient?.address || typeof recipient.amount !== 'bigint') {
            throw new Error('Recipients must include address and bigint amount');
        }
    }
}

/**
 * Get mnemonic from environment
 * @returns {string|null} Mnemonic or null if not configured
 */
function getMnemonic() {
    return process.env.MNEMONIC || null;
}

/**
 * Create Chronik client
 * @returns {ChronikClient} Chronik client instance
 */
function createChronikClient() {
    if (!Array.isArray(CHRONIK_URLS) || CHRONIK_URLS.length === 0) {
        throw new Error('CHRONIK_URLS not configured properly');
    }

    console.log(`📡 Using Chronik client: ${CHRONIK_URLS[0]}`);
    return new ChronikClient(CHRONIK_URLS);
}

/**
 * Send XEC to recipients
 * @param {Array<{address: string, amount: bigint}>} recipients - Array of recipients with amounts in satoshis
 * @returns {Promise<{txid: string}>} Transaction result
 */
async function sendXec(recipients) {
    const mnemonic = getMnemonic();
    if (!mnemonic) {
        throw new Error('MNEMONIC not configured in environment variables');
    }
    assertRecipientsUseBigInt(recipients);

    const chronik = createChronikClient();
    const quick = await getQuicksendApi();

    return await quick.sendXec(recipients, {
        mnemonic: mnemonic,
        chronik: chronik
    });
}

/**
 * Send tokens to recipients using the latest ecash-quicksend unified API.
 * @param {Array<{address: string, amount: bigint}>} recipients - Recipients with amounts in token atoms
 * @param {string} tokenId - Token ID
 * @returns {Promise<{txid: string}>} Transaction result
 */
async function sendToken(recipients, tokenId) {
    const mnemonic = getMnemonic();
    if (!mnemonic) {
        throw new Error('MNEMONIC not configured in environment variables');
    }
    assertRecipientsUseBigInt(recipients);

    const chronik = createChronikClient();
    const quick = await getQuicksendApi();

    return await quick.sendToken(recipients, {
        tokenId: tokenId,
        mnemonic: mnemonic,
        chronik: chronik
    });
}

/**
 * Deprecated compatibility wrapper.
 * @param {Array<{address: string, amount: bigint}>} recipients - Recipients with amounts in token atoms
 * @param {string} tokenId - Token ID
 * @returns {Promise<{txid: string}>} Transaction result
 */
async function sendSlp(recipients, tokenId) {
    return await sendToken(recipients, tokenId);
}

/**
 * Deprecated compatibility wrapper.
 * @param {Array<{address: string, amount: bigint}>} recipients - Recipients with amounts in token atoms
 * @param {string} tokenId - Token ID
 * @returns {Promise<{txid: string}>} Transaction result
 */
async function sendAlp(recipients, tokenId) {
    return await sendToken(recipients, tokenId);
}

/**
 * Check if mnemonic is configured
 * @returns {boolean}
 */
function isMnemonicConfigured() {
    return !!getMnemonic();
}

module.exports = {
    sendXec,
    sendToken,
    sendSlp,
    sendAlp,
    isMnemonicConfigured
};
