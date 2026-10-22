import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    // Native-process fixtures and large browser bundles must fit on CI and developer laptops.
    maxWorkers: 2,
    // These upstream suites need their fixed source-mode test support and run
    // separately through vitest.upstream-ui.config.ts in every CI platform.
    exclude: [...configDefaults.exclude, 'packages/client-ui-*/tests/**', 'benchmark/**'],
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
})
