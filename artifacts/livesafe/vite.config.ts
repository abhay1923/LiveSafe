import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom", "react-leaflet", "leaflet"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-leaflet", "leaflet"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Match exact package folders. Substring checks such as
          // id.includes("react") also match react-leaflet, react-icons,
          // react-hook-form, etc., which pulled leaflet code into the React
          // chunk and created a circular map <-> react import at load time.
          const pkg = (name) => id.includes(`/node_modules/${name}/`) || id.includes(`/node_modules/.pnpm/${name}@`);
          if (pkg("react") || pkg("react-dom") || pkg("scheduler") || pkg("react-router-dom") || pkg("react-router")) return "react";
          if (pkg("lucide-react")) return "icons";
          if (pkg("leaflet") || pkg("react-leaflet")) return "map";
          if (pkg("recharts")) return "charts";
          if (pkg("motion") || pkg("framer-motion")) return "animation";
          if (pkg("@tanstack/react-query") || pkg("@tanstack/query-core")) return "data";
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
