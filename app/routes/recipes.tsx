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
  type RecipeSort,
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
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
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

function parseDurationMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  let total = 0;
  let matched = false;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hoursMatch) {
    total += parseFloat(hoursMatch[1]) * 60;
    matched = true;
  }

  const minsMatch = text.match(
    /(?:\d+(?:\.\d+)?\s*[-\u2013]\s*)?(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i
  );
  if (minsMatch) {
    total += parseFloat(minsMatch[1]);
    matched = true;
  }

  if (matched) {
    return Math.round(total);
  }

  const bareNumber = text.match(/^(\d+(?:\.\d+)?)$/);
  return bareNumber ? Math.round(parseFloat(bareNumber[1])) : null;
}

function formatTotalMinutes(
  prepTime: string | undefined,
  cookTime: string | undefined
): string | null {
  const prepMins = parseDurationMinutes(prepTime);
  const cookMins = parseDurationMinutes(cookTime);
  if (prepMins === null && cookMins === null) {
    return null;
  }
  const total = (prepMins ?? 0) + (cookMins ?? 0);
  if (total <= 0) {
    return null;
  }
  return `${total} ${total === 1 ? "minute" : "minutes"}`;
}

const DEFAULT_SORT: RecipeSort = "newest";

function parseSortParam(raw: string | null): RecipeSort {
  return raw === "title" || raw === "rating" || raw === "likes"
    ? raw
    : DEFAULT_SORT;
}

function parseFiltersFromUrl(requestUrl: string): RecipeFilters {
  const url = new URL(requestUrl);
  const rawMinRating = Number(url.searchParams.get("minRating"));
  const rawTags = url.searchParams.get("tags");

  return {
    searchTerm: url.searchParams.get("q")?.trim() || undefined,
    minRating:
      !Number.isNaN(rawMinRating) && rawMinRating > 0
        ? rawMinRating
        : undefined,
    tags: rawTags ? rawTags.split(",").filter(Boolean) : undefined,
    sort: parseSortParam(url.searchParams.get("sort")),
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
          <BookOpen aria-hidden="true" className="h-6 w-6" />
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
  const sortParam = parseSortParam(searchParams.get("sort"));

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
      {sortParam !== DEFAULT_SORT && (
        <input type="hidden" name="sort" value={sortParam} />
      )}

      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
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
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )
      )}
    </Form>
  );
};

