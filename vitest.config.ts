import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/__tests__/**/*.test.ts'],
    cache: {
      dir: path.resolve(__dirname, 'node_modules/.vitest'),
    },
  },
  resolve: {
    alias: {
      '~/': path.resolve(__dirname) + '/',
    },
  },
})
