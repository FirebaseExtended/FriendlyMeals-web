import { useState } from "react";
import { href, useNavigate } from "react-router";
import { Sparkles } from "lucide-react";
import { IngredientInput } from "@/components/IngredientInput";
import RecipeDetail from "@/components/Recipe";
import { Button } from "@/components/ui/button";
import { generateStructuredJsonRecipe } from "@/firebase/firebaseAILogic";
import {
  publishRecipe,
  type NewRecipeInput,
  type Recipe,
} from "@/firebase/data";
import { useAuthUser, waitForAuthReady } from "@/firebase/auth";
import { reportClientError } from "@/firebase/crashlytics";
import { useWasServerRendered } from "@/lib/ssr";
import { cn } from "@/lib/utils";

export function meta() {
  return [
    { title: "Generate Recipe - Friendly Meals" },
    { name: "description", content: "Generate a new recipe with Gemini" },
  ];
}

export default function GeneratePage() {
  const isSsr = useWasServerRendered();
  const { user, authReady } = useAuthUser();
  const [loadingMessage, setLoadingMessage] = useState<
    "Generating recipe" | "Publishing recipe" | null
  >(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<NewRecipeInput | null>(
    null
  );
  const [lastPrompt, setLastPrompt] = useState<{
    ingredients: string;
    cuisineType: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const navigate = useNavigate();

  const handleGenerateRecipe = async (
    ingredients: string,
    cuisineType: string
  ) => {
    const trimmedIngredients = ingredients.trim();
    if (!trimmedIngredients) {
      setErrorMessage("Enter at least a couple of ingredients first.");
      return;
    }

    try {
      setErrorMessage(null);
      setLoadingMessage("Generating recipe");
      const recipe = await generateStructuredJsonRecipe(
        trimmedIngredients,
        cuisineType
      );
      setGeneratedRecipe(recipe);
      setLastPrompt({ ingredients: trimmedIngredients, cuisineType });
      setIsInputExpanded(false);
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

    const uid = user?.uid ?? (await waitForAuthReady())?.uid;
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
        authorId: user?.uid ?? "",
        averageRating: 0,
        likes: 0,
      }
    : null;

  const showComposer = !previewRecipe || isInputExpanded;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <section
        className={cn(
          "space-y-5",
          !previewRecipe && "pt-4 sm:pt-8",
          !showComposer && "hidden"
        )}
      >
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {previewRecipe ? "Refine your recipe" : "What's in your kitchen?"}
          </h1>
          {!previewRecipe && (
            <p className="text-sm sm:text-base text-muted-foreground">
              List the ingredients you have on hand and Gemini will put together
              a home-cooked recipe.
            </p>
          )}
        </div>

        <IngredientInput
          isLoading={loadingMessage || false}
          submitDisabled={!authReady || !user}
          hasPreview={Boolean(previewRecipe)}
          onCancelEdit={() => setIsInputExpanded(false)}
          ssr={isSsr}
          handleSubmit={handleGenerateRecipe}
        />

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}
      </section>

      {previewRecipe && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-emerald-950 dark:text-emerald-200 shrink-0">
                Draft ready
              </span>
              {!isInputExpanded && lastPrompt && (
                <span className="hidden sm:inline truncate text-emerald-800/80 dark:text-emerald-300/80">
                  •{" "}
                  {lastPrompt.cuisineType ? `${lastPrompt.cuisineType}: ` : ""}
                  {lastPrompt.ingredients}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {!isInputExpanded && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsInputExpanded(true)}
                  className="h-8 px-2.5 text-emerald-900 hover:bg-emerald-100/80 hover:text-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                >
                  Edit prompt
                </Button>
              )}
              <Button
                onClick={handlePublish}
                disabled={loadingMessage === "Publishing recipe"}
                size="sm"
              >
                {loadingMessage === "Publishing recipe"
                  ? "Publishing..."
                  : "Publish to Cookbook"}
              </Button>
            </div>
          </div>

          {!showComposer && errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <RecipeDetail recipe={previewRecipe} readonly />
        </div>
      )}
    </div>
  );
}
