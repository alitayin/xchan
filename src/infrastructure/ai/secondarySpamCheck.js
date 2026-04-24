const { safelyEvaluateSecondaryContent } = require('./secondaryContentEvaluator.js');

async function performSecondarySpamCheck(query, userId, imageUrls = null) {
  const result = await safelyEvaluateSecondaryContent({
    query,
    userId,
    imageUrls: Array.isArray(imageUrls) ? imageUrls : (imageUrls ? [imageUrls] : []),
    mode: 'spam_check',
  });

  if (!result) {
    return false;
  }

  return result.spam === true;
}

module.exports = {
  performSecondarySpamCheck,
};
