// Pure utilities for extracting structured context from Telegram message objects.
// No I/O, no side effects.

/**
 * Flatten a Telegram reply_markup into an array of human-readable strings.
 * Works with both inline_keyboard and reply keyboard layouts.
 * @param {object} replyMarkup
 * @returns {string[]}
 */
function extractReplyMarkupSummary(replyMarkup) {
    const parts = [];
    if (!replyMarkup) return parts;

    if (Array.isArray(replyMarkup.inline_keyboard)) {
        for (const row of replyMarkup.inline_keyboard) {
            if (!Array.isArray(row)) continue;
            for (const button of row) {
                if (!button) continue;
                if (button.text) parts.push(`[Button]: ${button.text}`);
                if (button.url) parts.push(`[Button URL]: ${button.url}`);
                if (button.callback_data) parts.push(`[Button Callback]: ${button.callback_data}`);
                if (button.switch_inline_query) parts.push(`[Button Switch Inline]: ${button.switch_inline_query}`);
                if (button.switch_inline_query_current_chat) {
                    parts.push(`[Button Switch Inline Here]: ${button.switch_inline_query_current_chat}`);
                }
                if (button.web_app?.url) parts.push(`[Button WebApp]: ${button.web_app.url}`);
                if (button.login_url?.url) parts.push(`[Button Login URL]: ${button.login_url.url}`);
            }
        }
    }

    if (Array.isArray(replyMarkup.keyboard)) {
        for (const row of replyMarkup.keyboard) {
            if (!Array.isArray(row)) continue;
            for (const button of row) {
                if (button?.text) parts.push(`[Keyboard Button]: ${button.text}`);
            }
        }
    }

    return parts;
}

module.exports = { extractReplyMarkupSummary };
