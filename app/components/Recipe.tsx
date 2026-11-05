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
import { cn, getRecipeTitleTransitionName } from "@/lib/utils";

function isSafeImageUrl(url: string | undefined): url is string {
  return Boolean(
    url && (url.startsWith("https://") || url.startsWith("http://"))
  );
}

interface RecipeDetailProps {
  recipe: Recipe;
  isLiked?: boolean;
  readonly?: boolean;
  ssr?: boolean;
}

const RecipeDetail: FC<RecipeDetailProps> = ({
  recipe,
  isLiked = false,
  readonly = false,
  ssr = false,
}) => {
  const navigate = useNavigate();
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const { user } = useAuthUser();
  const [hoveredStar, setHoveredStar] = useState(0);

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
    navigate(`${href("/login")}?redirectTo=${encodeURIComponent(recipePath)}`);
  };

  const handleLikeToggle = () => {
    if (readonly) return;
    if (!user) {
      redirectToSignIn();
      return;
    }

    fetcher.submit(
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

    fetcher.submit(
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
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  const isAuthor = Boolean(!readonly && user && user.uid === recipe.authorId);
  const activeRating = hoveredStar || displayRating;
  const steps = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const servingsDisplay =
    String(recipe.servings ?? "")
      .replace(/\s*servings?\b/i, "")
      .trim() || recipe.servings;

  const titleHeading = (
    <h1 className="w-fit text-balance text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
      {recipe.title}
    </h1>
  );

  return (
    <div className="max-w-2xl mx-auto w-full space-y-3">
      {!readonly && (
        <div>
          <Link
            to={href("/recipes")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to recipes</span>
          </Link>
        </div>
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
          <div className="space-y-3">
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
                  aria-label={optimisticLiked ? "Unlike recipe" : "Like recipe"}
                  onClick={handleLikeToggle}
                  className={cn(
                    "shrink-0 rounded-full gap-1.5 px-3.5 transition-colors",
                    optimisticLiked &&
                      "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400"
                  )}
                >
                  <Heart
                    className={cn("w-4 h-4", optimisticLiked && "fill-current")}
                  />
                  <span className="tabular-nums">{optimisticLikesCount}</span>
                </Button>
              )}
            </div>

            {!readonly && (
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
            )}

            {fetcher.data?.error && (
              <p role="alert" className="text-xs text-destructive">
                {fetcher.data.error}
              </p>
            )}

            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border/60 py-3.5 text-sm">
            <div className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground">Prep</span>
              <span className="font-semibold text-foreground">
                {recipe.prepTime}
              </span>
            </div>
            <div className="inline-flex items-center gap-2">
              <CookingPot className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground">Cook</span>
              <span className="font-semibold text-foreground">
                {recipe.cookTime}
              </span>
            </div>
            <div className="inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground">Serves</span>
              <span className="font-semibold text-foreground">
                {servingsDisplay}
              </span>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Ingredients
            </h2>
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
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Instructions
            </h2>
            <ol className="space-y-5">
              {steps.map((step, index) => {
                const cleanTitle = step.title.replace(
                  /^(?:step\s*\d+\s*[:.-]\s*|\d+\.\s*)/i,
                  ""
                );
                return (
                  <li key={index} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tabular-nums">
                      {index + 1}
                    </span>
                    <div className="space-y-1 min-w-0">
                      {cleanTitle && (
                        <h3 className="text-base font-semibold leading-snug text-foreground">
                          {cleanTitle}
                        </h3>
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
            <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <Link
                to={href("/recipes/:recipeId.md", { recipeId: recipe.id })}
                reloadDocument
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
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
            </div>
          )}
        </div>
      </article>
    </div>
  );
};

export default RecipeDetail;
