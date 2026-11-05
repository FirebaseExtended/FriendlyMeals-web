import { type ElementType, type FC } from "react";
import { href, Link, useFetcher, useNavigate } from "react-router";
import Markdown from "react-markdown";
import { Clock, FileText, Flame, Heart, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/firebase/data";
import { useAuthUser } from "@/firebase/auth";
import { cn } from "@/lib/utils";

function isSafeImageUrl(url: string | undefined): url is string {
  return Boolean(
    url && (url.startsWith("https://") || url.startsWith("http://"))
  );
}

const InfoBox = ({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
}) => (
  <div className="flex flex-col items-center justify-center p-3 py-4 bg-muted/40 rounded-2xl gap-2 flex-1 min-w-[30%]">
    <div className="p-2 bg-background rounded-full shadow-sm text-emerald-600">
      <Icon className="w-5 h-5" />
    </div>
    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
      {label}
    </span>
    <span className="font-semibold text-sm text-center">{value}</span>
  </div>
);

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

  return (
    <div className="flex items-center flex-col gap-8">
      <div
        className={cn(
          "bg-background w-full relative max-w-2xl mx-auto shadow-sm border rounded-xl overflow-hidden",
          ssr && "ssr"
        )}
      >
        {/* Top Banner Section */}
        <div className="relative w-full aspect-[16/7] bg-muted">
          {isSafeImageUrl(recipe.imageUri) ? (
            <img
              src={recipe.imageUri}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-orange-50 dark:from-emerald-950/50 dark:to-orange-950/30 text-emerald-300 dark:text-emerald-700">
              <Flame className="w-16 h-16" />
            </div>
          )}

          {!readonly && (
            <div className="absolute -bottom-6 right-6 z-20">
              <Button
                type="button"
                size="icon"
                aria-label={optimisticLiked ? "Unlike recipe" : "Like recipe"}
                className={`rounded-full w-14 h-14 shadow-xl border-4 border-background transition-colors ${
                  optimisticLiked
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-emerald-500 hover:bg-emerald-600"
                } text-white`}
                onClick={handleLikeToggle}
              >
                <Heart
                  className={`w-7 h-7 ${optimisticLiked ? "fill-current" : ""}`}
                />
              </Button>
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="px-6 pt-10 pb-6 space-y-8">
          {/* Title, Rating & Markdown Resource Link */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight text-foreground">
                {recipe.title}
              </h1>
              {!readonly && recipe.id && (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    to={href("/recipes/:recipeId.md", { recipeId: recipe.id })}
                    reloadDocument
                    className="inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Raw .md</span>
                  </Link>
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) =>
                  readonly ? (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= displayRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/20"
                      }`}
                    />
                  ) : (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Rate ${star} out of 5 stars`}
                      onClick={() => handleRating(star)}
                      className="p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star
                        className={`w-5 h-5 transition-all cursor-pointer ${
                          star <= displayRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/20 hover:text-amber-400"
                        }`}
                      />
                    </button>
                  )
                )}
              </div>
              <span className="text-sm text-muted-foreground font-medium">
                {displayRating > 0 ? displayRating.toFixed(1) : "No ratings"}
              </span>
              {!readonly && (
                <span className="text-sm text-muted-foreground">
                  • {optimisticLikesCount}{" "}
                  {optimisticLikesCount === 1 ? "like" : "likes"}
                </span>
              )}
            </div>

            {fetcher.data?.error && (
              <p role="alert" className="text-xs text-destructive">
                {fetcher.data.error}
              </p>
            )}

            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="flex gap-4 justify-between">
            <InfoBox icon={Clock} label="Prep Time" value={recipe.prepTime} />
            <InfoBox icon={Flame} label="Cook Time" value={recipe.cookTime} />
            <InfoBox icon={Users} label="Servings" value={recipe.servings} />
          </div>

          {/* Ingredients */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Ingredients
            </h2>
            <div className="space-y-3 bg-muted/20 p-6 rounded-3xl border border-border/50">
              {recipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 min-w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                  <span className="text-foreground/90 leading-relaxed font-medium">
                    {ingredient}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Instructions
            </h2>
            <div className="p-6 rounded-3xl border border-border/50 bg-card prose prose-stone dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90">
              <Markdown>{recipe.instructions}</Markdown>
            </div>
          </div>
        </div>
      </div>

      {isAuthor && (
        <Button
          type="button"
          variant="ghost"
          disabled={isDeleting}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
          onClick={handleDelete}
        >
          {isDeleting ? "Deleting..." : "Delete This Recipe"}
        </Button>
      )}
    </div>
  );
};

export default RecipeDetail;
