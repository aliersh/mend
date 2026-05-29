import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Port 5173 is fixed so it matches the origin allowlisted in the Privy/Pimlico dashboards.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
