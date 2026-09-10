import { defineConfig } from 'vitest/config'

export const sharedConfig = defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
  },
})
