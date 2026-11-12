import { useRef, useState, type FC } from "react";
import { href, useNavigation, useSearchParams } from "react-router";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { isLikedFilterEnabled, parseTagsParam } from "@/lib/recipes-catalog";
import { cn } from "@/lib/utils";

export interface FilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  availableTags: string[];
  canFilterByLikes: boolean;
  isSignedOut: boolean;
}

export const FilterPanel: FC<FilterPanelProps> = ({
  isOpen,
  onToggle,
  availableTags,
  canFilterByLikes,
  isSignedOut,
}) => {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const minRatingInputRef = useRef<HTMLInputElement | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);

  const activeParams =
    navigation.location?.pathname === recipesPath
      ? (navigation.formData ?? new URLSearchParams(navigation.location.search))
      : searchParams;

  const rawLiked = activeParams.get("liked");
  const likedOnly = isLikedFilterEnabled(
    typeof rawLiked === "string" ? rawLiked : null
  );
  const isMyLikesChecked = canFilterByLikes && likedOnly;
  const selectedTags = parseTagsParam(activeParams);
  const minRating = Number(activeParams.get("minRating")) || 0;

  const committedTags = parseTagsParam(searchParams);
  const defaultLikesChecked =
    canFilterByLikes && isLikedFilterEnabled(searchParams.get("liked"));
  const committedMinRating = Number(searchParams.get("minRating")) || 0;

  const hasPanelFilters =
    isMyLikesChecked || minRating > 0 || selectedTags.length > 0;
  const activeRatingPreview = hoveredStar || minRating;

  const handleRatingSelect = (
    form: HTMLFormElement | null,
    nextRating: number
  ) => {
    if (minRatingInputRef.current) {
      minRatingInputRef.current.value =
        nextRating > 0 ? String(nextRating) : "";
    }
    form?.requestSubmit();
  };

  const handleClearFilters = (form: HTMLFormElement | null) => {
    if (!form) {
      return;
    }
    const likedInput = form.elements.namedItem("liked");
    if (likedInput instanceof HTMLInputElement) {
      likedInput.checked = false;
    }
    if (minRatingInputRef.current) {
      minRatingInputRef.current.value = "";
    }
    for (const el of form.querySelectorAll<HTMLInputElement>(
      'input[name="tags"]'
    )) {
      el.checked = false;
    }
    form.requestSubmit();
  };

  return (
    <div className="rounded-md border bg-card shadow-xs md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
      {/* Mobile collapsible trigger */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="recipe-filters"
        className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors md:hidden"
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
          !isOpen && "hidden md:block"
        )}
      >
        <FieldGroup className="gap-5">
          <label
            htmlFor="my-likes-switch"
            title={
              isSignedOut
                ? "Sign in to filter by your liked recipes"
                : undefined
            }
            className={cn(
              "group flex items-center justify-between gap-3 text-sm font-medium leading-snug select-none",
              canFilterByLikes
                ? "cursor-pointer text-foreground"
                : "cursor-not-allowed text-muted-foreground"
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Heart
                aria-hidden="true"
                className="size-4 text-muted-foreground transition-colors group-has-checked:fill-primary group-has-checked:text-primary"
              />
              <span>My likes</span>
            </span>
            <span
              className={cn(
                "inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent bg-input shadow-xs transition-colors group-has-checked:bg-primary group-has-focus-visible:ring-2 group-has-focus-visible:ring-ring group-has-focus-visible:ring-offset-2 group-has-focus-visible:ring-offset-background",
                !canFilterByLikes && "opacity-50"
              )}
            >
              <input
                id="my-likes-switch"
                type="checkbox"
                role="switch"
                aria-checked={isMyLikesChecked}
                name="liked"
                value="1"
                defaultChecked={defaultLikesChecked}
                disabled={!canFilterByLikes}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none block size-4 translate-x-0 rounded-full bg-background shadow-xs ring-0 transition-transform peer-checked:translate-x-4"
              />
            </span>
          </label>

          <FieldSet className="gap-0">
            <FieldLegend variant="label" className="leading-snug">
              Minimum Rating
            </FieldLegend>
            <input
              ref={minRatingInputRef}
              type="hidden"
              name="minRating"
              defaultValue={
                committedMinRating > 0 ? String(committedMinRating) : ""
              }
            />
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
                  onClick={(e) =>
                    handleRatingSelect(
                      e.currentTarget.form,
                      star === minRating ? 0 : star
                    )
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
                  onClick={(e) => handleRatingSelect(e.currentTarget.form, 0)}
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
                {availableTags.map((tag) => (
                  <label
                    key={tag}
                    className="cursor-pointer rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground/80 transition-colors select-none hover:border-primary/50 hover:text-foreground has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary has-focus-visible:ring-2 has-focus-visible:ring-ring"
                  >
                    <input
                      type="checkbox"
                      name="tags"
                      value={tag}
                      defaultChecked={committedTags.includes(tag)}
                      className="sr-only"
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </FieldSet>
          )}

          {hasPanelFilters && (
            <div className="flex justify-start border-t border-border/60 pt-3">
              <button
                type="button"
                onClick={(e) => handleClearFilters(e.currentTarget.form)}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </FieldGroup>
      </search>
    </div>
  );
};
