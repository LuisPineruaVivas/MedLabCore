import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Set in Vercel. Without it (local builds) no source maps are generated or uploaded.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      workbox: {
        // Increase the limit to 4MB (4 * 1024 * 1024)
        maximumFileSizeToCacheInBytes: 4194304, 
      },
      includeAssets: ["favicon.ico", "favicon.png", "apple-touch-icon.png", "robots.txt"],
      manifest: {
        name: "MedLabCore",
        short_name: "MedLab",
        description: "Sistema de gestion para laboratorios clinicos.",
        theme_color: "#0ea5e9",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
    uploadSourceMaps &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: process.env.VERCEL_GIT_COMMIT_SHA },
        // Maps go to Sentry only; deleting them keeps the original source off the public site.
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
        telemetry: false,
      }),
  ],
  build: {
    sourcemap: uploadSourceMaps ? ("hidden" as const) : false,
  },
  define: {
    global: 'globalThis',
    "import.meta.env.VITE_DEPLOY_ENV": JSON.stringify(process.env.VERCEL_ENV ?? ""),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: 'buffer'
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
    force: true,
  },
}));
