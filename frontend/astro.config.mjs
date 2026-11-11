// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://arrazy.com",
  integrations: [react()],
  // Same port as before, so the backend's CORS list (localhost:5173) still allows the dev server
  server: { port: 5173 },
  // Keep line breaks between words and links in .astro files as normal spaces
  compressHTML: false,
  // Load the next page in the background when a link is hovered, so moving around feels instant
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
});
