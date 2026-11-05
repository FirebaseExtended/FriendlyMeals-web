import { useState } from "react";
import { href, useNavigate } from "react-router";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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

  const showFormBody = !previewRecipe || isInputExpanded;

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <div
        className={cn(
          "bg-card border rounded-xl overflow-hidden shadow-xs",
          isSsr && "ssr"
        )}
      >
        {previewRecipe ? (
          <button
            type="button"
            aria-expanded={isInputExpanded}
            onClick={() => setIsInputExpanded(!isInputExpanded)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium shrink-0">Generate New Recipe</span>
              {!isInputExpanded && lastPrompt && (
                <span className="truncate text-xs text-muted-foreground">
                  •{" "}
                  {lastPrompt.cuisineType ? `${lastPrompt.cuisineType}: ` : ""}
                  {lastPrompt.ingredients}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
              <span>{isInputExpanded ? "Hide" : "Edit"}</span>
              {isInputExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-5 py-4">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h1 className="font-semibold text-foreground">
              Generate New Recipe
            </h1>
          </div>
        )}

        <div
          className={cn(
            "p-5 border-t bg-muted/10 space-y-4",
            !showFormBody && "hidden"
          )}
        >
          <IngredientInput
            isLoading={loadingMessage || false}
            submitDisabled={!authReady || !user}
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
      </div>

      {previewRecipe && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40 px-4 py-3">
            <div className="text-sm">
              <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                Draft recipe ready
              </span>
              <span className="hidden sm:inline text-emerald-800/80 dark:text-emerald-300/80">
                {" "}
                • Review below and save it to the community cookbook.
              </span>
            </div>
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

          <RecipeDetail recipe={previewRecipe} readonly />
        </div>
      )}
    </div>
  );
}
