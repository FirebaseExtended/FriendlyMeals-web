import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  // Bridge Firebase App Hosting build-time env vars into both SSR and client bundles
  define: {
    __FIREBASE_WEBAPP_CONFIG__: JSON.stringify(
      process.env.FIREBASE_WEBAPP_CONFIG ?? ""
    ),
    __FIRESTORE_DATABASE_ID__: JSON.stringify(
      process.env.FIRESTORE_DATABASE_ID ?? ""
    ),
  },
  build: {
    sourcemap: "hidden",
  },
});
