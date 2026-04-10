// Message formatting for send operations
// Domain layer module

const { escapeMarkdown } = require('./markdown.js');

/**
 * Format usage instructions for /send command
 * @returns {string} Formatted usage message
 */
function formatSendUsage() {
    return '❌ Please reply to a user\'s message to send tokens.\n\n' +
           'Usage:\n' +
           '💵 /send <amount> - Send XEC\n' +
           '🪙 /send <tokenId|alias> <amount> - Send SLP/ALP tokens';
}

/**
 * Format detailed usage instructions with examples
 * @returns {string} Formatted detailed usage message
 */
function formatDetailedSendUsage() {
    return '❌ Invalid command format.\n\n' +
           'Usage:\n' +
           '💵 /send <amount> - Send XEC (amount in XEC, decimals supported)\n' +
           '🪙 /send <tokenId|alias> <amount> - Send SLP/ALP tokens (amount in tokens, decimals supported up to token precision)\n\n' +
           'Example:\n' +
           '/send 100.50 - Send 100.50 XEC\n' +
           '/send oorah 224 - Send 224 OORAH tokens (using alias)\n' +
           '/send aed861a31b96934b88c0252ede135cb9700d7649f69191235087a3030e553cb1 224 - Send 224 tokens (using full token ID)\n\n' +
           '💡 System will automatically detect token type (SLP/ALP) and decimals';
}

/**
 * Format invalid amount error message
 * @returns {string}
 */
function formatInvalidAmountError() {
    return '❌ Invalid amount. Please provide a positive number.';
}

/**
 * Format user not registered error
 * @param {string} username - Username
 * @returns {string}
 */
function formatUserNotRegisteredError(username) {
    return `❌ User @${escapeMarkdown(username)} has not registered an eCash address yet.\n\n` +
           'Please ask them to use /signup <address> first.';
}

/**
 * Format address retrieval error
 * @returns {string}
 */
function formatAddressRetrievalError() {
    return '❌ Failed to retrieve recipient address. Please try again.';
}

/**
 * Format wallet not configured error
 * @returns {string}
 */
function formatWalletNotConfiguredError() {
    return '❌ Bot wallet not configured. Please contact administrator.';
}

/**
 * Format loading message
 * @param {boolean} isXecSend - Whether sending XEC or tokens
 * @returns {string}
 */
function formatLoadingMessage(isXecSend) {
    return `⏳ ${isXecSend ? 'Sending XEC' : 'Sending tokens'}...`;
}

/**
 * Format successful send message
 * @param {number} amount - Amount sent (in display units)
 * @param {string} currencyName - Currency name (XEC or token ticker/name)
 * @param {string} username - Recipient username
 * @param {string} txid - Transaction ID
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
function formatSuccessMessage(amount, currencyName, username, txid, decimals = 2) {
    const displayAmount = typeof amount === 'string'
        ? amount
        : Number(amount).toFixed(decimals);
    return `✅ Successfully sent ${displayAmount} ${currencyName} to @${escapeMarkdown(username)}!\n\n` +
           `💰 Amount: ${displayAmount}${currencyName === 'XEC' ? ' XEC' : ''}\n` +
           `🔍 [View on Explorer](https://explorer.e.cash/tx/${txid})`;
}

/**
 * Format send error message
 * @param {Error} error - Error object
 * @returns {string}
 */
function formatSendError(error) {
    let errorMessage = '❌ Failed to send tokens. ';
    
    if (error.message?.includes('insufficient')) {
        errorMessage += 'Insufficient balance in bot wallet.';
    } else if (error.message?.includes('UTXO')) {
        errorMessage += 'No suitable UTXOs found.';
    } else if (error.message?.includes('broadcast')) {
        errorMessage += 'Transaction broadcast failed.';
    } else {
        errorMessage += `Error: ${error.message}`;
    }
    
    return errorMessage;
}

module.exports = {
    formatSendUsage,
    formatDetailedSendUsage,
    formatInvalidAmountError,
    formatUserNotRegisteredError,
    formatAddressRetrievalError,
    formatWalletNotConfiguredError,
    formatLoadingMessage,
    formatSuccessMessage,
    formatSendError
};

