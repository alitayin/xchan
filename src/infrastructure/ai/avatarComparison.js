const { safelyEvaluateSecondaryContent } = require('./secondaryContentEvaluator.js');

/**
 * Compare two avatars via AI API
 * @param {string} avatarUrl1 - First avatar URL
 * @param {string} avatarUrl2 - Second avatar URL
 * @param {number} userId - User ID for API tracking
 * @returns {Promise<boolean>} True if avatars are similar (same person)
 */
async function compareAvatars(avatarUrl1, avatarUrl2, userId) {
  const result = await safelyEvaluateSecondaryContent({
    query: 'Compare these two avatar images and determine whether they are the same avatar or person.',
    userId,
    imageUrls: [avatarUrl1, avatarUrl2],
    mode: 'avatar_compare',
  });

  return result?.spam === false && result?.similar_avatar === true;
}

module.exports = {
  compareAvatars,
};
