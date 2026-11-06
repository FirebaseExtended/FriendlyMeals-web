import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { transform } from "oxc-transform-react";
import { defineConfig, type Plugin } from "vite";

// Runs Oxc's Rust port of React Compiler before Vite's JSX transform and
// React Router's route-splitting / Fast Refresh transforms.
function oxcReactCompiler(): Plugin {
  return {
    name: "oxc-react-compiler",
    enforce: "pre",
    config() {
      return {
        optimizeDeps: {
          entries: ["app/**/*.{ts,tsx}"],
          include: ["react/compiler-runtime"],
        },
      };
    },
    transform: {
      filter: {
        id: {
          include: /\.[jt]sx?$/,
          exclude: /[/\\]node_modules[/\\]/,
        },
        code: /forwardRef|memo|\b(?:[A-Z]|use[A-Z0-9])/,
      },
      async handler(code, id) {
        if (this.environment?.config.consumer === "server") return;
        const [filepath] = id.split("?");
        const result = await transform(filepath, code, {
          jsx: "preserve",
          reactCompiler: { target: "19" },
          sourcemap:
            this.environment?.config.command !== "build" ||
            Boolean(this.environment?.config.build.sourcemap),
        });
        if (result.fatal) {
          const message = result.errors
            .map((err) => `${err.message}${err.codeframe ? `\n${err.codeframe}` : ""}`)
            .join("\n\n");
          this.error(message || "Oxc React Compiler transform failed.");
        }
        return {
          code: result.code,
          map: result.map,
        };
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [oxcReactCompiler(), tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    sourcemap: "hidden",
  },
});
