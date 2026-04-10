import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Module, { createRequire } from 'module';

const require = createRequire(import.meta.url);
const originalLoad = Module._load;

const paths = {
    handler: require.resolve('../../../src/application/usecases/sendHandler.js'),
    userAddressStore: require.resolve('../../../src/infrastructure/storage/userAddressStore.js'),
    addressUtils: require.resolve('../../../src/infrastructure/blockchain/addressUtils.js'),
    tokenInfo: require.resolve('../../../src/infrastructure/blockchain/tokenInfo.js'),
    tokenSender: require.resolve('../../../src/infrastructure/blockchain/tokenSender.js'),
};

const mocks = {
    getUserAddress: vi.fn(),
    ensureAddressWithFallback: vi.fn(),
    resolveTokenAlias: vi.fn(),
    getTokenInfo: vi.fn(),
    sendXec: vi.fn(),
    sendToken: vi.fn(),
    isMnemonicConfigured: vi.fn(),
};

function makeMsg(text) {
    return {
        text,
        chat: { id: -100, type: 'supergroup' },
        from: { id: 1, username: 'admin' },
        reply_to_message: {
            from: { id: 42, username: 'alice' },
        },
    };
}

describe('sendHandler', () => {
    let bot;
    let handleSendCommand;

    beforeEach(() => {
        vi.clearAllMocks();

        bot = {
            sendMessage: vi.fn().mockResolvedValue({ message_id: 99 }),
            editMessageText: vi.fn().mockResolvedValue({}),
        };

        mocks.getUserAddress.mockResolvedValue({ address: 'ecash:qraw', username: 'alice' });
        mocks.ensureAddressWithFallback.mockReturnValue('ecash:qnormalized');
        mocks.resolveTokenAlias.mockImplementation((value) => value);
        mocks.getTokenInfo.mockResolvedValue({
            decimals: 2,
            ticker: 'COR',
            name: 'Core',
            protocol: 'ALP',
        });
        mocks.isMnemonicConfigured.mockReturnValue(true);
        mocks.sendXec.mockResolvedValue({ txid: 'xec123' });
        mocks.sendToken.mockResolvedValue({ txid: 'tok123' });

        Module._load = function patchedLoad(request, parent, isMain) {
            const resolved = Module._resolveFilename(request, parent, isMain);

            if (resolved === paths.userAddressStore) {
                return { getUserAddress: mocks.getUserAddress };
            }
            if (resolved === paths.addressUtils) {
                return { ensureAddressWithFallback: mocks.ensureAddressWithFallback };
            }
            if (resolved === paths.tokenInfo) {
                return {
                    resolveTokenAlias: mocks.resolveTokenAlias,
                    getTokenInfo: mocks.getTokenInfo,
                };
            }
            if (resolved === paths.tokenSender) {
                return {
                    sendXec: mocks.sendXec,
                    sendToken: mocks.sendToken,
                    isMnemonicConfigured: mocks.isMnemonicConfigured,
                };
            }

            return originalLoad.call(this, request, parent, isMain);
        };

        delete require.cache[paths.handler];
        ({ handleSendCommand } = require(paths.handler));
    });

    afterEach(() => {
        Module._load = originalLoad;
        delete require.cache[paths.handler];
    });

    it('sends XEC using bigint satoshis for decimal user input', async () => {
        await handleSendCommand(makeMsg('/send 12.34'), bot);

        expect(mocks.sendXec).toHaveBeenCalledWith([
            { address: 'ecash:qnormalized', amount: 1234n },
        ]);
        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringContaining('12.34 XEC'),
            expect.objectContaining({
                chat_id: -100,
                message_id: 99,
            }),
        );
    });

    it('sends tokens via the latest unified sendToken api', async () => {
        mocks.resolveTokenAlias.mockReturnValue('a'.repeat(64));

        await handleSendCommand(makeMsg('/send oorah 1.25'), bot);

        expect(mocks.sendToken).toHaveBeenCalledWith(
            [{ address: 'ecash:qnormalized', amount: 125n }],
            'a'.repeat(64),
        );
        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringContaining('1.25 COR'),
            expect.objectContaining({
                chat_id: -100,
                message_id: 99,
            }),
        );
    });

    it('rejects token amounts that exceed token precision', async () => {
        await handleSendCommand(makeMsg('/send oorah 1.234'), bot);

        expect(mocks.sendToken).not.toHaveBeenCalled();
        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringContaining('Invalid amount'),
            expect.objectContaining({
                chat_id: -100,
                message_id: 99,
            }),
        );
    });
});
