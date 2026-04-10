// Test setup file - runs before all tests

// Handle LevelDB unhandled rejections during test teardown
// These happen when tests close the database while other async operations are pending
process.on('unhandledRejection', (reason, promise) => {
    const reasonStr = String(reason);
    // Ignore LevelDB cleanup errors - they're harmless race conditions in test teardown
    if (
        reasonStr.includes('LEVEL_DATABASE_NOT_OPEN') ||
        reasonStr.includes('LEVEL_LOCKED') ||
        reasonStr.includes('Database is not open')
    ) {
        return;
    }
    // Re-throw other unhandled rejections
    throw reason;
});
