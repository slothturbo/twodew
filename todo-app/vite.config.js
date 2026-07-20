import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the dependencies that never change into their own chunks. Previously
        // everything was one hashed bundle, so shipping a one-line app change forced a
        // full re-download of React + Supabase (~250KB) that hadn't changed at all.
        // Split out, those stay in the browser cache across deploys.
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: {
    host: true, // Allow local network access for localhost monitoring
    port: 5173,
    strictPort: true,
    open: true, // Auto-open browser on dev start
  },
});