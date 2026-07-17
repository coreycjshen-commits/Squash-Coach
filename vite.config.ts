/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devApiPlugin } from './dev/devApiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
