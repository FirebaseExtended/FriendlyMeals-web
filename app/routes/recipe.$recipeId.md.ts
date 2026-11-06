import type { Route } from "./+types/recipe.$recipeId.md";
import { formatRecipeMarkdown, getRecipe } from "@/firebase/data";

/**
 * Componentless resource route serving raw Markdown at `/recipes/:recipeId.md`
 * for AI agents, CLI tools (`curl`), and direct downloads.
 */
export async function loader({ params }: Route.LoaderArgs) {
  if (!params.recipeId) {
    return new Response("Recipe ID is required\n", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const recipe = await getRecipe(params.recipeId);
  if (!recipe) {
    return new Response("Recipe not found\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(formatRecipeMarkdown(recipe), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
