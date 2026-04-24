const SECONDARY_CONTENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    spam: {
      type: 'boolean',
      description: 'Whether this content is spam and should be deleted from an eCash Telegram group.',
    },
    similar_avatar: {
      type: 'boolean',
      description: 'When comparing two avatar images, whether the two avatars are the same or visually very similar. Otherwise false.',
    },
  },
  required: ['spam', 'similar_avatar'],
};

const SECONDARY_CONTENT_SYSTEM_PROMPT = [
  'Your name is eChan.',
  'You are an AI that helps maintain eCash Telegram groups.',
  'Return exactly one JSON object matching the provided schema.',
  '',
  'General Anti-Spam Guidelines:',
  '- Any recruitment or job offers are spam.',
  '- If someone says "scam" or "this is a scam link", that is not a spam offense by itself.',
  '- If a message contains no text but an image, evaluate the image itself for scam content, such as fake Elon Musk posts or fake Trump airdrops.',
  '- If a message guides users step by step about eCash or an eCash-related project, it is not spam.',
  '- If another project is mentioned while guiding a swap or bridge related to XEC, it is not spam.',
  '- Saying "soon pump" or "moon soon" is not necessarily spam.',
  '- Predominantly sexually explicit messages like "I\'m horny and wet, let\'s chat" are spam.',
  '- Announcements regarding claims on SOL or any other network are most likely spam.',
  '- Asking or offering to trade cryptocurrencies directly via DM is spam.',
  '',
  'The following are not considered spam:',
  '- eCash or XEC-related content is most likely not spam.',
  '- https://localecash.com offers are not spam.',
  '- https://blitzchips.com',
  '- https://firma.cash',
  '- https://eCash.poker',
  '- https://blockchain.poker',
  '- https://cashtab.com and https://cashtab.io',
  '- https://ecashpulse.com/',
  '- https://agora.cash and Star Crystal token (SC) and Star Shard (S)',
  '- https://app.tonalli.cash, Tonalli wallet, and RMZ token by XOLOS Ramirez',
  '- Kurwa token on eCash, https://kurwa.cash',
  '- https://t.me/+fkN6ot4h8803MGNi, the eCash army group',
  '- People celebrating "moon soon" or "pump"',
  '- Casual discussion of other cryptocurrencies, including praise or technical comparison',
  '- If there are no offers, private USDT trading requests, links, or @ usernames, it is likely not spam',
  '- If the only link is x.com or YouTube, be more flexible',
  '- An x.com-only link is not spam',
  '- Discussing promo and ad campaigns for XEC',
  '- The "overmind" bot and anything around using it, including DM',
].join('\n');

function normalizeImageUrls(imageUrls) {
  if (!imageUrls) return [];
  const list = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  return list.filter((url) => typeof url === 'string' && url.trim());
}

function buildSecondaryInstruction({ query, mode, compatibilityMode = false }) {
  const lines = [];

  if (mode === 'avatar_compare') {
    lines.push('Compare the two provided avatar images.');
    lines.push('Set similar_avatar to true only if the two avatars appear to be the same person or the same avatar image.');
    lines.push('Set spam to false unless the images themselves are obvious spam or scam content.');
  } else {
    lines.push('Evaluate whether this message or image content is spam and should be deleted from an eCash Telegram group.');
    lines.push('Set similar_avatar to false unless you are explicitly comparing two avatar images.');
  }

  if (compatibilityMode) {
    lines.push('Return exactly one JSON object. No markdown, no prose, no code fences.');
    lines.push(`Use this exact schema and field set: ${JSON.stringify(SECONDARY_CONTENT_JSON_SCHEMA)}`);
  } else {
    lines.push('Return only the JSON object matching the provided schema.');
  }

  if (query) {
    lines.push('');
    lines.push('Message context:');
    lines.push(query);
  }

  return lines.join('\n');
}

function buildSecondaryContentMessages({ query = '', imageUrls = [], mode = 'spam_check', compatibilityMode = false }) {
  const normalizedImageUrls = normalizeImageUrls(imageUrls);
  const userText = buildSecondaryInstruction({ query: String(query || '').trim(), mode, compatibilityMode });

  if (!normalizedImageUrls.length) {
    return [
      { role: 'system', content: SECONDARY_CONTENT_SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ];
  }

  const content = [{ type: 'text', text: userText }];
  for (const imageUrl of normalizedImageUrls) {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  return [
    { role: 'system', content: SECONDARY_CONTENT_SYSTEM_PROMPT },
    { role: 'user', content },
  ];
}

function extractJsonObject(text) {
  if (typeof text !== 'string') {
    return null;
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function parseBooleanField(value, fieldName) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`Invalid boolean field: ${fieldName}`);
}

function normalizeSecondaryContentResult(payload) {
  let parsed = payload;

  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch (_) {
      parsed = extractJsonObject(payload);
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Secondary content payload must be a JSON object');
  }

  return {
    spam: parseBooleanField(parsed.spam, 'spam'),
    similar_avatar: parseBooleanField(parsed.similar_avatar, 'similar_avatar'),
  };
}

module.exports = {
  SECONDARY_CONTENT_JSON_SCHEMA,
  SECONDARY_CONTENT_SYSTEM_PROMPT,
  buildSecondaryContentMessages,
  normalizeSecondaryContentResult,
};
