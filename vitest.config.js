import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        deps: {
            // Process these through Vite's transform pipeline so vi.mock
            // can intercept require() calls inside CJS modules.
            inline: [
                /src\//,
                /config\//,
            ],
        },
    },
});
