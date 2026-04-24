import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                // The whitelist LevelDB integration tests use a shared on-disk DB path.
                // Running the suite in a single child process avoids cross-worker lock contention.
                singleFork: true,
            },
        },
        fileParallelism: false,
        server: {
            deps: {
                // Process these through Vite's transform pipeline so vi.mock
                // can intercept require() calls inside CJS modules.
                inline: [
                    /src\//,
                    /config\//,
                ],
            },
        },
        setupFiles: ['./tests/setup.js'],
    },
});
