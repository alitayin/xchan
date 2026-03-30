const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');
const {
  getBotIsAdmin,
  forwardOrCopyToLogGroup,
  deleteMessageSafe,
  sendLogGroupReport,
} = require('../../infrastructure/telegram/reportingActions.js');
const { buildSpamModerationButtons } = require('./spamModerationHandler.js');
const { addSpamMessage } = require('../../infrastructure/storage/spamMessageCache.js');
const { addSpamImage } = require('../../infrastructure/storage/spamImageStore.js');
const { hasImageMedia, getImageFileId } = require('../../infrastructure/telegram/mediaHelper.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

const { getTextContent } = require('../../domain/utils/text.js');

async function handleReportCommand(msg, bot) {
  if (!msg.reply_to_message) {
    await sendPromptMessage(bot, msg.chat.id, "Please reply to the message you want to report, then send /report.");
    return;
  }

  const isBotAdmin = await getBotIsAdmin(bot, msg.chat.id);
  if (!isBotAdmin) {
    await sendPromptMessage(bot, msg.chat.id, "I need admin rights to delete messages. Please make me an admin first.");
    return;
  }

  const original = msg.reply_to_message;
  const groupName = msg.chat.title || 'Unknown Group';
  const targetUserId = original.from?.id;
  const targetUsername = original.from?.username ? `@${original.from.username}` : (original.from?.first_name || 'unknown');

  try {
    if (hasImageMedia(original)) {
      const imageFileId = getImageFileId(original);
      if (imageFileId) {
        await addSpamImage(bot, imageFileId, targetUserId, {
          chatId: msg.chat.id,
          messageId: original.message_id,
          caption: original.caption,
          mimeType: original.document?.mime_type,
          reporter: msg.from?.username,
        });
      }
    } else {
      const content = getTextContent(original);
      if (content) {
        addSpamMessage(content);
      }
    }
  } catch (cacheError) {
    console.error('Failed to cache reported spam message:', cacheError);
  }

  await forwardOrCopyToLogGroup(bot, NOTIFICATION_GROUP_ID, original, msg.chat.id, groupName);

  await deleteMessageSafe(bot, msg.chat.id, original.message_id);

  const reporterUsername = msg.from.username;
  const notificationMessage = `Thanks for the report @${reporterUsername}, I've removed the spam message.`;
  await sendPromptMessage(bot, msg.chat.id, notificationMessage);

  await deleteMessageSafe(bot, msg.chat.id, msg.message_id);

  const reportInfo = `Reported message from ${targetUsername} deleted by me, report by @${reporterUsername}`;

  const moderationButtons = targetUserId
    ? buildSpamModerationButtons({
        chatId: msg.chat.id,
        userId: targetUserId,
        showBan: true,
        showUnban: false,
      })
    : null;

  await sendLogGroupReport(bot, NOTIFICATION_GROUP_ID, reportInfo, moderationButtons || {});
}

module.exports = {
  handleReportCommand,
};


