import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const resolveRepoMapboxToken = (): string => {
  const envFilePath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envFilePath)) {
    return "";
  }

  const envFile = fs.readFileSync(envFilePath, "utf8");
  const explicitFrontendToken = envFile.match(/^VITE_MAPBOX_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
  const sharedToken = envFile.match(/^MAPBOX_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
  return explicitFrontendToken || sharedToken || "";
};

const mapboxToken = resolveRepoMapboxToken();

export default defineConfig({
  envDir: "..",
  envPrefix: ["VITE_"],
  define: {
    "__MAPBOX_TOKEN__": JSON.stringify(mapboxToken),
    "import.meta.env.VITE_MAPBOX_ACCESS_TOKEN": JSON.stringify(mapboxToken),
  },
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/mapbox-gl")) {
            return "mapbox-vendor";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
