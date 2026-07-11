import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function getBuildId() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(getBuildId()),
  },
})
