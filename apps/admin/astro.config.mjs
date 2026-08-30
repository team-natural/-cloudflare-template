import path from "node:path";
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        $lib: path.resolve("./src/lib"),
      },
    },
  },
  server: {
    host: true,
    port: Number(process.env.APP_PORT_DEV_ADMIN ?? 5174),
  },
});
