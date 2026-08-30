import { vitePreprocess } from "@astrojs/svelte";

// Picked up by vite-plugin-svelte (astro dev/build) and by eslint-plugin-svelte
// via parserOptions.svelteConfig in the root eslint.config.js.
export default {
  preprocess: vitePreprocess(),
};
