import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/mp-tick-util/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
