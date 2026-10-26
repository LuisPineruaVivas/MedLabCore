import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import fs from "fs";

/**
 * The security headers from vercel.json, for `vite preview`, so they can be tested
 * locally. The CSP is enforced here (it is report-only on Vercel until checked), and
 * a non-Supabase-cloud backend (the local stack) is added to connect-src and img-src.
 */
function vercelSecurityHeaders(supabaseUrl: string | undefined): Record<string, string> {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "vercel.json"), "utf8")) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };
  const headers: Record<string, string> = {};
  for (const { key, value } of config.headers.find((rule) => rule.source === "/(.*)")?.headers ?? []) {
    if (key === "Strict-Transport-Security") continue; // localhost is plain http
    if (key === "Content-Security-Policy-Report-Only") {
      let csp = value;
      if (supabaseUrl && !/\.supabase\.co$/.test(new URL(supabaseUrl).hostname)) {
        const origin = new URL(supabaseUrl).origin;
        const ws = origin.replace(/^http/, "ws");
        csp = csp.replace("connect-src 'self'", `connect-src 'self' ${origin} ${ws}`).replace("img-src 'self'", `img-src 'self' ${origin}`);
      }
      headers["Content-Security-Policy"] = csp;
    } else {
      headers[key] = value;
    }
  }
  return headers;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  preview: {
    headers: vercelSecurityHeaders(loadEnv(mode, process.cwd(), "").VITE_SUPABASE_URL),
  },
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
  ],
  define: {
    global: 'globalThis',
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
