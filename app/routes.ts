import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  // Landing page
  index("routes/home.tsx"),

  // Componentless Markdown resource route for agents and curl
  route("recipes/:recipeId.md", "routes/recipe.$recipeId.md.ts"),

  // Main application shell
  layout("components/Layout.tsx", [
    route("login", "routes/login.tsx"),
    route("recipes", "routes/recipes.tsx"),
    route("recipes/:recipeId", "routes/recipe.$recipeId.tsx"),

    // Client-guarded routes (Firebase Auth lives in browser IndexedDB)
    layout("routes/_protected.tsx", [
      route("generate", "routes/generate.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
