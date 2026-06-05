import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite is the tool that runs the dev server and bundles the app.
// The react() plugin teaches Vite how to understand React (.jsx) files.
export default defineConfig({
  plugins: [react()],
  define: {
    // Stamped at build time; shown in Settings for support/debugging.
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
});
