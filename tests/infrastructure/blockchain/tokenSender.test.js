import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Module, { createRequire } from 'module';

const require = createRequire(import.meta.url);
const originalLoad = Module._load;

const paths = {
    tokenSender: require.resolve('../../../src/infrastructure/blockchain/tokenSender.js'),
    config: require.resolve('../../../config/config.js'),
    quicksendClient: require.resolve('../../../src/infrastructure/blockchain/quicksendClient.js'),
};

describe('tokenSender', () => {
    const originalMnemonic = process.env.MNEMONIC;
    const ChronikClient = vi.fn();
    const quicksendApi = {
        sendXec: vi.fn(),
        sendToken: vi.fn(),
    };
    let tokenSender;

    beforeEach(() => {
        process.env.MNEMONIC = 'test mnemonic words';
        vi.clearAllMocks();

        ChronikClient.mockImplementation((urls) => ({ urls, kind: 'chronik' }));
        quicksendApi.sendXec.mockResolvedValue({ txid: 'xec-txid' });
        quicksendApi.sendToken.mockResolvedValue({ txid: 'token-txid' });

        Module._load = function patchedLoad(request, parent, isMain) {
            if (request === 'chronik-client') {
                return { ChronikClient };
            }

            const resolved = Module._resolveFilename(request, parent, isMain);
            if (resolved === paths.config) {
                return {
                    CHRONIK_URLS: ['https://chronik1.example', 'https://chronik2.example'],
                };
            }
            if (resolved === paths.quicksendClient) {
                return {
                    getQuicksendApi: vi.fn().mockResolvedValue(quicksendApi),
                };
            }

            return originalLoad.call(this, request, parent, isMain);
        };

        delete require.cache[paths.tokenSender];
        tokenSender = require(paths.tokenSender);
    });

    afterEach(() => {
        Module._load = originalLoad;
        delete require.cache[paths.tokenSender];

        if (originalMnemonic === undefined) {
            delete process.env.MNEMONIC;
        } else {
            process.env.MNEMONIC = originalMnemonic;
        }
    });

    it('uses dynamic import compatible sendXec with bigint recipients', async () => {
        const recipients = [{ address: 'ecash:qtest', amount: 1234n }];

        await expect(tokenSender.sendXec(recipients)).resolves.toEqual({ txid: 'xec-txid' });

        expect(ChronikClient).toHaveBeenCalledWith(['https://chronik1.example', 'https://chronik2.example']);
        expect(quicksendApi.sendXec).toHaveBeenCalledWith(
            recipients,
            expect.objectContaining({
                mnemonic: 'test mnemonic words',
                chronik: { urls: ['https://chronik1.example', 'https://chronik2.example'], kind: 'chronik' },
            }),
        );
    });

    it('uses latest unified sendToken api with bigint recipients', async () => {
        const recipients = [{ address: 'ecash:qtoken', amount: 250n }];

        await expect(tokenSender.sendToken(recipients, 'a'.repeat(64))).resolves.toEqual({ txid: 'token-txid' });

        expect(quicksendApi.sendToken).toHaveBeenCalledWith(
            recipients,
            expect.objectContaining({
                tokenId: 'a'.repeat(64),
                mnemonic: 'test mnemonic words',
                chronik: { urls: ['https://chronik1.example', 'https://chronik2.example'], kind: 'chronik' },
            }),
        );
    });

    it('rejects non-bigint recipients before calling quicksend', async () => {
        await expect(
            tokenSender.sendToken([{ address: 'ecash:qbad', amount: 1 }], 'b'.repeat(64)),
        ).rejects.toThrow(/bigint/i);

        expect(quicksendApi.sendToken).not.toHaveBeenCalled();
    });
});
