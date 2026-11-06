import { useEffect, useRef, useState, ViewTransition, type FC } from "react";
import {
  data,
  Form,
  href,
  Link,
  redirect,
  useLocation,
  useNavigation,
  useRevalidator,
  useSearchParams,
  useSubmit,
} from "react-router";
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Heart,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { Route } from "./+types/recipes";
import { useAuthUser, waitForAuthReady } from "@/firebase/auth";
import {
  DEFAULT_RECIPES_LIMIT,
  doesPreviewMatchFilters,
  getTop5Tags,
  MAX_RECIPES_LIMIT,
  queryRecipes,
  RECIPES_LIMIT_STEP,
  subscribeToRecipesCollection,
  type LiveRecipePreview,
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
import {
  buildRecipesReturnState,
  type RecipesReturnState,
} from "@/lib/navigation";
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

function parseLimitParam(raw: string | null): number {
  if (!raw) {
    return DEFAULT_RECIPES_LIMIT;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_RECIPES_LIMIT;
  }
  return Math.min(MAX_RECIPES_LIMIT, Math.floor(parsed));
}

function isLikedFilterEnabled(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

function parseFiltersFromUrl(
  requestUrl: string,
  likedByUserId?: string
): RecipeFilters {
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
    likedByUserId,
    sort: parseSortParam(url.searchParams.get("sort")),
    limit: parseLimitParam(url.searchParams.get("limit")),
  };
}

async function loadRecipesCatalog(request: Request, likedByUserId?: string) {
  const filters = parseFiltersFromUrl(request.url, likedByUserId);
  const [{ recipes, hasMore }, topTags] = await Promise.all([
    queryRecipes(filters),
    getTop5Tags(),
  ]);
  return { recipes, hasMore, topTags };
}

// Initial HTML request renders on Cloud Run so search engines and agents get full HTML
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  if (isLikedFilterEnabled(url.searchParams.get("liked"))) {
    // Firebase Auth lives in browser IndexedDB; defer liked-recipes resolution to hydration
    const topTags = await getTop5Tags();
    return data(
      {
        recipes: [] as Recipe[],
        hasMore: false,
        topTags,
        ssr: true,
        awaitingClientLikes: true,
        likedResolvedForUid: null as string | null,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }

  const payload = await loadRecipesCatalog(request);
  return data(
    {
      ...payload,
      ssr: true,
      awaitingClientLikes: false,
      likedResolvedForUid: null as string | null,
    },
    {
      headers: { "Cache-Control": PUBLIC_RECIPES_CACHE_CONTROL },
    }
  );
}

const SEARCH_DEBOUNCE_MS = 300;
let debounceCatalogUntil = 0;

function setSearchDebouncePending(pending: boolean) {
  debounceCatalogUntil = pending ? Date.now() + 100 : 0;
}

function consumeSearchDebounce(): boolean {
  const shouldDebounce = Date.now() < debounceCatalogUntil;
  debounceCatalogUntil = 0;
  return shouldDebounce;
}

function waitWithSignal(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// Subsequent navigations and filter submissions run directly in the browser against Firestore
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  if (consumeSearchDebounce()) {
    const ready = await waitWithSignal(SEARCH_DEBOUNCE_MS, request.signal);
    if (!ready) {
      // Aborted by a newer keystroke or navigation; router discards this result via request.signal.aborted
      return {
        recipes: [],
        hasMore: false,
        topTags: [],
        ssr: false,
        awaitingClientLikes: false,
        likedResolvedForUid: null as string | null,
      };
    }
  }

  const url = new URL(request.url);
  if (isLikedFilterEnabled(url.searchParams.get("liked"))) {
    const user = await waitForAuthReady();
    if (!user) {
      url.searchParams.delete("liked");
      url.searchParams.delete("limit");
      const fallbackQs = url.searchParams.toString();
      throw redirect(
        fallbackQs ? `${href("/recipes")}?${fallbackQs}` : href("/recipes")
      );
    }
    const payload = await loadRecipesCatalog(request, user.uid);
    return {
      ...payload,
      ssr: false,
      awaitingClientLikes: false,
      likedResolvedForUid: user.uid,
    };
  }

  const payload = await loadRecipesCatalog(request);
  return {
    ...payload,
    ssr: false,
    awaitingClientLikes: false,
    likedResolvedForUid: null as string | null,
  };
}

const NewRecipesBanner: FC<{
  count: number;
  isRefreshing: boolean;
  onShow: () => void;
}> = ({ count, isRefreshing, onShow }) => {
  if (count <= 0) {
    return null;
  }
  return (
    <ViewTransition
      key="new-recipes-banner"
      default="none"
      enter="vt-recipe-card-enter"
      exit="vt-recipe-card-exit"
    >
      <div className="mb-3 flex justify-center">
        <button
          type="button"
          disabled={isRefreshing}
          onClick={onShow}
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 font-serif text-xs font-medium text-primary shadow-xs transition-all hover:border-primary/50 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
        >
          {isRefreshing ? (
            <Spinner className="size-3.5" />
          ) : (
            <ArrowUp aria-hidden="true" className="size-3.5" />
          )}
          <span>
            {isRefreshing
              ? "Loading new recipes..."
              : `${count} new ${count === 1 ? "recipe" : "recipes"} — Show`}
          </span>
        </button>
      </div>
    </ViewTransition>
  );
};

interface PendingRecipeEntry {
  preview: LiveRecipePreview;
  forLoaderData: Route.ComponentProps["loaderData"];
}

function usePendingNewRecipes(
  loaderData: Route.ComponentProps["loaderData"],
  activeFilters: Pick<RecipeFilters, "searchTerm" | "tags" | "minRating"> & {
    likedOnly?: boolean;
  }
): number {
  const latestLoaderDataRef = useRef(loaderData);
  const baselineIdsRef = useRef<Set<string>>(
    new Set(loaderData.recipes.map((r) => r.id))
  );
  const [pendingEntries, setPendingEntries] = useState<PendingRecipeEntry[]>(
    []
  );

  useEffect(() => {
    latestLoaderDataRef.current = loaderData;
    for (const recipe of loaderData.recipes) {
      baselineIdsRef.current.add(recipe.id);
    }
  }, [loaderData]);

  useEffect(() => {
    return subscribeToRecipesCollection((event) => {
      if (event.type === "initial") {
        for (const id of event.ids) {
          baselineIdsRef.current.add(id);
        }
        return;
      }

      const currentData = latestLoaderDataRef.current;

      if (event.removedIds.length > 0) {
        for (const id of event.removedIds) {
          baselineIdsRef.current.delete(id);
        }
      }

      setPendingEntries((prev) => {
        const active = prev.filter(
          (entry) =>
            entry.forLoaderData === currentData &&
            !event.removedIds.includes(entry.preview.id)
        );
        const byId = new Map(active.map((entry) => [entry.preview.id, entry]));

        for (const modified of event.modified) {
          const existing = byId.get(modified.id);
          if (existing) {
            byId.set(modified.id, {
              preview: modified,
              forLoaderData: existing.forLoaderData,
            });
          }
        }

        for (const added of event.added) {
          if (!baselineIdsRef.current.has(added.id)) {
            baselineIdsRef.current.add(added.id);
            byId.set(added.id, {
              preview: added,
              forLoaderData: currentData,
            });
          }
        }

        return Array.from(byId.values());
      });
    });
  }, []);

  const loadedIds = new Set(loaderData.recipes.map((r) => r.id));
  let count = 0;
  for (const entry of pendingEntries) {
    if (
      entry.forLoaderData === loaderData &&
      !loadedIds.has(entry.preview.id) &&
      doesPreviewMatchFilters(entry.preview, activeFilters)
    ) {
      count += 1;
    }
  }
  return count;
}

const ZeroState: FC<{
  ssr: boolean;
  returnState?: RecipesReturnState;
  newRecipesCount: number;
  isRefreshingNew: boolean;
  onShowNew: () => void;
}> = ({ ssr, returnState, newRecipesCount, isRefreshingNew, onShowNew }) => {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
      <NewRecipesBanner
        count={newRecipesCount}
        isRefreshing={isRefreshingNew}
        onShow={onShowNew}
      />
      <Empty className={cn("border border-dashed bg-card", ssr && "ssr")}>
        <EmptyMedia variant="icon">
          <BookOpen aria-hidden="true" className="h-6 w-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No recipes yet</EmptyTitle>
          <EmptyDescription>
            Generate a recipe with Gemini to start building the community
            cookbook.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to={href("/generate")} state={returnState}>
              Generate Recipe
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
};

interface SearchLocationState {
  isSearchSubmission?: boolean;
}

const SearchBar: FC<{ ssr: boolean }> = ({ ssr }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");

  const inputRef = useRef<HTMLInputElement | null>(null);

  const urlQuery = searchParams.get("q") || "";
  const [initialQuery] = useState(urlQuery);
  const [hasText, setHasText] = useState(Boolean(urlQuery));

  // Native "popstate" fires exclusively on browser Back/Forward (never on pushState/replaceState)
  useEffect(() => {
    const handlePopState = () => {
      const poppedQuery =
        new URLSearchParams(window.location.search).get("q") || "";
      if (inputRef.current) {
        inputRef.current.value = poppedQuery;
      }
      setHasText(Boolean(poppedQuery));
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Sync uncontrolled input on external non-search navigations (e.g. header brand reset link)
  useEffect(() => {
    const state = location.state as SearchLocationState | null;
    if (
      !state?.isSearchSubmission &&
      location.key &&
      inputRef.current &&
      document.activeElement !== inputRef.current
    ) {
      inputRef.current.value = urlQuery;
      setHasText(Boolean(urlQuery));
    }
  }, [location, urlQuery]);

  const activeSearchParams =
    navigation.state !== "idle" && navigation.location?.pathname === recipesPath
      ? new URLSearchParams(navigation.location.search)
      : searchParams;

  const submitSearch = (nextValue: string, immediate = false) => {
    const trimmed = nextValue.trim();
    const nextParams = new URLSearchParams(activeSearchParams);
    nextParams.delete("limit");
    if (trimmed) {
      nextParams.set("q", nextValue);
    } else {
      nextParams.delete("q");
    }

    const hadCommittedQuery = Boolean(searchParams.get("q"));
    setSearchDebouncePending(!immediate);

    void submit(nextParams, {
      method: "get",
      action: recipesPath,
      replace: hadCommittedQuery || !trimmed,
      preventScrollReset: true,
      state: { isSearchSubmission: true } satisfies SearchLocationState,
    });
  };

  const isSearching =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath &&
    (new URLSearchParams(navigation.location.search).get("q") || "") !==
      urlQuery;

  const minRatingParam = activeSearchParams.get("minRating");
  const tagsParam = activeSearchParams.get("tags");
  const likedOnlyParam = isLikedFilterEnabled(activeSearchParams.get("liked"));
  const sortParam = parseSortParam(activeSearchParams.get("sort"));
  const debugSsrParam = activeSearchParams.get("debugSSR");

  return (
    <Form
      method="get"
      action={recipesPath}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch(inputRef.current?.value ?? "", true);
      }}
      className="relative"
    >
      {minRatingParam && (
        <input type="hidden" name="minRating" value={minRatingParam} />
      )}
      {tagsParam && <input type="hidden" name="tags" value={tagsParam} />}
      {likedOnlyParam && <input type="hidden" name="liked" value="1" />}
      {sortParam !== DEFAULT_SORT && (
        <input type="hidden" name="sort" value={sortParam} />
      )}
      {debugSsrParam !== null && (
        <input type="hidden" name="debugSSR" value={debugSsrParam} />
      )}

      {isSearching ? (
        <Spinner className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      ) : (
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Input
        ref={inputRef}
        id="recipe-search"
        name="q"
        type="search"
        aria-label="Search recipes"
        placeholder="Search recipes by title, ingredient, or tag..."
        defaultValue={initialQuery}
        onChange={(e) => {
          const next = e.target.value;
          setHasText(next.length > 0);
          submitSearch(next);
        }}
        className={cn(
          "h-11 rounded-xl bg-card pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden",
          ssr && "ssr"
        )}
      />
      {hasText && (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = "";
              inputRef.current.focus();
            }
            setHasText(false);
            submitSearch("", true);
          }}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
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
  canFilterByLikes: boolean;
  isSignedOut: boolean;
  ssr: boolean;
}> = ({
  isOpen,
  onToggle,
  availableTags,
  canFilterByLikes,
  isSignedOut,
  ssr,
}) => {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const [hoveredStar, setHoveredStar] = useState(0);

  const activeSearchParams =
    navigation.state !== "idle" && navigation.location?.pathname === recipesPath
      ? new URLSearchParams(navigation.location.search)
      : searchParams;

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
    const nextParams = new URLSearchParams(activeSearchParams);
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

    setSearchDebouncePending(false);
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
          <span className="font-display text-lg font-normal tracking-wide">
            Filter
          </span>
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
      <div className="hidden md:flex items-center gap-2 pb-3">
        <SlidersHorizontal
          aria-hidden="true"
          className="w-4 h-4 text-muted-foreground"
        />
        <h2 className="text-lg font-normal text-foreground">Filter</h2>
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
        {likedOnly && <input type="hidden" name="liked" value="1" />}
        {minRating > 0 && (
          <input type="hidden" name="minRating" value={String(minRating)} />
        )}
        {selectedTags.length > 0 && (
          <input type="hidden" name="tags" value={selectedTags.join(",")} />
        )}
        {debugSsrParam !== null && (
          <input type="hidden" name="debugSSR" value={debugSsrParam} />
        )}

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
                    ? "fill-rose-500 text-rose-500"
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
            <div className="flex justify-start border-t border-border/60 pt-3 md:border-t-0 md:pt-0">
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
      </Form>
    </div>
  );
};

const SortControl: FC<{ ssr: boolean }> = ({ ssr }) => {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");

  const activeSearchParams =
    navigation.state !== "idle" && navigation.location?.pathname === recipesPath
      ? new URLSearchParams(navigation.location.search)
      : searchParams;

  const activeSort = parseSortParam(activeSearchParams.get("sort"));

  const handleSortChange = (nextSortValue: string) => {
    const nextSort = parseSortParam(nextSortValue);
    const nextParams = new URLSearchParams(activeSearchParams);
    nextParams.delete("limit");
    if (nextSort !== DEFAULT_SORT) {
      nextParams.set("sort", nextSort);
    } else {
      nextParams.delete("sort");
    }
    setSearchDebouncePending(false);
    void submit(nextParams, {
      method: "get",
      action: recipesPath,
      replace: true,
      preventScrollReset: true,
    });
  };

  return (
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
  );
};

export default function RecipesPage({ loaderData }: Route.ComponentProps) {
  const {
    recipes,
    hasMore,
    topTags,
    ssr,
    awaitingClientLikes,
    likedResolvedForUid,
  } = loaderData;
  const { user, authReady } = useAuthUser();
  const location = useLocation();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);

  const recipesPath = href("/recipes");
  const currentCatalogSearch =
    navigation.state !== "idle" && navigation.location?.pathname === recipesPath
      ? navigation.location.search
      : location.search;
  const returnState = buildRecipesReturnState(currentCatalogSearch);

  const activeQueryText = searchParams.get("q")?.trim() || "";
  const activeLikedOnly = isLikedFilterEnabled(searchParams.get("liked"));
  const activeMinRating = Number(searchParams.get("minRating")) || 0;
  const activeTags = searchParams.get("tags")?.split(",").filter(Boolean) || [];
  const hasFilters =
    activeLikedOnly ||
    Boolean(activeQueryText) ||
    activeMinRating > 0 ||
    activeTags.length > 0;

  // Hydrate or clean up `?liked=1` when SSR deferred auth resolution (or if auth changes)
  useEffect(() => {
    if (!activeLikedOnly || !authReady) {
      return;
    }
    if (!user) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("liked");
      nextParams.delete("limit");
      setSearchDebouncePending(false);
      void submit(nextParams, {
        method: "get",
        action: recipesPath,
        replace: true,
        preventScrollReset: true,
      });
      return;
    }
    if (
      (awaitingClientLikes || likedResolvedForUid !== user.uid) &&
      revalidator.state === "idle" &&
      navigation.state === "idle"
    ) {
      setSearchDebouncePending(false);
      void revalidator.revalidate();
    }
  }, [
    activeLikedOnly,
    authReady,
    user,
    awaitingClientLikes,
    likedResolvedForUid,
    revalidator,
    navigation.state,
    searchParams,
    submit,
    recipesPath,
  ]);

  const newRecipesCount = usePendingNewRecipes(loaderData, {
    searchTerm: activeQueryText || undefined,
    minRating: activeMinRating > 0 ? activeMinRating : undefined,
    tags: activeTags.length > 0 ? activeTags : undefined,
    likedOnly: activeLikedOnly,
  });
  const isRefreshingNew = revalidator.state === "loading";
  const handleShowNew = () => {
    setSearchDebouncePending(false);
    void revalidator.revalidate();
  };

  if ((!recipes || recipes.length === 0) && !hasFilters) {
    return (
      <ZeroState
        ssr={ssr}
        returnState={returnState}
        newRecipesCount={newRecipesCount}
        isRefreshingNew={isRefreshingNew}
        onShowNew={handleShowNew}
      />
    );
  }

  const currentLimit = parseLimitParam(searchParams.get("limit"));
  const nextLimit = Math.min(
    MAX_RECIPES_LIMIT,
    currentLimit + RECIPES_LIMIT_STEP
  );

  const showMoreParams = new URLSearchParams(searchParams);
  showMoreParams.set("limit", String(nextLimit));
  const showMoreHref = `${recipesPath}?${showMoreParams.toString()}`;

  const isLoadingMore =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath &&
    parseLimitParam(
      new URLSearchParams(navigation.location.search).get("limit")
    ) > currentLimit;

  const canFilterByLikes = authReady && Boolean(user);
  const isSignedOut = authReady && !user;
  const isResolvingLikedCatalog =
    activeLikedOnly &&
    (awaitingClientLikes ||
      !authReady ||
      (user !== null && likedResolvedForUid !== user.uid));

  const countLabel = isResolvingLikedCatalog
    ? "…"
    : hasMore
      ? `${recipes.length}+`
      : String(recipes.length);

  const isEmptyLikedOnly =
    activeLikedOnly &&
    !activeQueryText &&
    activeMinRating === 0 &&
    activeTags.length === 0;

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
          canFilterByLikes={canFilterByLikes}
          isSignedOut={isSignedOut}
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
            className="text-2xl font-normal text-foreground"
          >
            Recipes{" "}
            <span className="font-serif text-sm font-normal tracking-normal text-muted-foreground tabular-nums">
              ({countLabel})
            </span>
          </h1>

          <SortControl ssr={ssr} />
        </div>

        <NewRecipesBanner
          count={newRecipesCount}
          isRefreshing={isRefreshingNew}
          onShow={handleShowNew}
        />

        {isResolvingLikedCatalog ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border bg-card px-6 py-12 text-center shadow-xs",
              ssr && "ssr"
            )}
          >
            <Spinner className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading your liked recipes...
            </p>
          </div>
        ) : !recipes || recipes.length === 0 ? (
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
                ) : isEmptyLikedOnly ? (
                  <Heart aria-hidden="true" className="size-5" />
                ) : (
                  <Search aria-hidden="true" className="size-5" />
                )}
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {activeQueryText
                    ? `No recipes found for "${activeQueryText}"`
                    : isEmptyLikedOnly
                      ? "No liked recipes yet"
                      : "No recipes match these filters"}
                </p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  {activeQueryText
                    ? "Want Gemini to turn that into a fresh recipe?"
                    : isEmptyLikedOnly
                      ? "Tap the heart on any recipe to save your favorites here."
                      : "Try adjusting or clearing your filters in the Filter panel."}
                </p>
              </div>
              {activeQueryText && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button asChild size="sm" className="gap-1.5">
                    <Link
                      to={`${href("/generate")}?ingredients=${encodeURIComponent(activeQueryText)}`}
                      state={returnState}
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
          <>
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
                          to={href("/recipes/:recipeId", {
                            recipeId: recipe.id,
                          })}
                          state={returnState}
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
                                className="mb-1 text-xl sm:text-[1.35rem] leading-snug font-normal text-foreground group-hover/item:text-primary transition-colors"
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
                            <ChevronRight
                              aria-hidden="true"
                              className="w-5 h-5"
                            />
                          </ItemActions>
                        </Link>
                      </Item>
                    </li>
                  </ViewTransition>
                );
              })}
            </ul>

            {(hasMore ||
              recipes.length > DEFAULT_RECIPES_LIMIT ||
              searchParams.has("limit")) && (
              <div className="mt-7 mb-2 flex flex-col items-center gap-3 text-center">
                <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  <span aria-hidden="true" className="h-px w-10 bg-border" />
                  <span>
                    {hasMore
                      ? `Showing ${recipes.length} recipes`
                      : `All ${recipes.length} recipes shown`}
                  </span>
                  <span aria-hidden="true" className="h-px w-10 bg-border" />
                </div>

                {hasMore && currentLimit < MAX_RECIPES_LIMIT ? (
                  isLoadingMore ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      className={cn(
                        "h-10 w-full sm:w-auto rounded-xl bg-card px-6 text-base shadow-xs disabled:opacity-100",
                        ssr && "ssr"
                      )}
                    >
                      <Spinner className="size-4" />
                      <span>Loading recipes...</span>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      className={cn(
                        "h-10 w-full sm:w-auto rounded-xl bg-card px-6 text-base shadow-xs hover:border-primary/40 hover:bg-accent/50",
                        ssr && "ssr"
                      )}
                    >
                      <Link
                        to={showMoreHref}
                        replace
                        preventScrollReset
                        onClick={() => setSearchDebouncePending(false)}
                      >
                        Show more recipes
                      </Link>
                    </Button>
                  )
                ) : hasMore ? (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {MAX_RECIPES_LIMIT} recipes.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("recipe-search");
                        el?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        el?.focus();
                      }}
                      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      Search or filter
                    </button>{" "}
                    to narrow down.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to top ↑
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
