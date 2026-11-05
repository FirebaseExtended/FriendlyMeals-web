import {
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type FC,
} from "react";
import {
  data,
  Form,
  href,
  Link,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { Route } from "./+types/recipes";
import {
  getTop5Tags,
  queryRecipes,
  type Recipe,
  type RecipeFilters,
} from "@/firebase/data";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { cn, getRecipeTitleTransitionName } from "@/lib/utils";

const PUBLIC_RECIPES_CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  if (errorHeaders) {
    return {};
  }
  const cacheControl = loaderHeaders.get("Cache-Control");
  return cacheControl ? { "Cache-Control": cacheControl } : {};
}

export function meta() {
  return [
    { title: "All Recipes - Friendly Meals" },
    { name: "description", content: "Browse community recipes" },
  ];
}

function isSafeImageUrl(url: string | undefined): url is string {
  return Boolean(
    url && (url.startsWith("https://") || url.startsWith("http://"))
  );
}

function parseFiltersFromUrl(requestUrl: string): RecipeFilters {
  const url = new URL(requestUrl);
  const rawMinRating = Number(url.searchParams.get("minRating"));
  const rawTags = url.searchParams.get("tags");
  const rawSort = url.searchParams.get("sort");

  return {
    searchTerm: url.searchParams.get("q")?.trim() || undefined,
    minRating:
      !Number.isNaN(rawMinRating) && rawMinRating > 0
        ? rawMinRating
        : undefined,
    tags: rawTags ? rawTags.split(",").filter(Boolean) : undefined,
    sort: rawSort && rawSort !== "none" ? rawSort : undefined,
  };
}

async function loadRecipesCatalog(request: Request) {
  const filters = parseFiltersFromUrl(request.url);
  const [recipes, topTags] = await Promise.all([
    queryRecipes(filters),
    getTop5Tags(),
  ]);
  return { recipes, topTags };
}

// Initial HTML request renders on Cloud Run so search engines and agents get full HTML
export async function loader({ request }: Route.LoaderArgs) {
  const payload = await loadRecipesCatalog(request);
  return data(
    { ...payload, ssr: true },
    {
      headers: { "Cache-Control": PUBLIC_RECIPES_CACHE_CONTROL },
    }
  );
}

// Subsequent navigations and filter submissions run directly in the browser against Firestore
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const payload = await loadRecipesCatalog(request);
  return { ...payload, ssr: false };
}

const ZeroState: FC<{ ssr: boolean }> = ({ ssr }) => {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
      <Empty className={cn("border border-dashed bg-card", ssr && "ssr")}>
        <EmptyMedia variant="icon">
          <BookOpen className="h-6 w-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No recipes yet</EmptyTitle>
          <EmptyDescription>
            Generate a recipe with Gemini to start building the community cookbook.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to={href("/generate")}>Generate Recipe</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
};

const SEARCH_DEBOUNCE_MS = 300;

const SearchBar: FC<{ ssr: boolean }> = ({ ssr }) => {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");

  const urlQuery = searchParams.get("q") || "";
  const [value, setValue] = useState(urlQuery);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedRef = useRef(urlQuery);

  // Sync input if `q` changes externally (Reset, Clear all, or browser Back/Forward)
  useEffect(() => {
    if (
      urlQuery !== lastSubmittedRef.current &&
      debounceTimerRef.current === null
    ) {
      setValue(urlQuery);
      lastSubmittedRef.current = urlQuery;
    }
  }, [urlQuery]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const submitSearch = (nextValue: string, immediate = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const run = () => {
      debounceTimerRef.current = null;
      const trimmed = nextValue.trim();
      lastSubmittedRef.current = trimmed ? nextValue : "";
      const nextParams = new URLSearchParams(searchParams);
      if (trimmed) {
        nextParams.set("q", nextValue);
      } else {
        nextParams.delete("q");
      }
      const hadQueryBefore = Boolean(searchParams.get("q"));
      submit(nextParams, {
        method: "get",
        action: recipesPath,
        replace: hadQueryBefore,
      });
    };

    if (immediate) {
      run();
    } else {
      debounceTimerRef.current = setTimeout(run, SEARCH_DEBOUNCE_MS);
    }
  };

  const isSearching =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath &&
    new URLSearchParams(navigation.location.search).get("q") !== urlQuery;

  const minRatingParam = searchParams.get("minRating");
  const tagsParam = searchParams.get("tags");
  const sortParam = searchParams.get("sort");

  return (
    <Form
      method="get"
      action={recipesPath}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch(value, true);
      }}
      className="relative"
    >
      {minRatingParam && (
        <input type="hidden" name="minRating" value={minRatingParam} />
      )}
      {tagsParam && <input type="hidden" name="tags" value={tagsParam} />}
      {sortParam && <input type="hidden" name="sort" value={sortParam} />}

      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="recipe-search"
        name="q"
        type="search"
        aria-label="Search recipes"
        placeholder="Search recipes by title, ingredient, or tag..."
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          submitSearch(next);
        }}
        className={cn(
          "h-11 rounded-xl bg-card pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden",
          ssr && "ssr"
        )}
      />
      {isSearching ? (
        <Spinner className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      ) : (
        value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              submitSearch("", true);
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )
      )}
    </Form>
  );
};

