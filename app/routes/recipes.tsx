import { useEffect, useState, ViewTransition, type FC } from "react";
import {
  data,
  href,
  Link,
  redirect,
  useLocation,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { BookOpen, Heart, Search, Sparkles } from "lucide-react";
import type { Route } from "./+types/recipes";
import { useAuthUser, waitForAuthReady } from "@/firebase/auth";
import {
  getTop5Tags,
  MAX_RECIPES_LIMIT,
  queryRecipes,
  RECIPES_LIMIT_STEP,
  type Recipe,
} from "@/firebase/data";
import { FilterPanel } from "@/components/FilterPanel";
import { RecipeCard } from "@/components/RecipeCard";
import { SearchBar } from "@/components/SearchBar";
import { SortControl } from "@/components/SortControl";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  buildRecipesReturnState,
  type RecipesReturnState,
} from "@/lib/navigation";
import {
  clearResolvedInFlightSearch,
  consumeCatalogSearchDebounce,
  isLikedFilterEnabled,
  parseFiltersFromUrl,
  parseLimitParam,
} from "@/lib/recipes-catalog";
import { isDebugSsrEnabled } from "@/lib/ssr";
import { cn } from "@/lib/utils";

// Omit `s-maxage` so Firebase App Hosting's Cloud CDN honors `stale-while-revalidate`
const PUBLIC_RECIPES_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";

const SEARCH_DEBOUNCE_MS = 300;

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
        likedResolvedForUid: null as string | null,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }

  const payload = await loadRecipesCatalog(request);
  const cacheControl = isDebugSsrEnabled(url.searchParams)
    ? "private, no-store"
    : PUBLIC_RECIPES_CACHE_CONTROL;
  return data(
    {
      ...payload,
      ssr: true,
      likedResolvedForUid: null as string | null,
    },
    {
      headers: { "Cache-Control": cacheControl },
    }
  );
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
  const url = new URL(request.url);
  const requestSearch = url.searchParams.toString();

  if (consumeCatalogSearchDebounce(requestSearch)) {
    const ready = await waitWithSignal(SEARCH_DEBOUNCE_MS, request.signal);
    if (!ready) {
      // Aborted by a newer keystroke or navigation; router discards this result via request.signal.aborted
      return {
        recipes: [],
        hasMore: false,
        topTags: [],
        ssr: false,
        likedResolvedForUid: null as string | null,
      };
    }
  }

  if (isLikedFilterEnabled(url.searchParams.get("liked"))) {
    const user = await waitForAuthReady();
    if (!user) {
      clearResolvedInFlightSearch(requestSearch, request.signal.aborted);
      url.searchParams.delete("liked");
      url.searchParams.delete("limit");
      const fallbackQs = url.searchParams.toString();
      throw redirect(
        fallbackQs ? `${href("/recipes")}?${fallbackQs}` : href("/recipes")
      );
    }
    const payload = await loadRecipesCatalog(request, user.uid);
    clearResolvedInFlightSearch(requestSearch, request.signal.aborted);
    return {
      ...payload,
      ssr: false,
      likedResolvedForUid: user.uid,
    };
  }

  const payload = await loadRecipesCatalog(request);
  clearResolvedInFlightSearch(requestSearch, request.signal.aborted);
  return {
    ...payload,
    ssr: false,
    likedResolvedForUid: null as string | null,
  };
}

const ZeroState: FC<{
  ssr: boolean;
  returnState?: RecipesReturnState;
}> = ({ ssr, returnState }) => {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
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
            <Link to={href("/generate")} state={returnState} prefetch="intent">
              Generate Recipe
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
};

export default function RecipesPage({ loaderData }: Route.ComponentProps) {
  const { recipes, hasMore, topTags, ssr, likedResolvedForUid } = loaderData;
  const { user, authReady } = useAuthUser();
  const location = useLocation();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
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

  const currentUid = user?.uid ?? null;

  // Hydrate or redirect `?liked=1` via clientLoader once browser Firebase Auth is ready
  useEffect(() => {
    if (
      activeLikedOnly &&
      authReady &&
      (ssr || likedResolvedForUid !== currentUid) &&
      revalidator.state === "idle" &&
      navigation.state === "idle"
    ) {
      void revalidator.revalidate();
    }
  }, [
    activeLikedOnly,
    authReady,
    ssr,
    likedResolvedForUid,
    currentUid,
    revalidator,
    navigation.state,
  ]);

  if ((!recipes || recipes.length === 0) && !hasFilters) {
    return <ZeroState ssr={ssr} returnState={returnState} />;
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
    (!authReady || ssr || likedResolvedForUid !== currentUid);

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
            className="font-display text-2xl font-normal text-foreground"
          >
            Recipes{" "}
            <span className="font-serif text-sm font-normal tracking-normal text-muted-foreground tabular-nums">
              ({countLabel})
            </span>
          </h1>

          <SortControl ssr={ssr} />
        </div>

        {isResolvingLikedCatalog ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-md border bg-card px-6 py-12 text-center shadow-xs",
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
                "space-y-4 rounded-md border bg-card px-6 py-12 text-center shadow-xs",
                ssr && "ssr"
              )}
            >
              <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
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
                  <Button asChild size="sm">
                    <Link
                      to={`${href("/generate")}?ingredients=${encodeURIComponent(activeQueryText)}`}
                      state={returnState}
                      prefetch="intent"
                    >
                      Generate a "{activeQueryText}" recipe
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </ViewTransition>
        ) : (
          <>
            <ul className="group/item-group flex flex-col gap-3">
              {recipes.map((recipe: Recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  returnState={returnState}
                  ssr={ssr}
                />
              ))}
            </ul>

            {hasMore && (
              <div className="mt-6 flex justify-center text-center">
                {currentLimit < MAX_RECIPES_LIMIT ? (
                  isLoadingMore ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      className={cn(
                        "h-10 w-full sm:w-auto rounded-md bg-card px-6 shadow-xs disabled:opacity-100",
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
                        "h-10 w-full sm:w-auto rounded-md bg-card px-6 shadow-xs hover:border-primary/40 hover:bg-accent/50",
                        ssr && "ssr"
                      )}
                    >
                      <Link to={showMoreHref} replace preventScrollReset>
                        Show more recipes
                      </Link>
                    </Button>
                  )
                ) : (
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
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
