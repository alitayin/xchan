// Test setup file - runs before all tests
import { afterEach, beforeEach, vi } from 'vitest';
import os from 'os';
import path from 'path';

if (!process.env.WHITELIST_KEYWORD_DB_PATH) {
    process.env.WHITELIST_KEYWORD_DB_PATH = path.join(
        os.tmpdir(),
        'xecbot-vitest',
        `whitelistKeywords-${process.pid}`
    );
}

const LEVEL_TEARDOWN_PATTERNS = [
    'LEVEL_DATABASE_NOT_OPEN',
    'LEVEL_LOCKED',
    'Database is not open',
];

function isIgnorableLevelTeardownError(reason) {
    const reasonStr = String(reason);
    return LEVEL_TEARDOWN_PATTERNS.some(pattern => reasonStr.includes(pattern));
}

process.on('unhandledRejection', (reason) => {
    // Ignore LevelDB cleanup errors - they're harmless race conditions in test teardown
    if (isIgnorableLevelTeardownError(reason)) {
        return;
    }
    // Re-throw other unhandled rejections
    throw reason;
});

beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});
