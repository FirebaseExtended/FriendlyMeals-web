import { useState } from "react";
import {
  data,
  href,
  Link,
  redirect,
  useFetcher,
  useSearchParams,
} from "react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { Route } from "./+types/generate";
import { IngredientInput } from "@/components/IngredientInput";
import RecipeDetail from "@/components/Recipe";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { generateStructuredJsonRecipe } from "@/firebase/firebaseAILogic.client";
import {
  publishRecipe,
  type NewRecipeInput,
  type Recipe,
} from "@/firebase/data";
import { useAuthUser, getUser } from "@/firebase/auth";
import { cn } from "@/lib/utils";

export const handle = { hideHeader: true };

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const user = await getUser();
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = `${url.pathname}${url.search}`;
    throw redirect(
      `${href("/login")}?redirectTo=${encodeURIComponent(redirectTo)}`
    );
  }
  return null;
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="flex items-center gap-2 rounded-md px-6 py-4 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        <span>Loading generator...</span>
      </div>
    </div>
  );
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const user = await getUser();
  if (!user) {
    return redirect(
      `${href("/login")}?redirectTo=${encodeURIComponent(href("/generate"))}`
    );
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "publish") {
    return data({ ok: false, error: "Unsupported action." }, { status: 400 });
  }

  const rawRecipe = formData.get("recipe");
  if (typeof rawRecipe !== "string") {
    return data({ ok: false, error: "Missing recipe draft." }, { status: 400 });
  }

  try {
    const recipe = JSON.parse(rawRecipe) as NewRecipeInput;
    const savedRecipeId = await publishRecipe(user.uid, recipe);
    return redirect(href("/recipes/:recipeId", { recipeId: savedRecipeId }));
  } catch (error) {
    console.error("[publishRecipe]", error);
    return data(
      {
        ok: false,
        error: "Couldn't publish your recipe right now. Please try again.",
      },
      { status: 500 }
    );
  }
}

export function meta() {
  return [
    { title: "Generate Recipe - Friendly Meals" },
    { name: "description", content: "Generate a new recipe with Gemini" },
  ];
}

function formatGenerationError(error: unknown): string {
  if (error instanceof SyntaxError) {
    return "Gemini returned an incomplete recipe response. Please try again.";
  }
  if (
    error instanceof Error &&
    error.message.startsWith("Recipe generation incomplete")
  ) {
    return "Gemini couldn't finish writing that recipe. Try again or use a shorter ingredient list.";
  }
  return "Couldn't generate a recipe right now. Please try again in a moment.";
}

function RecipeSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Generating recipe"
      className="w-full overflow-hidden rounded-md border bg-card shadow-xs"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-primary/85 via-[#FF9100]/75 to-[#FFC400]/80 opacity-60" />
      <div className="space-y-6 p-6 sm:p-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-8 w-2/3 rounded-md bg-muted" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-md bg-muted" />
            <div className="h-5 w-20 rounded-md bg-muted" />
            <div className="h-5 w-14 rounded-md bg-muted" />
          </div>
        </div>
        <div className="flex gap-6 border-y border-border/60 py-3.5">
          <div className="h-4 w-20 rounded-md bg-muted" />
          <div className="h-4 w-20 rounded-md bg-muted" />
          <div className="h-4 w-16 rounded-md bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-5 w-28 rounded-md bg-muted" />
          <div className="space-y-2.5">
            <div className="h-4 w-5/6 rounded-md bg-muted" />
            <div className="h-4 w-3/4 rounded-md bg-muted" />
            <div className="h-4 w-4/5 rounded-md bg-muted" />
            <div className="h-4 w-2/3 rounded-md bg-muted" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-5 w-28 rounded-md bg-muted" />
          <div className="space-y-3">
            <div className="h-14 w-full rounded-md bg-muted" />
            <div className="h-14 w-full rounded-md bg-muted" />
            <div className="h-14 w-11/12 rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const user = useAuthUser();
  const [searchParams] = useSearchParams();
  const prefillIngredients = searchParams.get("ingredients")?.trim() ?? "";

  const [prevPrefill, setPrevPrefill] = useState(prefillIngredients);
  const [ingredients, setIngredients] = useState(prefillIngredients);
  const [cuisineType, setCuisineType] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<NewRecipeInput | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInputExpanded, setIsInputExpanded] = useState(true);

  if (prevPrefill !== prefillIngredients) {
    setPrevPrefill(prefillIngredients);
    setIngredients(prefillIngredients);
  }

  const publishFetcher = useFetcher<typeof clientAction>();
  const isPublishing = publishFetcher.state !== "idle";
  const isBusy = isGenerating || isPublishing;

  const activeError =
    errorMessage ??
    (publishFetcher.state === "idle" ? publishFetcher.data?.error : null) ??
    null;

  const handleGenerateRecipe = async () => {
    const trimmedIngredients = ingredients.trim();
    if (!trimmedIngredients || isBusy) {
      return;
    }

    try {
      setErrorMessage(null);
      publishFetcher.reset();
      setIsGenerating(true);
      const recipe = await generateStructuredJsonRecipe(
        trimmedIngredients,
        cuisineType
      );
      setGeneratedRecipe(recipe);
      setIsInputExpanded(false);
    } catch (error) {
      console.error("[generateStructuredJsonRecipe]", error);
      setErrorMessage(formatGenerationError(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTryAgain = () => {
    if (isBusy) return;
    if (!ingredients.trim()) {
      setIsInputExpanded(true);
      return;
    }
    void handleGenerateRecipe();
  };

  const handlePublish = () => {
    if (!generatedRecipe || isBusy) return;
    setErrorMessage(null);
    void publishFetcher.submit(
      { intent: "publish", recipe: JSON.stringify(generatedRecipe) },
      { method: "post" }
    );
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
  const trimmedPrompt = ingredients.trim();

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <nav aria-label="Breadcrumb">
        <Link
          to={href("/recipes")}
          prefetch="intent"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          <span>Back to recipes</span>
        </Link>
      </nav>

      {showComposer && (
        <section
          className={cn(
            "space-y-5",
            !previewRecipe && !isGenerating && "pt-1 sm:pt-3"
          )}
        >
          <div className="space-y-1.5">
            <h1 className="font-display text-3xl sm:text-4xl font-normal text-foreground">
              {previewRecipe ? "Refine your recipe" : "What's in your kitchen?"}
            </h1>
            {!previewRecipe && (
              <p className="text-sm sm:text-base text-muted-foreground">
                List the ingredients you have on hand and Gemini will put
                together a home-cooked recipe.
              </p>
            )}
          </div>

          <IngredientInput
            ingredients={ingredients}
            onIngredientsChange={setIngredients}
            cuisineType={cuisineType}
            onCuisineTypeChange={setCuisineType}
            isLoading={isGenerating ? "Generating recipe" : false}
            submitDisabled={!user || isPublishing}
            hasPreview={Boolean(previewRecipe)}
            onCancelEdit={() => setIsInputExpanded(false)}
            handleSubmit={() => void handleGenerateRecipe()}
          />
        </section>
      )}

      {activeError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {activeError}
        </div>
      )}

      {showComposer && isGenerating && <RecipeSkeleton />}

      {previewRecipe && !(showComposer && isGenerating) && (
        <section
          aria-label="Generated recipe preview"
          className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/25 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <Sparkles
                aria-hidden="true"
                className="w-4 h-4 text-primary shrink-0"
              />
              <span className="font-semibold text-foreground shrink-0">
                {isGenerating ? "Regenerating draft..." : "Draft ready"}
              </span>
              {!isInputExpanded && trimmedPrompt && (
                <span className="hidden sm:inline truncate text-muted-foreground">
                  • {cuisineType ? `${cuisineType}: ` : ""}
                  {trimmedPrompt}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {!isInputExpanded && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => setIsInputExpanded(true)}
                  className="h-8 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  Edit prompt
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleTryAgain}
                className={cn(
                  "bg-card gap-1.5",
                  isGenerating && "disabled:opacity-100"
                )}
              >
                {isGenerating ? (
                  <>
                    <Spinner className="size-3.5" />
                    <span>Regenerating...</span>
                  </>
                ) : (
                  "Try again"
                )}
              </Button>
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isBusy}
                size="sm"
                className={cn(
                  "gap-1.5",
                  isPublishing && "disabled:opacity-100"
                )}
              >
                {isPublishing ? (
                  <>
                    <Spinner className="size-3.5" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  "Publish to Cookbook"
                )}
              </Button>
            </div>
          </header>

          {isGenerating ? (
            <RecipeSkeleton />
          ) : (
            <RecipeDetail recipe={previewRecipe} readonly />
          )}
        </section>
      )}
    </div>
  );
}
