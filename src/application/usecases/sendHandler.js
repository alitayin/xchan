const { getUserAddress } = require('../../infrastructure/storage/userAddressStore.js');
const { ensureAddressWithFallback } = require('../../infrastructure/blockchain/addressUtils.js');
const { resolveTokenAlias, getTokenInfo } = require('../../infrastructure/blockchain/tokenInfo.js');
const { sendXec, sendToken, isMnemonicConfigured } = require('../../infrastructure/blockchain/tokenSender.js');
const { sendMessage, editMessageText } = require('../../infrastructure/telegram/messagingActions.js');
const { parseDisplayAmountToAtoms, formatAtomsToDisplay } = require('../../domain/utils/amounts.js');
const {
    formatSendUsage,
    formatDetailedSendUsage,
    formatInvalidAmountError,
    formatUserNotRegisteredError,
    formatAddressRetrievalError,
    formatWalletNotConfiguredError,
    formatLoadingMessage,
    formatSuccessMessage,
    formatSendError
} = require('../../domain/formatting/sendMessages.js');

async function handleSendCommand(msg, bot) {
    if (!msg.reply_to_message || !msg.reply_to_message.from) {
        await sendMessage(bot, msg.chat.id, formatSendUsage());
        return;
    }

    const recipientUserId = msg.reply_to_message.from.id;
    const recipientUsername = msg.reply_to_message.from.username || 
                             msg.reply_to_message.from.first_name || 
                             'unknown';

    const parts = msg.text.trim().split(/\s+/);
    
    if (parts.length < 2) {
        await sendMessage(bot, msg.chat.id, formatDetailedSendUsage());
        return;
    }

    const isXecSend = parts.length === 2;
    let tokenId = isXecSend ? null : parts[1];
    
    if (tokenId) {
        tokenId = resolveTokenAlias(tokenId);
    }

    const amountInput = (isXecSend ? parts[1] : parts[2]) || '';
    if (!/^\d+(\.\d+)?$/.test(amountInput.trim())) {
        await sendMessage(bot, msg.chat.id, formatInvalidAmountError());
        return;
    }

    let recipientAddress;
    try {
        const addressData = await getUserAddress(recipientUserId);
        
        if (!addressData) {
            await sendMessage(
                bot, 
                msg.chat.id, 
                formatUserNotRegisteredError(recipientUsername),
                { parse_mode: 'Markdown' }
            );
            return;
        }

        recipientAddress = ensureAddressWithFallback(addressData.address);
    } catch (error) {
        console.error('Error getting recipient address:', error);
        await sendMessage(bot, msg.chat.id, formatAddressRetrievalError());
        return;
    }

    if (!isMnemonicConfigured()) {
        console.error('MNEMONIC not configured');
        await sendMessage(bot, msg.chat.id, formatWalletNotConfiguredError());
        return;
    }

    let loadingMsg;

    try {
        let result;
        let displayAmount;
        let currencyName;
        let decimals;

        loadingMsg = await sendMessage(
            bot,
            msg.chat.id,
            formatLoadingMessage(isXecSend)
        );

        if (isXecSend) {
            const amountInSatoshis = parseDisplayAmountToAtoms(amountInput, 2);
            const recipients = [{ address: recipientAddress, amount: amountInSatoshis }];
            
            result = await sendXec(recipients);
            displayAmount = formatAtomsToDisplay(amountInSatoshis, 2);
            currencyName = 'XEC';
            decimals = 2;

            console.log(`Sent ${displayAmount} XEC (${amountInSatoshis} sats) to @${recipientUsername} (${recipientUserId}): ${result.txid}`);
        } else {
            const tokenInfo = await getTokenInfo(tokenId);
            const { decimals: tokenDecimals, ticker: tokenTicker, name: tokenName, protocol: tokenProtocol } = tokenInfo;
            
            const amountInAtoms = parseDisplayAmountToAtoms(amountInput, tokenDecimals);
            const recipients = [{ address: recipientAddress, amount: amountInAtoms }];

            result = await sendToken(recipients, tokenId);

            displayAmount = formatAtomsToDisplay(amountInAtoms, tokenDecimals);
            currencyName = tokenTicker || tokenName;
            decimals = tokenDecimals;
            
            console.log(`Sent ${displayAmount} ${currencyName} [${tokenProtocol}] (${amountInAtoms} atoms, decimals: ${tokenDecimals}) to @${recipientUsername} (${recipientUserId}): ${result.txid}`);
        }

        await editMessageText(
            bot,
            msg.chat.id,
            loadingMsg.message_id,
            formatSuccessMessage(displayAmount, currencyName, recipientUsername, result.txid, decimals),
            {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            }
        );
    } catch (error) {
        console.error('Error sending tokens:', error);

        const errorText = /amount|precision/i.test(error.message || '')
            ? formatInvalidAmountError()
            : formatSendError(error);

        if (loadingMsg?.message_id) {
            await editMessageText(
                bot,
                msg.chat.id,
                loadingMsg.message_id,
                errorText
            );
            return;
        }

        await sendMessage(bot, msg.chat.id, errorText);
    }
}

module.exports = {
    handleSendCommand
};
