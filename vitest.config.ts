import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Native-process fixtures and large browser bundles must fit on CI and developer laptops.
    maxWorkers: 2,
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
})
