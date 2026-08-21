import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "mobile",
  publicDir: "../public",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../mobile-dist",
    emptyOutDir: true,
  },
});
