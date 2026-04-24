const MESSAGE_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    deviation: {
      type: 'number',
      description: 'If eCash or related activities are mentioned, use 0. Use 10 when uncertain or no projects are mentioned. Use values near 100 only when other cryptocurrency projects are mentioned; otherwise keep it at 30 or below.',
    },
    suspicion: {
      type: 'number',
      description: 'Suspicion level from 0 to 100. Increase this for investment, purchase, scam, or solicitation topics. Keep it 0 for eCash or clearly non-investment content.',
    },
    inducement: {
      type: 'number',
      description: 'Inducement level from 0 to 100. Raise this when users are pushed to click, visit, join, or interact with non-eCash content. eCash-related calls to action should stay relatively low.',
    },
    spam: {
      type: 'boolean',
      description: 'Whether the message is spam or scam.',
    },
    is_english: {
      type: 'boolean',
      description: 'Whether the content contains English text. Pure punctuation, numbers, emojis, and symbols should be treated as neutral/true. Only clear non-English language text should make this false.',
    },
    is_help: {
      type: 'boolean',
      description: 'Whether the message is asking for help about eCash or cryptocurrency technology.',
    },
    needs_response: {
      type: 'boolean',
      description: 'Return true only when eChan is being asked a question. If the question is aimed at someone else or eChan is just mentioned in another conversation, return false.',
    },
    needs_tool: {
      type: 'boolean',
      description: 'Whether answering this request requires external or online access, such as browsing, fetching pages, or checking real-time systems.',
    },
    wants_latest_data: {
      type: 'boolean',
      description: 'Whether the request expects current online facts, news, prices, or other real-time information.',
    },
  },
  required: [
    'deviation',
    'suspicion',
    'inducement',
    'spam',
    'is_english',
    'is_help',
    'needs_response',
    'needs_tool',
    'wants_latest_data',
  ],
};

const MESSAGE_ANALYSIS_SYSTEM_PROMPT = [
  'Your name is eChan (@eChanAntiSpamBot).',
  'You are an AI moderator for eCash groups.',
  'Analyze the supplied Telegram message context and return only the structured result.',
  '',
  'Rules:',
  '- If the content includes XEC or eCash, it is allowed and not spam.',
  '- https://blitzchips.com/ is not spam.',
  '- https://agora.cash is not spam.',
  '- "Trump\'s coin" is most likely spam.',
  '- If someone is doubting eChan or challenging a factual claim, they likely want up-to-date information.',
  '- Prefer conservative moderation for eCash-native conversation.',
  '- Base the decision on the actual message context, quoted text, links, buttons, and visible media.',
].join('\n');

const NUMERIC_FIELDS = ['deviation', 'suspicion', 'inducement'];
const BOOLEAN_FIELDS = ['spam', 'is_english', 'is_help', 'needs_response', 'needs_tool', 'wants_latest_data'];

function buildAnalysisInstruction(query, options = {}) {
  const compatibilityMode = options.compatibilityMode === true;
  const instructionLines = [
    'Analyze this Telegram message context.',
  ];

  if (compatibilityMode) {
    instructionLines.push('Return exactly one JSON object. No markdown, no prose, no code fences.');
    instructionLines.push(`Use this exact schema and field set: ${JSON.stringify(MESSAGE_ANALYSIS_JSON_SCHEMA)}`);
  } else {
    instructionLines.push('Return only the JSON object that matches the provided schema.');
  }

  return [
    ...instructionLines,
    '',
    'Message context:',
    query,
  ].join('\n');
}

function normalizeImageUrls(imageUrls) {
  if (!imageUrls) return [];
  const list = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  return list.filter((url) => typeof url === 'string' && url.trim());
}

function buildMessageAnalysisMessages(query, imageUrls = [], options = {}) {
  const normalizedQuery = String(query || '').trim();
  const normalizedImageUrls = normalizeImageUrls(imageUrls);
  const userText = buildAnalysisInstruction(normalizedQuery, options);

  if (!normalizedImageUrls.length) {
    return [
      { role: 'system', content: MESSAGE_ANALYSIS_SYSTEM_PROMPT },
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
    { role: 'system', content: MESSAGE_ANALYSIS_SYSTEM_PROMPT },
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

function parseNumberField(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid numeric field: ${fieldName}`);
  }
  if (number < 0 || number > 100) {
    throw new Error(`Numeric field out of range: ${fieldName}`);
  }
  return number;
}

function normalizeMessageAnalysisResult(payload) {
  let parsed = payload;

  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch (_) {
      parsed = extractJsonObject(payload);
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Message analysis payload must be a JSON object');
  }

  const normalized = {};

  for (const fieldName of NUMERIC_FIELDS) {
    normalized[fieldName] = parseNumberField(parsed[fieldName], fieldName);
  }

  for (const fieldName of BOOLEAN_FIELDS) {
    normalized[fieldName] = parseBooleanField(parsed[fieldName], fieldName);
  }

  return normalized;
}

module.exports = {
  MESSAGE_ANALYSIS_JSON_SCHEMA,
  MESSAGE_ANALYSIS_SYSTEM_PROMPT,
  buildMessageAnalysisMessages,
  normalizeMessageAnalysisResult,
};