const SORT_OPTIONS: ReadonlyArray<{ value: RecipeSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "title", label: "Alphabetical" },
  { value: "rating", label: "Rating" },
  { value: "likes", label: "Likes" },
];

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
  const sortBy = parseSortParam(activeSearchParams.get("sort"));
  const selectedTags =
    activeSearchParams.get("tags")?.split(",").filter(Boolean) || [];
  const minRating = Number(activeSearchParams.get("minRating")) || 0;

  const submitFilterUpdates = (updates: {
    minRating?: number;
    tags?: string[];
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

    submit(nextParams, {
      method: "get",
      action: recipesPath,
      replace: true,
    });
  };

  const hasPanelFilters = minRating > 0 || selectedTags.length > 0;

  const resetParams = new URLSearchParams();
  if (queryText) {
    resetParams.set("q", queryText);
  }
  if (sortBy !== DEFAULT_SORT) {
    resetParams.set("sort", sortBy);
  }
  const resetQs = resetParams.toString();
  const resetHref = resetQs ? `${recipesPath}?${resetQs}` : recipesPath;

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
        aria-controls="recipe-filter-form"
        className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors md:hidden"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            aria-hidden="true"
            className="w-4 h-4 text-muted-foreground"
          />
          <span className="font-medium">Filter</span>
          {hasPanelFilters && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
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
      <div className="hidden md:flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            aria-hidden="true"
            className="w-4 h-4 text-muted-foreground"
          />
          <h2 className="text-sm font-semibold text-foreground">Filter</h2>
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
        id="recipe-filter-form"
        method="get"
        action={recipesPath}
        className={cn(
          "border-t p-4 md:border-t-0 md:p-0 md:pt-1",
          !isOpen && "hidden md:block"
        )}
      >
        {queryText && <input type="hidden" name="q" value={queryText} />}
        {sortBy !== DEFAULT_SORT && (
          <input type="hidden" name="sort" value={sortBy} />
        )}
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
                  className="p-1.5 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    aria-hidden="true"
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
            </FieldSet>
          )}

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
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const [filterOpen, setFilterOpen] = useState(false);

  const activeSearchParams =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath
      ? new URLSearchParams(navigation.location.search)
      : searchParams;

  const activeQueryText = searchParams.get("q")?.trim() || "";
  const activeMinRating = Number(searchParams.get("minRating")) || 0;
  const activeTags =
    searchParams.get("tags")?.split(",").filter(Boolean) || [];
  const activeSort = parseSortParam(activeSearchParams.get("sort"));
  const hasFilters =
    Boolean(activeQueryText) || activeMinRating > 0 || activeTags.length > 0;

  if ((!recipes || recipes.length === 0) && !hasFilters) {
    return <ZeroState ssr={ssr} />;
  }

  const handleSortChange = (nextSortValue: string) => {
    const nextSort = parseSortParam(nextSortValue);
    const nextParams = new URLSearchParams(activeSearchParams);
    if (nextSort !== DEFAULT_SORT) {
      nextParams.set("sort", nextSort);
    } else {
      nextParams.delete("sort");
    }
    submit(nextParams, {
      method: "get",
      action: recipesPath,
      replace: true,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-4">
      <div className="md:col-start-2 md:row-start-1">
        <SearchBar ssr={ssr} />
      </div>

      <aside
        aria-label="Recipe filters"
        className="md:col-start-1 md:row-start-1 md:row-span-2 md:sticky md:top-6 md:self-start"
      >
        <FilterPanel
          isOpen={filterOpen}
          onToggle={() => setFilterOpen(!filterOpen)}
          availableTags={topTags}
          ssr={ssr}
        />
      </aside>

      <section
        aria-labelledby="recipes-heading"
        className="min-w-0 md:col-start-2 md:row-start-2"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1
            id="recipes-heading"
            className="text-base font-semibold text-foreground"
          >
            Recipes{" "}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              ({recipes.length})
            </span>
          </h1>

          <div className="flex items-center gap-2">
            <label
              htmlFor="recipe-sort"
              className="text-xs font-medium text-muted-foreground"
            >
              Sort
            </label>
            <Select
              id="recipe-sort"
              name="sort"
              value={activeSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className={cn(
                "h-8 w-auto rounded-lg bg-card pl-2.5 pr-7 text-xs font-medium text-foreground md:text-xs",
                ssr && "ssr"
              )}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {!recipes || recipes.length === 0 ? (
          <ViewTransition
            key="empty-results"
            default="none"
            enter="vt-recipe-card-enter"
            exit="vt-recipe-card-exit"
          >
            <div
              className={cn(
                "space-y-4 rounded-xl border bg-card px-6 py-12 text-center shadow-xs",
                ssr && "ssr"
              )}
            >
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {activeQueryText ? (
                  <Sparkles aria-hidden="true" className="size-5" />
                ) : (
                  <Search aria-hidden="true" className="size-5" />
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
                    ? "Want Gemini to turn that into a fresh recipe?"
                    : "Try adjusting or clearing your filters in the Filter panel."}
                </p>
              </div>
              {activeQueryText && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button asChild size="sm" className="gap-1.5">
                    <Link
                      to={`${href("/generate")}?ingredients=${encodeURIComponent(activeQueryText)}`}
                    >
                      <Sparkles aria-hidden="true" className="size-3.5" />
                      <span>Generate a "{activeQueryText}" recipe</span>
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </ViewTransition>
        ) : (
          <ul className="group/item-group flex flex-col gap-3">
            {recipes.map((recipe: Recipe) => {
              const totalMinutesLabel = formatTotalMinutes(
                recipe.prepTime,
                recipe.cookTime
              );
              return (
                <ViewTransition
                  key={recipe.id}
                  default="none"
                  enter="vt-recipe-card-enter"
                  exit="vt-recipe-card-exit"
                  update="vt-recipe-card-move"
                >
                  <li>
                    <Item
                      asChild
                      variant="outline"
                      className={cn(
                        "rounded-xl bg-card px-5 py-3.5 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all",
                        ssr && "ssr"
                      )}
                    >
                      <Link
                        to={href("/recipes/:recipeId", { recipeId: recipe.id })}
                      >
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
                            <ItemTitle
                              asChild
                              className="mb-1.5 text-base font-semibold text-foreground group-hover/item:text-primary transition-colors"
                            >
                              <h2>{recipe.title}</h2>
                            </ItemTitle>
                          </ViewTransition>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                            {recipe.averageRating > 0 ? (
                              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                <Star
                                  aria-hidden="true"
                                  className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                                />
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
                            {totalMinutesLabel && (
                              <span>• {totalMinutesLabel}</span>
                            )}
                          </div>
                          {recipe.tags?.length > 0 && (
                            <ul
                              aria-label="Tags"
                              className="flex flex-wrap gap-1.5 pt-0.5"
                            >
                              {recipe.tags.map((tag) => (
                                <li
                                  key={tag}
                                  className="px-2 py-0.5 text-xs font-medium rounded-md bg-muted text-muted-foreground"
                                >
                                  {tag}
                                </li>
                              ))}
                            </ul>
                          )}
                        </ItemContent>
                        <ItemActions className="text-muted-foreground group-hover/item:text-foreground group-hover/item:translate-x-0.5 transition-all">
                          <ChevronRight aria-hidden="true" className="w-5 h-5" />
                        </ItemActions>
                      </Link>
                    </Item>
                  </li>
                </ViewTransition>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
