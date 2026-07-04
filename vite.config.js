import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function formatBuildDate(date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_DATE__: JSON.stringify(formatBuildDate(new Date())),
  },
})
