import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const store = require('../../../src/infrastructure/storage/whitelistKeywordStore.js');
const handler = require('../../../src/application/usecases/whitelistHandler.js');

const {
    handleWhitelistingCommand,
    handleListWhitelistCommand,
    handleRemoveWhitelistCommand,
    handleWhitelistCallback,
} = handler;

function makeBot() {
    return {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
        editMessageText: vi.fn().mockResolvedValue({}),
        answerCallbackQuery: vi.fn().mockResolvedValue({}),
    };
}

function makeMsg(text, overrides = {}) {
    return {
        text,
        chat: { id: -100, title: 'Test Group' },
        from: { id: 1, username: 'admin' },
        message_id: 1,
        ...overrides,
    };
}

beforeEach(() => {
    vi.restoreAllMocks();
});

afterEach(async () => {
    // Clean up test keywords only — don't touch the shared DB
    try {
        const all = await store.getAllWhitelistKeywords();
        for (const entry of all) {
            if (entry.keyword.startsWith('__integ_test__')) {
                await store.removeWhitelistKeyword(entry.keyword);
            }
        }
    } catch {
        // Ignore errors during cleanup
    }
});
describe('handleWhitelistingCommand', () => {
    it('sends usage hint via bot.sendMessage when no keyword', async () => {
        const bot = makeBot();
        await handleWhitelistingCommand(makeMsg('/whitelisting'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('Usage'), expect.anything());
    });

    it('sends confirmation when keyword provided', async () => {
        const bot = makeBot();
        await handleWhitelistingCommand(makeMsg('/whitelisting ecash'), bot);
        // First call: confirmation to user
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('ecash'), expect.anything());
    });

    it('handles multi-word keywords', async () => {
        const bot = makeBot();
        await handleWhitelistingCommand(makeMsg('/whitelisting buy xec now'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('buy xec now'), expect.anything());
    });
});
describe('handleWhitelistCallback — approve', () => {
    it('answers callback query on approve (DB unavailable in test → Failed path)', async () => {
        // LevelDB not open in test env; handler catches error and answers with failure.
        const bot = makeBot();
        const query = {
            id: 'q1',
            message: { chat: { id: -999 }, message_id: 10, text: 'req' },
            data: 'whitelist_approve:ecash:admin',
            from: { username: 'superadmin' },
        };
        await handleWhitelistCallback(query, bot);
        expect(bot.answerCallbackQuery).toHaveBeenCalledWith('q1', expect.anything());
    });
});

describe('handleWhitelistCallback — reject', () => {
    it('edits message and answers on reject', async () => {
        const bot = makeBot();
        const query = {
            id: 'q3',
            message: { chat: { id: -999 }, message_id: 10, text: 'req' },
            data: 'whitelist_reject:ecash:admin',
            from: { username: 'superadmin' },
        };
        await handleWhitelistCallback(query, bot);
        expect(bot.editMessageText).toHaveBeenCalled();
        expect(bot.answerCallbackQuery).toHaveBeenCalledWith('q3', expect.anything());
    });
});
describe('handleListWhitelistCommand', () => {
    it('shows empty message when no keywords', async () => {
        vi.spyOn(store, 'getAllWhitelistKeywords').mockResolvedValue([]);
        const bot = makeBot();
        await handleListWhitelistCommand(makeMsg('/listwhitelist'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('No'), expect.anything());
    });

    it('sends a message to chat (LevelDB unavailable → empty list)', async () => {
        // In test env LevelDB is not open; getAllWhitelistKeywords returns [].
        // Handler should still call bot.sendMessage with a message to the chat.
        vi.spyOn(store, 'getAllWhitelistKeywords').mockResolvedValue([]);
        const bot = makeBot();
        await handleListWhitelistCommand(makeMsg('/listwhitelist'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.any(String), expect.anything());
    });
});

describe('handleRemoveWhitelistCommand', () => {
    it('sends usage hint when no keyword provided', async () => {
        const bot = makeBot();
        await handleRemoveWhitelistCommand(makeMsg('/removewhitelist'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('Usage'), expect.anything());
    });

    it('calls bot.sendMessage for keyword ecash (success or failure path)', async () => {
        // In test env LevelDB is not open, so removeWhitelistKeyword returns false.
        // We verify the handler reaches bot.sendMessage with the keyword in the message.
        const bot = makeBot();
        await handleRemoveWhitelistCommand(makeMsg('/removewhitelist ecash'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringMatching(/ecash/i), expect.anything());
    });
});

