import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /** Match preview default so localStorage (localhost:4173) lines up with `npm run dev`. */
  server: {
    port: 4173,
  },
  preview: {
    port: 4173,
  },
});
