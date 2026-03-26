const { calculateTextSimilarity } = require('../../domain/utils/similarity.js');

/**
 * In-memory cache for spam messages
 */
const spamMessageCache = {
    messages: [],
    maxSize: 1000, // Maximum number of spam messages to cache
    
    /**
     * Add a spam message to the cache
     * @param {string} message - The spam message content
     */
    add(message) {
        this.messages.push({
            content: message,
            timestamp: Date.now()
        });
        // Keep only the most recent messages
        if (this.messages.length > this.maxSize) {
            this.messages.shift();
        }
    },
    
    /**
     * Get all cached spam messages (with automatic cleanup)
     * @returns {string[]} Array of spam message contents
     */
    getAll() {
        // Clean up messages older than 24 hours
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        this.messages = this.messages.filter(msg => msg.timestamp > oneDayAgo);
        return this.messages.map(msg => msg.content);
    },
    
    /**
     * Get the current cache size
     * @returns {number} Number of cached messages
     */
    size() {
        return this.messages.length;
    },
    
    /**
     * Clear all cached messages
     */
    clear() {
        this.messages = [];
    }
};

/**
 * Check if a message is similar to any cached spam message
 * @param {string} message - The message to check
 * @param {number} threshold - Similarity threshold (default 95)
 * @returns {boolean} True if similar spam found
 */
function isSimilarToSpam(message, threshold = 95) {
    const cachedSpamMessages = spamMessageCache.getAll();
    const msgLen = message.length;

    for (const spamMessage of cachedSpamMessages) {
        // Quick length pre-filter: messages with very different lengths cannot be
        // highly similar, so skip the expensive similarity calculation early.
        const lenRatio = msgLen === 0 ? 0 : Math.min(msgLen, spamMessage.length) / Math.max(msgLen, spamMessage.length);
        if (lenRatio * 100 < threshold) {
            continue;
        }
        const similarity = calculateTextSimilarity(message, spamMessage);
        if (similarity >= threshold) {
            console.log(`Found similar spam message (${similarity.toFixed(2)}% match)`);
            return true;
        }
    }

    return false;
}

/**
 * Add a spam message to the cache
 * @param {string} message - The spam message content
 */
function addSpamMessage(message) {
    if (message && message.trim()) {
        spamMessageCache.add(message);
        console.log(`Added spam message to cache. Cache size: ${spamMessageCache.size()}`);
    }
}

module.exports = {
    spamMessageCache,
    isSimilarToSpam,
    addSpamMessage,
};

