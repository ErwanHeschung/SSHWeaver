import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const resolve = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(),],

  // Keep these in sync with the `paths` in tsconfig.json.
  resolve: {
    alias: {
      "@": resolve("./src"),
      "@repositories": resolve("./src/repositories"),
      "@hooks": resolve("./src/hooks"),
      "@services": resolve("./src/services"),
      "@screens": resolve("./src/screens"),
      "@components": resolve("./src/components"),
      "@utils": resolve("./src/utils"),
      "@theme": resolve("./src/theme"),
      "@types": resolve("./src/types"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