const SORT_OPTIONS = [
  { value: "none", label: "Default" },
  { value: "rating", label: "Rating" },
  { value: "title", label: "Alphabetical" },
  { value: "likes", label: "Likes" },
] as const;

const FilterPanel: FC<{
  isOpen: boolean;
  onToggle: () => void;
  availableTags: string[];
  ssr: boolean;
}> = ({ isOpen, onToggle, availableTags, ssr }) => {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const [hoveredStar, setHoveredStar] = useState(0);

  const activeSearchParams =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath
      ? new URLSearchParams(navigation.location.search)
      : searchParams;

  const queryText = activeSearchParams.get("q") || "";
  const sortBy =
    (activeSearchParams.get("sort") as "rating" | "title" | "likes" | "none") ||
    "none";
  const selectedTags =
    activeSearchParams.get("tags")?.split(",").filter(Boolean) || [];
  const minRating = Number(activeSearchParams.get("minRating")) || 0;

  const submitFilterUpdates = (updates: {
    minRating?: number;
    tags?: string[];
    sort?: string;
  }) => {
    const nextParams = new URLSearchParams(activeSearchParams);

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

    if (updates.sort !== undefined) {
      if (updates.sort && updates.sort !== "none") {
        nextParams.set("sort", updates.sort);
      } else {
        nextParams.delete("sort");
      }
    }

    submit(nextParams, {
      method: "get",
      action: recipesPath,
      replace: true,
    });
  };

  const hasPanelFilters =
    minRating > 0 ||
    selectedTags.length > 0 ||
    Boolean(sortBy && sortBy !== "none");

  const resetHref = queryText
    ? `${recipesPath}?q=${encodeURIComponent(queryText)}`
    : recipesPath;

  const activeRatingPreview = hoveredStar || minRating;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-xs md:rounded-none md:border-0 md:bg-transparent md:shadow-none",
        ssr && "ssr"
      )}
    >
      {/* Mobile collapsible trigger */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors md:hidden"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Filters & Sort</span>
          {hasPanelFilters && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Active
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Desktop static sidebar header */}
      <div className="hidden md:flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Filters & Sort
          </span>
        </div>
        {hasPanelFilters && (
          <Link
            to={resetHref}
            replace
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </Link>
        )}
      </div>

      <Form
        method="get"
        action={recipesPath}
        className={cn(
          "border-t p-4 md:border-t-0 md:p-0 md:pt-1",
          !isOpen && "hidden md:block"
        )}
      >
        {queryText && <input type="hidden" name="q" value={queryText} />}
        {minRating > 0 && (
          <input type="hidden" name="minRating" value={String(minRating)} />
        )}
        {selectedTags.length > 0 && (
          <input
            type="hidden"
            name="tags"
            value={selectedTags.join(",")}
          />
        )}

        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>Minimum Rating</FieldLabel>
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
                  className="p-1.5 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={cn(
                      "w-5 h-5 transition-colors",
                      star <= activeRatingPreview
                        ? "fill-amber-400 text-amber-400"
                        : "text-border hover:text-amber-400"
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
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </Field>

          {availableTags.length > 0 && (
            <Field>
              <FieldLabel>Popular Tags</FieldLabel>
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
                        "rounded-full border px-3 py-1 text-xs transition-colors",
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
            </Field>
          )}

          <Field>
            <FieldLabel>Sort By</FieldLabel>
            <div className="flex flex-col gap-2">
              {SORT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="sort"
                    value={option.value}
                    checked={sortBy === option.value}
                    onChange={() => submitFilterUpdates({ sort: option.value })}
                    className="accent-primary"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {hasPanelFilters && (
            <div className="border-t border-border/60 pt-3 md:hidden">
              <Link
                to={resetHref}
                replace
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </Link>
            </div>
          )}
        </FieldGroup>
      </Form>
    </div>
  );
};

