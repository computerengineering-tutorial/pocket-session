import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { crx } from "@crxjs/vite-plugin"
import manifest from "./manifest.json"
import path from "path"

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: [
      { find: /^~/, replacement: path.resolve(__dirname, "./src") + "/" },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === "INVALID_ANNOTATION") return
        defaultHandler(warning)
      },
    },
  },
})

