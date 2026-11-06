import { useState, ViewTransition } from "react";
import {
  data,
  href,
  Link,
  redirect,
  useFetcher,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { ArrowLeft, Database, Sparkles } from "lucide-react";
import type { Route } from "./+types/generate";
import { IngredientInput } from "@/components/IngredientInput";
import RecipeDetail from "@/components/Recipe";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { generateStructuredJsonRecipe } from "@/firebase/firebaseAILogic.client";
import {
  getRecipeCount,
  publishRecipe,
  type NewRecipeInput,
  type Recipe,
} from "@/firebase/data";
import { useAuthUser, waitForAuthReady } from "@/firebase/auth";
import { reportClientError } from "@/firebase/crashlytics";
import { useBackToRecipesHref } from "@/lib/navigation";
import { useWasServerRendered } from "@/lib/ssr";
import { cn, NAV_RECIPES_TRANSITION_NAME } from "@/lib/utils";

export const handle = { hideHeader: true };

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

const SEED_BUTTON_MAX_RECIPES = 15;

async function loadGenerateData() {
  const recipeCount = await getRecipeCount(SEED_BUTTON_MAX_RECIPES).catch(
    () => SEED_BUTTON_MAX_RECIPES
  );
  return { showSeedButton: recipeCount < SEED_BUTTON_MAX_RECIPES };
}

export async function loader() {
  return data(await loadGenerateData(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function clientLoader() {
  return loadGenerateData();
}

export function shouldRevalidate({
  actionResult,
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod && formMethod.toLowerCase() !== "get") {
    if (
      actionResult &&
      typeof actionResult === "object" &&
      "ok" in actionResult &&
      actionResult.ok === false
    ) {
      return false;
    }
    return defaultShouldRevalidate;
  }
  return currentUrl.pathname !== nextUrl.pathname;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const user = await waitForAuthReady();
  if (!user) {
    return redirect(
      `${href("/login")}?redirectTo=${encodeURIComponent(href("/generate"))}`
    );
  }

  const formData = await request.formData();
  const rawIntent = formData.get("intent");
  const intent = typeof rawIntent === "string" ? rawIntent : "";

  if (intent === "publish") {
    const rawRecipe = formData.get("recipe");
    if (typeof rawRecipe !== "string") {
      return data(
        { ok: false, error: "Missing recipe draft." },
        { status: 400 }
      );
    }
    try {
      const recipe = JSON.parse(rawRecipe) as NewRecipeInput;
      const savedRecipeId = await publishRecipe(user.uid, recipe);
      return redirect(href("/recipes/:recipeId", { recipeId: savedRecipeId }));
    } catch (error) {
      reportClientError(error, { action: "publishRecipe" });
      return data(
        {
          ok: false,
          error: "Couldn't publish your recipe right now. Please try again.",
        },
        { status: 500 }
      );
    }
  }

  if (intent === "seed") {
    try {
      const { seedSampleRecipes } = await import("@/firebase/seed.client");
      await seedSampleRecipes(user.uid);
      return redirect(href("/recipes"));
    } catch (error) {
      reportClientError(error, { action: "seedSampleRecipes" });
      return data(
        {
          ok: false,
          error: "Couldn't seed sample recipes right now. Please try again.",
        },
        { status: 500 }
      );
    }
  }

  return data({ ok: false, error: "Unsupported action." }, { status: 400 });
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

export default function GeneratePage({ loaderData }: Route.ComponentProps) {
  const isSsr = useWasServerRendered();
  const { user, authReady } = useAuthUser();
  const { backHref } = useBackToRecipesHref();
  const [searchParams] = useSearchParams();
  const prefillIngredients = searchParams.get("ingredients")?.trim() ?? "";

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationRevision, setGenerationRevision] = useState(0);
  const [generatedRecipe, setGeneratedRecipe] = useState<NewRecipeInput | null>(
    null
  );
  const [lastPrompt, setLastPrompt] = useState<{
    ingredients: string;
    cuisineType: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInputExpanded, setIsInputExpanded] = useState(true);

  const actionFetcher = useFetcher<typeof clientAction>({
    key: `generate-action-${generationRevision}`,
  });
  const pendingIntent = actionFetcher.formData?.get("intent");
  const isPublishing = pendingIntent === "publish";
  const isSeeding = pendingIntent === "seed";
  const isBusy = isGenerating || isPublishing || isSeeding;

  const activeError =
    errorMessage ??
    (actionFetcher.state === "idle" ? actionFetcher.data?.error : null) ??
    null;

  const handleGenerateRecipe = async (
    ingredients: string,
    cuisineType: string
  ) => {
    const trimmedIngredients = ingredients.trim();
    if (!trimmedIngredients || isBusy) {
      return;
    }

    try {
      setErrorMessage(null);
      setGenerationRevision((revision) => revision + 1);
      setIsGenerating(true);
      const recipe = await generateStructuredJsonRecipe(
        trimmedIngredients,
        cuisineType
      );
      setGeneratedRecipe(recipe);
      setLastPrompt({ ingredients: trimmedIngredients, cuisineType });
      setIsInputExpanded(false);
    } catch (error) {
      reportClientError(error, { action: "generateStructuredJsonRecipe" });
      setErrorMessage(formatGenerationError(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTryAgain = () => {
    if (!lastPrompt || isBusy) return;
    void handleGenerateRecipe(lastPrompt.ingredients, lastPrompt.cuisineType);
  };

  const handlePublish = () => {
    if (!generatedRecipe || isBusy) return;
    setErrorMessage(null);
    void actionFetcher.submit(
      { intent: "publish", recipe: JSON.stringify(generatedRecipe) },
      { method: "post" }
    );
  };

  const handleSeedRecipes = () => {
    if (isBusy) return;
    setErrorMessage(null);
    void actionFetcher.submit({ intent: "seed" }, { method: "post" });
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
      <nav aria-label="Breadcrumb">
        <ViewTransition
          name={NAV_RECIPES_TRANSITION_NAME}
          default="none"
          share="vt-nav-back"
        >
          <Link
            to={backHref}
            prefetch="intent"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft aria-hidden="true" className="w-4 h-4" />
            <span>Back to recipes</span>
          </Link>
        </ViewTransition>
      </nav>

      <section
        className={cn(
          "space-y-5",
          !previewRecipe && !isGenerating && "pt-1 sm:pt-3",
          !showComposer && "hidden"
        )}
      >
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl sm:text-4xl font-normal text-foreground">
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
          key={prefillIngredients}
          initialIngredients={prefillIngredients}
          isLoading={isGenerating ? "Generating recipe" : false}
          submitDisabled={!authReady || !user || isPublishing || isSeeding}
          hasPreview={Boolean(previewRecipe)}
          shareSubmitTransition={showComposer}
          onCancelEdit={() => setIsInputExpanded(false)}
          ssr={isSsr}
          handleSubmit={handleGenerateRecipe}
        />
      </section>

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
              {!isInputExpanded && lastPrompt && (
                <span className="hidden sm:inline truncate text-muted-foreground">
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
                  disabled={isBusy}
                  onClick={() => setIsInputExpanded(true)}
                  className="h-8 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  Edit prompt
                </Button>
              )}
              {lastPrompt && (
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
              )}
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

      {loaderData.showSeedButton && (
        <footer
          className={cn(
            "mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground",
            isSsr && "ssr"
          )}
        >
          <span>
            Need sample data? Populate the cookbook with 20 starter recipes,
            ratings, and likes.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!authReady || !user || isBusy}
            onClick={handleSeedRecipes}
            className={cn(
              "h-7 gap-1.5 px-2.5 text-xs bg-card",
              isSeeding && "disabled:opacity-100"
            )}
          >
            {isSeeding ? (
              <>
                <Spinner className="size-3" />
                <span>Seeding recipes...</span>
              </>
            ) : (
              <>
                <Database aria-hidden="true" className="size-3" />
                <span>Seed 20 recipes</span>
              </>
            )}
          </Button>
        </footer>
      )}
    </div>
  );
}
