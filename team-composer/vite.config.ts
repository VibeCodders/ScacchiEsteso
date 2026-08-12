/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the built app as https://<user>.github.io/ScacchiEsteso/ — the dev
  // server (used locally and by the e2e tests) keeps serving from / so it's unaffected.
  base: command === 'build' ? '/ScacchiEsteso/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/setupTests.ts'],
    // Unit tests live under src/ only — keep the Playwright specs in e2e/ out of vitest.
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
