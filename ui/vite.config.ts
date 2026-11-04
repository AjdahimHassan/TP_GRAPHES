import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// L'UI appelle l'API Python (http://127.0.0.1:8000) ; une fois construite, FastAPI sert ui/dist.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  build: { chunkSizeWarningLimit: 4000 },
})