export default function RecipesPage({ loaderData }: Route.ComponentProps) {
  const { recipes, topTags, ssr } = loaderData;
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const [filterOpen, setFilterOpen] = useState(false);

  const activeSearchParams =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath
      ? new URLSearchParams(navigation.location.search)
      : searchParams;

  const hasFilters = Array.from(activeSearchParams.entries()).some(
    ([key, value]) => Boolean(value) && !(key === "sort" && value === "none")
  );

  if ((!recipes || recipes.length === 0) && !hasFilters) {
    return <ZeroState ssr={ssr} />;
  }

  const activeQueryText = activeSearchParams.get("q")?.trim() || "";
  const activeMinRating = Number(activeSearchParams.get("minRating")) || 0;
  const activeTags =
    activeSearchParams.get("tags")?.split(",").filter(Boolean) || [];
  const activeSort = activeSearchParams.get("sort") || "none";
  const activeSortLabel =
    activeSort !== "none"
      ? SORT_OPTIONS.find((opt) => opt.value === activeSort)?.label
      : undefined;

  const buildFilterHref = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(activeSearchParams);
    mutate(next);
    const qs = next.toString();
    return qs ? `${recipesPath}?${qs}` : recipesPath;
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-4">
      <div className="md:col-start-2 md:row-start-1">
        <SearchBar ssr={ssr} />
      </div>

      <aside className="md:col-start-1 md:row-start-1 md:row-span-2 md:sticky md:top-6 md:self-start">
        <FilterPanel
          isOpen={filterOpen}
          onToggle={() => setFilterOpen(!filterOpen)}
          availableTags={topTags}
          ssr={ssr}
        />
      </aside>

      <section className="min-w-0 md:col-start-2 md:row-start-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-base font-semibold text-foreground">
            Recipes{" "}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              ({recipes.length})
            </span>
          </h1>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeMinRating > 0 && (
                <Link
                  to={buildFilterHref((p) => p.delete("minRating"))}
                  replace
                  aria-label={`Remove ${activeMinRating} star minimum filter`}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
                >
                  <span>{activeMinRating}★+</span>
                  <X className="size-3" />
                </Link>
              )}
              {activeTags.map((tag) => (
                <Link
                  key={tag}
                  to={buildFilterHref((p) => {
                    const remaining = activeTags.filter((t) => t !== tag);
                    if (remaining.length > 0) {
                      p.set("tags", remaining.join(","));
                    } else {
                      p.delete("tags");
                    }
                  })}
                  replace
                  aria-label={`Remove ${tag} tag filter`}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
                >
                  <span>{tag}</span>
                  <X className="size-3" />
                </Link>
              ))}
              {activeSortLabel && (
                <Link
                  to={buildFilterHref((p) => p.delete("sort"))}
                  replace
                  aria-label={`Remove ${activeSortLabel} sort`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Sort: {activeSortLabel}</span>
                  <X className="size-3" />
                </Link>
              )}
              <Link
                to={recipesPath}
                replace
                className="px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </Link>
            </div>
          )}
        </div>

        {!recipes || recipes.length === 0 ? (
          <div
            className={cn(
              "space-y-4 rounded-xl border bg-card px-6 py-12 text-center shadow-xs",
              ssr && "ssr"
            )}
          >
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {activeQueryText ? (
                <Sparkles className="size-5" />
              ) : (
                <Search className="size-5" />
              )}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {activeQueryText
                  ? `No recipes found for "${activeQueryText}"`
                  : "No recipes match these filters"}
              </p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                {activeQueryText
                  ? "Want Gemini to turn that into a fresh recipe, or clear your filters to browse the full cookbook?"
                  : "Try removing a filter to see more recipes from the cookbook."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {activeQueryText && (
                <Button asChild size="sm" className="gap-1.5">
                  <Link
                    to={`${href("/generate")}?ingredients=${encodeURIComponent(activeQueryText)}`}
                  >
                    <Sparkles className="size-3.5" />
                    <span>Generate a "{activeQueryText}" recipe</span>
                  </Link>
                </Button>
              )}
              <Button
                asChild
                variant={activeQueryText ? "outline" : "secondary"}
                size="sm"
              >
                <Link to={recipesPath} replace>
                  Clear search & filters
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <ItemGroup className="gap-3">
            {recipes.map((recipe: Recipe) => (
              <Item
                key={recipe.id}
                asChild
                variant="outline"
                className={cn(
                  "rounded-xl bg-card p-5 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all",
                  ssr && "ssr"
                )}
              >
                <Link to={href("/recipes/:recipeId", { recipeId: recipe.id })}>
                  {isSafeImageUrl(recipe.imageUri) && (
                    <ItemMedia className="size-16 rounded-lg overflow-hidden border bg-muted shrink-0">
                      <img
                        src={recipe.imageUri}
                        alt={recipe.title}
                        className="size-full object-cover"
                      />
                    </ItemMedia>
                  )}
                  <ItemContent className="gap-1.5">
                    <ViewTransition
                      name={getRecipeTitleTransitionName(recipe.id)}
                      default="none"
                      share="vt-recipe-title"
                    >
                      <ItemTitle className="text-base font-semibold text-foreground group-hover/item:text-primary transition-colors">
                        {recipe.title}
                      </ItemTitle>
                    </ViewTransition>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                      {recipe.averageRating > 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {recipe.averageRating.toFixed(1)}
                        </span>
                      ) : (
                        <span>New</span>
                      )}
                      {recipe.likes > 0 && (
                        <span>
                          • {recipe.likes}{" "}
                          {recipe.likes === 1 ? "like" : "likes"}
                        </span>
                      )}
                      {(recipe.prepTime || recipe.cookTime) && (
                        <span>
                          •{" "}
                          {[
                            recipe.prepTime && `Prep ${recipe.prepTime}`,
                            recipe.cookTime && `Cook ${recipe.cookTime}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                    {recipe.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {recipe.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs font-medium rounded-md bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </ItemContent>
                  <ItemActions className="text-muted-foreground group-hover/item:text-foreground group-hover/item:translate-x-0.5 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}
