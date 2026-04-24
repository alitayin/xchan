import { createRequire } from 'module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { getImageUrls } = require('../../../src/infrastructure/telegram/mediaHelper.js');

describe('mediaHelper', () => {
    it('redacts Telegram bot token in photo URL logs while returning the original URL', async () => {
        const originalUrl = 'https://api.telegram.org/file/bot123456:SECRET/photos/file.jpg';
        const bot = {
            getFileLink: vi.fn().mockResolvedValue(originalUrl),
        };
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const urls = await getImageUrls({
            photo: [{ file_id: 'small' }, { file_id: 'large' }],
        }, bot);

        expect(urls).toEqual([originalUrl]);
        expect(logSpy).toHaveBeenCalledWith(
            'Found photo in message: https://api.telegram.org/file/bot<redacted>/photos/file.jpg'
        );
    });
});
