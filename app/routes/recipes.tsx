import { useEffect, useRef, useState, type FC } from "react";
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
  ChevronUp,
  Search,
  SlidersHorizontal,
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
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";

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
      <Empty className={cn(ssr && "ssr")}>
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
      className="relative mb-3"
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

const FilterPanel: FC<{
  isOpen: boolean;
  onToggle: () => void;
  availableTags: string[];
  ssr: boolean;
}> = ({ isOpen, onToggle, availableTags, ssr }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const isFiltering =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath;

  const queryText = searchParams.get("q") || "";
  const sortBy =
    (searchParams.get("sort") as "rating" | "title" | "likes" | "none") ||
    "none";
  const initialSelectedTags =
    searchParams.get("tags")?.split(",").filter(Boolean) || [];
  const initialMinRating = Number(searchParams.get("minRating")) || 0;

  const [minRating, setMinRating] = useState(initialMinRating);
  const [selectedTags, setSelectedTags] =
    useState<string[]>(initialSelectedTags);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleLocalReset = () => {
    formRef.current?.reset();
    setMinRating(0);
    setSelectedTags([]);
  };

  const hasPanelFilters =
    initialMinRating > 0 ||
    initialSelectedTags.length > 0 ||
    Boolean(sortBy && sortBy !== "none");

  const resetHref = queryText
    ? `${recipesPath}?q=${encodeURIComponent(queryText)}`
    : recipesPath;

  return (
    <div
      className={cn(
        "bg-card border rounded-xl mb-6 overflow-hidden",
        ssr && "ssr"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Filters & Sort</span>
          {hasPanelFilters && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
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

      {isOpen && (
        <Form
          method="get"
          action={recipesPath}
          className="p-4 border-t"
          ref={formRef}
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

          <FieldGroup>
            <Field>
              <FieldLabel>Minimum Rating</FieldLabel>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Minimum ${star} star${star === 1 ? "" : "s"}`}
                    onClick={() =>
                      setMinRating(star === minRating ? 0 : star)
                    }
                    className="p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star
                      className={`w-7 h-7 cursor-pointer transition-all ${
                        star <= minRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30 hover:text-amber-400"
                      }`}
                    />
                  </button>
                ))}
                {minRating > 0 && (
                  <button
                    type="button"
                    onClick={() => setMinRating(0)}
                    className="ml-2 text-xs text-muted-foreground hover:text-foreground"
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
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                        selectedTags.includes(tag)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field>
              <FieldLabel>Sort By</FieldLabel>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="none"
                    defaultChecked={!sortBy || sortBy === "none"}
                    className="accent-primary"
                  />
                  <span className="text-sm">No sort</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="rating"
                    defaultChecked={sortBy === "rating"}
                    className="accent-primary"
                  />
                  <span className="text-sm">Rating</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="title"
                    defaultChecked={sortBy === "title"}
                    className="accent-primary"
                  />
                  <span className="text-sm">Alphabetical</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="likes"
                    defaultChecked={sortBy === "likes"}
                    className="accent-primary"
                  />
                  <span className="text-sm">Likes</span>
                </label>
              </div>
            </Field>

            <div className="flex gap-3 pt-2">
              {hasPanelFilters ? (
                <Button asChild variant="outline" className="flex-1">
                  <Link to={resetHref}>Reset</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLocalReset}
                  className="flex-1"
                >
                  Reset
                </Button>
              )}
              <Button type="submit" disabled={isFiltering} className="flex-1">
                {isFiltering ? "Filtering..." : "Apply Filters"}
              </Button>
            </div>
          </FieldGroup>
        </Form>
      )}
    </div>
  );
};

export default function RecipesPage({ loaderData }: Route.ComponentProps) {
  const { recipes, topTags, ssr } = loaderData;
  const [searchParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);

  const hasFilters = Array.from(searchParams.entries()).some(
    ([key, value]) => Boolean(value) && !(key === "sort" && value === "none")
  );

  if ((!recipes || recipes.length === 0) && !hasFilters) {
    return <ZeroState ssr={ssr} />;
  }

  const panelFilterKey = [
    searchParams.get("minRating") || "",
    searchParams.get("tags") || "",
    searchParams.get("sort") || "",
  ].join("|");

  return (
    <div>
      <SearchBar ssr={ssr} />
      <FilterPanel
        key={panelFilterKey}
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        availableTags={topTags}
        ssr={ssr}
      />
      {!recipes || recipes.length === 0 ? (
        <div
          className={cn(
            "text-center py-12 rounded-xl border bg-card",
            ssr && "ssr"
          )}
        >
          <p className="text-muted-foreground">
            No recipes match your search or filters.
          </p>
          <Button asChild variant="link" className="mt-2">
            <Link to={href("/recipes")}>Clear search & filters</Link>
          </Button>
        </div>
      ) : (
        <>
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </h3>
          <ItemGroup className="gap-4">
            {recipes.map((recipe: Recipe) => (
              <Item
                key={recipe.id}
                variant="outline"
                className={cn(ssr && "ssr")}
              >
                {isSafeImageUrl(recipe.imageUri) && (
                  <ItemMedia className="p-0 overflow-hidden rounded-md border bg-muted/5 flex items-center justify-center shrink-0">
                    <img
                      src={recipe.imageUri}
                      alt={recipe.title}
                      className="max-h-20 max-w-20 object-contain"
                    />
                  </ItemMedia>
                )}
                <ItemContent>
                  <ItemTitle>{recipe.title}</ItemTitle>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="flex"
                      aria-label={`Rating: ${recipe.averageRating || 0} out of 5`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= (recipe.averageRating || 0)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>•</span>
                      <span>{recipe.likes || 0} likes</span>
                    </div>
                  </div>
                  <ItemDescription>
                    {recipe.tags?.join(", ") || "No tags"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={href("/recipes/:recipeId", { recipeId: recipe.id })}
                    >
                      Open
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </>
      )}
    </div>
  );
}
