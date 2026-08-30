import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    host: true,
    port: Number(process.env.APP_PORT_DEV_PUBLIC ?? 5173),
  },
});
