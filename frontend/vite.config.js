import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
    },
    build: {
      outDir: "dist",
      sourcemap: env.VITE_SOURCE_MAPS === "true",
      rollupOptions: {
        input: {
          app: resolve(import.meta.dirname, "index.html"),
          privacy: resolve(import.meta.dirname, "privacy.html"),
          terms: resolve(import.meta.dirname, "terms.html"),
          accountDeletionStatus: resolve(import.meta.dirname, "account-deletion-status.html"),
        },
      },
    },
  };
});
