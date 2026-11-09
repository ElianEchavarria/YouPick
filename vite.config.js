import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true, // WebSockets must be turned on in the proxy
        secure: false,
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
});
