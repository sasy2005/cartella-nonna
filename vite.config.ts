import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" così funziona anche in una sottocartella (GitHub Pages)
export default defineConfig({ base: "./", plugins: [react()] });
