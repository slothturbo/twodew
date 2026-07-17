import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow local network access for localhost monitoring
    port: 5173,
    strictPort: true,
    open: true, // Auto-open browser on dev start
  },
});