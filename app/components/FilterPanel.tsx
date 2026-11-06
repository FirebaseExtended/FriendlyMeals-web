import { useState, type FC } from "react";
import { href, Link, useLocation, useSubmit } from "react-router";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  DEFAULT_SORT,
  getLatestCatalogSearchParams,
  isLikedFilterEnabled,
  parseSortParam,
  recordInFlightCatalogSearch,
  useOptimisticRecipesSearchParams,
} from "@/lib/recipes-catalog";
import { cn } from "@/lib/utils";

export interface FilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  availableTags: string[];
  canFilterByLikes: boolean;
  isSignedOut: boolean;
  ssr: boolean;
}

export const FilterPanel: FC<FilterPanelProps> = ({
  isOpen,
  onToggle,
  availableTags,
  canFilterByLikes,
  isSignedOut,
  ssr,
}) => {
  const activeSearchParams = useOptimisticRecipesSearchParams();
  const location = useLocation();
  const submit = useSubmit();
  const recipesPath = href("/recipes");
  const [hoveredStar, setHoveredStar] = useState(0);

  const queryText = activeSearchParams.get("q") || "";
  const sortBy = parseSortParam(activeSearchParams.get("sort"));
  const likedOnly = isLikedFilterEnabled(activeSearchParams.get("liked"));
  const isMyLikesChecked = canFilterByLikes && likedOnly;
  const selectedTags =
    activeSearchParams.get("tags")?.split(",").filter(Boolean) || [];
  const minRating = Number(activeSearchParams.get("minRating")) || 0;

  const submitFilterUpdates = (updates: {
    liked?: boolean;
    minRating?: number;
    tags?: string[];
  }) => {
    const nextParams = getLatestCatalogSearchParams(
      location.key,
      activeSearchParams
    );
    nextParams.delete("limit");

    if (updates.liked !== undefined) {
      if (updates.liked) {
        nextParams.set("liked", "1");
      } else {
        nextParams.delete("liked");
      }
    }

    if (updates.minRating !== undefined) {
      if (updates.minRating > 0) {
        nextParams.set("minRating", String(updates.minRating));
      } else {
        nextParams.delete("minRating");
      }
    }

    if (updates.tags !== undefined) {
      if (updates.tags.length > 0) {
        nextParams.set("tags", updates.tags.join(","));
      } else {
        nextParams.delete("tags");
      }
    }

    recordInFlightCatalogSearch(location.key, nextParams);

    void submit(nextParams, {
      method: "get",
      action: recipesPath,
      replace: true,
      preventScrollReset: true,
    });
  };

  const hasPanelFilters = likedOnly || minRating > 0 || selectedTags.length > 0;
  const debugSsrParam = activeSearchParams.get("debugSSR");

  const resetParams = new URLSearchParams();
  if (queryText) {
    resetParams.set("q", queryText);
  }
  if (sortBy !== DEFAULT_SORT) {
    resetParams.set("sort", sortBy);
  }
  if (debugSsrParam !== null) {
    resetParams.set("debugSSR", debugSsrParam);
  }
  const resetQs = resetParams.toString();
  const resetHref = resetQs ? `${recipesPath}?${resetQs}` : recipesPath;

  const activeRatingPreview = hoveredStar || minRating;

  return (
    <div className="rounded-md border bg-card shadow-xs md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
      {/* Mobile collapsible trigger */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="recipe-filters"
        className={cn(
          "flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors md:hidden",
          ssr && !isOpen && "ssr"
        )}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            aria-hidden="true"
            className="w-4 h-4 text-muted-foreground"
          />
          <span className="font-medium">Filter</span>
          {hasPanelFilters && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Active
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp aria-hidden="true" className="w-4 h-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="w-4 h-4" />
        )}
      </button>

      {/* Desktop static sidebar header */}
      <div className="hidden md:flex items-center gap-2 pb-3">
        <SlidersHorizontal
          aria-hidden="true"
          className="w-4 h-4 text-muted-foreground"
        />
        <h2 className="text-sm font-semibold text-foreground">Filter</h2>
      </div>

      <search
        id="recipe-filters"
        aria-label="Filter recipes"
        className={cn(
          "border-t p-4 md:rounded-md md:border md:bg-card md:p-4 md:shadow-xs",
          !isOpen && "hidden md:block",
          ssr && "ssr"
        )}
      >
        <FieldGroup className="gap-5">
          <div
            className="flex items-center justify-between gap-3"
            title={
              isSignedOut
                ? "Sign in to filter by your liked recipes"
                : undefined
            }
          >
            <label
              id="my-likes-filter-label"
              htmlFor="my-likes-switch"
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium leading-snug select-none",
                canFilterByLikes
                  ? "cursor-pointer text-foreground"
                  : "cursor-not-allowed text-muted-foreground"
              )}
            >
              <Heart
                aria-hidden="true"
                className={cn(
                  "size-4 transition-colors",
                  isMyLikesChecked
                    ? "fill-primary text-primary"
                    : "text-muted-foreground"
                )}
              />
              <span>My likes</span>
            </label>
            <button
              id="my-likes-switch"
              type="button"
              role="switch"
              aria-checked={isMyLikesChecked}
              aria-labelledby="my-likes-filter-label"
              disabled={!canFilterByLikes}
              onClick={() => submitFilterUpdates({ liked: !likedOnly })}
              className={cn(
                "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                isMyLikesChecked ? "bg-primary" : "bg-input"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none block size-4 rounded-full bg-background shadow-xs ring-0 transition-transform",
                  isMyLikesChecked ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <FieldSet className="gap-0">
            <FieldLegend variant="label" className="leading-snug">
              Minimum Rating
            </FieldLegend>
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHoveredStar(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`Minimum ${star} star${star === 1 ? "" : "s"}`}
                  aria-pressed={minRating === star}
                  onMouseEnter={() => setHoveredStar(star)}
                  onFocus={() => setHoveredStar(star)}
                  onBlur={() => setHoveredStar(0)}
                  onClick={() =>
                    submitFilterUpdates({
                      minRating: star === minRating ? 0 : star,
                    })
                  }
                  className="p-1.5 -m-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    aria-hidden="true"
                    className={cn(
                      "w-5 h-5 transition-colors",
                      star <= activeRatingPreview
                        ? "fill-star-fill text-star-stroke"
                        : "text-border hover:text-star-stroke"
                    )}
                  />
                </button>
              ))}
              {minRating > 0 && (
                <button
                  type="button"
                  onClick={() => submitFilterUpdates({ minRating: 0 })}
                  className="ml-2 p-1 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Clear minimum rating"
                >
                  <X aria-hidden="true" className="w-4 h-4" />
                </button>
              )}
            </div>
          </FieldSet>

          {availableTags.length > 0 && (
            <FieldSet className="gap-0">
              <FieldLegend variant="label" className="leading-snug">
                Popular Tags
              </FieldLegend>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        submitFilterUpdates({
                          tags: selected
                            ? selectedTags.filter((t) => t !== tag)
                            : [...selectedTags, tag],
                        })
                      }
                      className={cn(
                        "rounded-md border px-3 py-1 text-xs transition-colors",
                        selected
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-card text-foreground/80 hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </FieldSet>
          )}

          {hasPanelFilters && (
            <div className="flex justify-start border-t border-border/60 pt-3">
              <Link
                to={resetHref}
                replace
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
              >
                Clear
              </Link>
            </div>
          )}
        </FieldGroup>
      </search>
    </div>
  );
};
