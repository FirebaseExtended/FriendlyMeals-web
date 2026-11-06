import { useState, ViewTransition, type FC } from "react";
import { href, Link, useFetcher, useNavigate } from "react-router";
import {
  ArrowLeft,
  Clock,
  CookingPot,
  FileText,
  Heart,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/firebase/data";
import { useAuthUser } from "@/firebase/auth";
import { useBackToRecipesHref } from "@/lib/navigation";
import {
  cn,
  getRecipeTitleTransitionName,
  NAV_RECIPES_TRANSITION_NAME,
} from "@/lib/utils";

function isSafeImageUrl(url: string | undefined): url is string {
  return Boolean(
    url && (url.startsWith("https://") || url.startsWith("http://"))
  );
}

interface RecipeDetailProps {
  recipe: Recipe;
  isLiked?: boolean;
  likeStateReady?: boolean;
  readonly?: boolean;
  ssr?: boolean;
}

const RecipeDetail: FC<RecipeDetailProps> = ({
  recipe,
  isLiked = false,
  likeStateReady = true,
  readonly = false,
  ssr = false,
}) => {
  const navigate = useNavigate();
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const { user, authReady } = useAuthUser();
  const { backHref, recipesSearch } = useBackToRecipesHref();
  const [hoveredStar, setHoveredStar] = useState(0);

  const isLikeDisabled = !authReady || !likeStateReady;

  const pendingIntent = fetcher.formData?.get("intent");

  const optimisticLiked =
    pendingIntent === "like"
      ? fetcher.formData?.get("nextLiked") === "true"
      : isLiked;

  const optimisticLikesCount =
    pendingIntent === "like" && optimisticLiked !== isLiked
      ? Math.max(0, (recipe.likes || 0) + (optimisticLiked ? 1 : -1))
      : recipe.likes || 0;

  const pendingRating =
    pendingIntent === "rate" ? Number(fetcher.formData?.get("rating")) : NaN;
  const displayRating =
    !Number.isNaN(pendingRating) && pendingRating >= 1 && pendingRating <= 5
      ? pendingRating
      : recipe.averageRating || 0;

  const isDeleting = pendingIntent === "delete";

  const redirectToSignIn = () => {
    const recipePath = href("/recipes/:recipeId", { recipeId: recipe.id });
    void navigate(
      `${href("/login")}?redirectTo=${encodeURIComponent(recipePath)}`
    );
  };

  const handleLikeToggle = () => {
    if (readonly || isLikeDisabled) return;
    if (!user) {
      redirectToSignIn();
      return;
    }

    void fetcher.submit(
      {
        intent: "like",
        nextLiked: String(!optimisticLiked),
      },
      { method: "post" }
    );
  };

  const handleRating = (newRating: number) => {
    if (readonly) return;
    if (!user) {
      redirectToSignIn();
      return;
    }

    void fetcher.submit(
      {
        intent: "rate",
        rating: String(newRating),
      },
      { method: "post" }
    );
  };

  const handleDelete = () => {
    if (!user || user.uid !== recipe.authorId) return;
    if (confirm("Are you sure you want to delete this recipe?")) {
      void fetcher.submit(
        recipesSearch
          ? { intent: "delete", recipesSearch }
          : { intent: "delete" },
        { method: "post" }
      );
    }
  };

  const isAuthor = Boolean(!readonly && user && user.uid === recipe.authorId);
  const activeRating = hoveredStar || displayRating;
  const steps = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const servingsDisplay =
    (recipe.servings ?? "").replace(/\s*servings?\b/i, "").trim() ||
    recipe.servings;

  const TitleTag = readonly ? "h2" : "h1";
  const SectionHeadingTag = readonly ? "h3" : "h2";
  const StepHeadingTag = readonly ? "h4" : "h3";

  const titleHeading = (
    <TitleTag className="w-fit text-balance text-3xl sm:text-4xl font-normal text-foreground">
      {recipe.title}
    </TitleTag>
  );

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4">
      {!readonly && (
        <nav aria-label="Breadcrumb">
          <ViewTransition
            name={NAV_RECIPES_TRANSITION_NAME}
            default="none"
            share="vt-nav-back"
          >
            <Link
              to={backHref}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              <span>Back to recipes</span>
            </Link>
          </ViewTransition>
        </nav>
      )}

      <article
        className={cn(
          "bg-card w-full relative shadow-xs border rounded-xl overflow-hidden",
          ssr && "ssr"
        )}
      >
        {isSafeImageUrl(recipe.imageUri) ? (
          <div className="relative w-full aspect-[16/7] bg-muted">
            <img
              src={recipe.imageUri}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-teal-500 to-amber-400" />
        )}

        <div className="p-6 sm:p-8 space-y-6">
          <header className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              {!readonly && recipe.id ? (
                <ViewTransition
                  name={getRecipeTitleTransitionName(recipe.id)}
                  default="none"
                  share="vt-recipe-title"
                >
                  {titleHeading}
                </ViewTransition>
              ) : (
                titleHeading
              )}
              {!readonly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLikeDisabled}
                  aria-pressed={optimisticLiked}
                  aria-label={`Like recipe (${optimisticLikesCount} ${optimisticLikesCount === 1 ? "like" : "likes"})`}
                  onClick={handleLikeToggle}
                  className={cn(
                    "shrink-0 rounded-full gap-1.5 px-3.5 transition-colors",
                    optimisticLiked &&
                      "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400"
                  )}
                >
                  <Heart
                    aria-hidden="true"
                    className={cn("w-4 h-4", optimisticLiked && "fill-current")}
                  />
                  <span className="tabular-nums">{optimisticLikesCount}</span>
                </Button>
              )}
            </div>

            {!readonly && (
              <fieldset className="min-w-0">
                <legend className="sr-only">Rate this recipe</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex items-center gap-0.5"
                    onMouseLeave={() => setHoveredStar(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`Rate ${star} out of 5 stars`}
                        onMouseEnter={() => setHoveredStar(star)}
                        onFocus={() => setHoveredStar(star)}
                        onBlur={() => setHoveredStar(0)}
                        onClick={() => handleRating(star)}
                        className="p-1.5 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Star
                          aria-hidden="true"
                          className={cn(
                            "w-4 h-4 transition-colors",
                            star <= activeRating
                              ? "fill-amber-400 text-amber-400"
                              : "text-border hover:text-amber-400"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">
                    {displayRating > 0
                      ? displayRating.toFixed(1)
                      : "Rate this recipe"}
                  </span>
                </div>
              </fieldset>
            )}

            {fetcher.data?.error && (
              <p role="alert" className="text-xs text-destructive">
                {fetcher.data.error}
              </p>
            )}

            {recipe.tags.length > 0 && (
              <ul aria-label="Tags" className="flex flex-wrap gap-1.5 pt-0.5">
                {recipe.tags.map((tag) => (
                  <li
                    key={tag}
                    className="px-2.5 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </header>

          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border/60 py-3.5 text-sm">
            <div className="inline-flex items-center gap-2">
              <Clock
                aria-hidden="true"
                className="w-4 h-4 text-primary shrink-0"
              />
              <dt className="text-muted-foreground">Prep</dt>
              <dd className="font-semibold text-foreground">
                {recipe.prepTime}
              </dd>
            </div>
            <div className="inline-flex items-center gap-2">
              <CookingPot
                aria-hidden="true"
                className="w-4 h-4 text-primary shrink-0"
              />
              <dt className="text-muted-foreground">Cook</dt>
              <dd className="font-semibold text-foreground">
                {recipe.cookTime}
              </dd>
            </div>
            <div className="inline-flex items-center gap-2">
              <Users
                aria-hidden="true"
                className="w-4 h-4 text-primary shrink-0"
              />
              <dt className="text-muted-foreground">Serves</dt>
              <dd className="font-semibold text-foreground">
                {servingsDisplay}
              </dd>
            </div>
          </dl>

          <section className="space-y-3">
            <SectionHeadingTag className="text-2xl font-normal text-foreground">
              Ingredients
            </SectionHeadingTag>
            <ul className="divide-y divide-border/50">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index} className="py-2.5 first:pt-0 last:pb-0">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="peer mt-1 size-4 rounded border-border accent-primary shrink-0"
                    />
                    <span className="text-sm sm:text-base text-foreground/90 leading-relaxed peer-checked:line-through peer-checked:text-muted-foreground transition-colors">
                      {ingredient}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4">
            <SectionHeadingTag className="text-2xl font-normal text-foreground">
              Instructions
            </SectionHeadingTag>
            <ol className="space-y-5">
              {steps.map((step, index) => {
                const cleanTitle = step.title.replace(
                  /^(?:step\s*\d+\s*[:.-]\s*|\d+\.\s*)/i,
                  ""
                );
                return (
                  <li key={index} className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <div className="space-y-1 min-w-0">
                      {cleanTitle && (
                        <StepHeadingTag className="text-xl font-normal leading-snug text-foreground">
                          {cleanTitle}
                        </StepHeadingTag>
                      )}
                      <p className="text-sm sm:text-base text-foreground/85 leading-relaxed">
                        {step.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {!readonly && recipe.id && (
            <footer className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <Link
                to={href("/recipes/:recipeId.md", { recipeId: recipe.id })}
                reloadDocument
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <FileText aria-hidden="true" className="w-3.5 h-3.5" />
                <span>View raw Markdown (.md)</span>
              </Link>
              {isAuthor && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  {isDeleting ? "Deleting..." : "Delete recipe"}
                </button>
              )}
            </footer>
          )}
        </div>
      </article>
    </div>
  );
};

export default RecipeDetail;
