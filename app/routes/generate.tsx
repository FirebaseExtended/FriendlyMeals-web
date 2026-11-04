import { useState } from "react";
import { href, useNavigate, useRouteLoaderData } from "react-router";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { IngredientInput } from "@/components/IngredientInput";
import RecipeDetail from "@/components/Recipe";
import { Button } from "@/components/ui/button";
import type { clientLoader as protectedClientLoader } from "./_protected";
import { generateStructuredJsonRecipe } from "@/firebase/firebaseAILogic";
import {
  publishRecipe,
  type NewRecipeInput,
  type Recipe,
} from "@/firebase/data";
import { waitForAuthReady } from "@/firebase/auth";
import { reportClientError } from "@/firebase/crashlytics";

export function meta() {
  return [
    { title: "Generate Recipe - Friendly Meals" },
    { name: "description", content: "Generate a new recipe with Gemini" },
  ];
}

export default function GeneratePage() {
  const protectedData =
    useRouteLoaderData<typeof protectedClientLoader>("routes/_protected");
  const [loadingMessage, setLoadingMessage] = useState<
    "Generating recipe" | "Publishing recipe" | null
  >(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<NewRecipeInput | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const navigate = useNavigate();

  const handleGenerateRecipe = async (
    ingredients: string,
    cuisineType: string
  ) => {
    if (!ingredients.trim()) {
      setErrorMessage("Enter at least a couple of ingredients first.");
      return;
    }

    try {
      setErrorMessage(null);
      setLoadingMessage("Generating recipe");
      const recipe = await generateStructuredJsonRecipe(
        ingredients,
        cuisineType
      );
      setGeneratedRecipe(recipe);
    } catch (error) {
      reportClientError(error, { action: "generateStructuredJsonRecipe" });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to generate recipe. Check your Firebase AI Logic setup."
      );
    } finally {
      setLoadingMessage(null);
    }
  };

  const handlePublish = async () => {
    if (!generatedRecipe) return;

    const uid = protectedData?.user.uid ?? (await waitForAuthReady())?.uid;
    if (!uid) {
      navigate(
        `${href("/login")}?redirectTo=${encodeURIComponent(href("/generate"))}`
      );
      return;
    }

    try {
      setErrorMessage(null);
      setLoadingMessage("Publishing recipe");
      const savedRecipeId = await publishRecipe(uid, generatedRecipe);
      navigate(href("/recipes/:recipeId", { recipeId: savedRecipeId }));
    } catch (error) {
      reportClientError(error, { action: "publishRecipe" });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to publish recipe to Firestore."
      );
      setLoadingMessage(null);
    }
  };

  const previewRecipe: Recipe | null = generatedRecipe
    ? {
        ...generatedRecipe,
        id: "preview",
        authorId: protectedData?.user.uid ?? "",
        averageRating: 0,
        likes: 0,
      }
    : null;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4">
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsInputExpanded(!isInputExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">Generate New Recipe</span>
          </div>
          {isInputExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {isInputExpanded && (
          <div className="p-4 border-t bg-muted/10 space-y-4">
            <IngredientInput
              isLoading={loadingMessage || false}
              handleSubmit={handleGenerateRecipe}
            />
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {previewRecipe && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <RecipeDetail recipe={previewRecipe} readonly />
          <div className="flex justify-center mt-8 pb-12">
            <Button
              onClick={handlePublish}
              disabled={loadingMessage === "Publishing recipe"}
              size="lg"
              className="shadow-lg bg-emerald-600 hover:bg-emerald-700 min-w-[200px] cursor-pointer"
            >
              {loadingMessage === "Publishing recipe"
                ? "Publishing..."
                : "Publish to Cookbook"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
