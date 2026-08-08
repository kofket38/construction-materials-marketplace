import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "data-vendor": ["@tanstack/react-query", "axios", "zustand"],
          "form-vendor": [
            "@hookform/resolvers",
            "react-hook-form",
            "zod",
          ],
          "react-vendor": [
            "react",
            "react-dom",
            "react-router-dom",
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/.edge-*/**", "**/screenshots/**"],
    },
  },
  preview: {
    host: "localhost",
    port: 4173,
  },
});
