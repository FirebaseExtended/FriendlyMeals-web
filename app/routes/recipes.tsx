import {
  startTransition,
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type FC,
  type RefObject,
} from "react";
import {
  data,
  Form,
  href,
  Link,
  NavigationType,
  redirect,
  useFetcher,
  useLocation,
  useNavigation,
  useNavigationType,
  useSearchParams,
  useSubmit,
} from "react-router";
import { BookOpen, Database, Heart, Search, Sparkles } from "lucide-react";
import type { Route } from "./+types/recipes";
import { useAuthUser, getUser } from "@/firebase/auth";
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
  getCatalogFormData,
  isLikedFilterEnabled,
  parseFiltersFromUrl,
  parseLimitParam,
  parseSortParam,
  parseTagsParam,
} from "@/lib/recipes-catalog";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

function clearTimeoutRef(
  timerRef: RefObject<ReturnType<typeof setTimeout> | null>
) {
  if (timerRef.current !== null) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

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
  const payload = await loadRecipesCatalog(request);
  return data(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

let isInitialRecipesRequest = true;

// Hydrates `?liked=1` from IndexedDB auth and runs subsequent navigations directly in the browser
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const wasInitial = isInitialRecipesRequest;
  isInitialRecipesRequest = false;
  const url = new URL(request.url);

  if (isLikedFilterEnabled(url.searchParams.get("liked"))) {
    const user = await getUser();
    if (!user) {
      url.searchParams.delete("liked");
      url.searchParams.delete("limit");
      const fallbackQs = url.searchParams.toString();
      throw redirect(
        fallbackQs ? `${href("/recipes")}?${fallbackQs}` : href("/recipes")
      );
    }
    return loadRecipesCatalog(request, user.uid);
  }

  if (wasInitial) {
    return serverLoader();
  }
  return loadRecipesCatalog(request);
}
clientLoader.hydrate = true as const;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const user = await getUser();
  if (!user) {
    return redirect(
      `${href("/login")}?redirectTo=${encodeURIComponent(href("/recipes"))}`
    );
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "seed") {
    return data(
      { ok: false as const, error: "Unsupported action." },
      { status: 400 }
    );
  }

  try {
    const { seedSampleRecipes } = await import("@/firebase/seed.client");
    await seedSampleRecipes(user.uid);
    return { ok: true as const };
  } catch (error) {
    console.error("[seedSampleRecipes]", error);
    return data(
      {
        ok: false as const,
        error: "Couldn't seed sample recipes right now. Please try again.",
      },
      { status: 500 }
    );
  }
}

const ZeroState: FC = () => {
  const seedFetcher = useFetcher<typeof clientAction>();
  const isSeeding = seedFetcher.state !== "idle";
  const seedError =
    seedFetcher.state === "idle" && seedFetcher.data && !seedFetcher.data.ok
      ? seedFetcher.data.error
      : undefined;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
      <Empty className="border border-dashed bg-card">
        <EmptyMedia variant="icon">
          <BookOpen aria-hidden="true" className="h-6 w-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No recipes yet</EmptyTitle>
          <EmptyDescription>
            Generate a recipe with Gemini or seed starter recipes to build the
            community cookbook.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to={href("/generate")} prefetch="intent">
                Generate Recipe
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSeeding}
              onClick={() => {
                void seedFetcher.submit({ intent: "seed" }, { method: "post" });
              }}
              className={cn(
                "gap-1.5 bg-card",
                isSeeding && "disabled:opacity-100"
              )}
            >
              {isSeeding ? (
                <>
                  <Spinner className="size-4" />
                  <span>Seeding recipes...</span>
                </>
              ) : (
                <>
                  <Database aria-hidden="true" className="size-4" />
                  <span>Seed 20 recipes</span>
                </>
              )}
            </Button>
          </div>
          {seedError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {seedError}
            </p>
          )}
        </EmptyContent>
      </Empty>
    </div>
  );
};

export default function RecipesPage({ loaderData }: Route.ComponentProps) {
  const { recipes, hasMore, topTags } = loaderData;
  const user = useAuthUser();
  const location = useLocation();
  const navigation = useNavigation();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const [filterOpen, setFilterOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSubmitsRef = useRef(0);

  const recipesPath = href("/recipes");

  useEffect(() => () => clearTimeoutRef(searchTimerRef), []);

  // Sync uncontrolled form controls when the committed location changes (e.g. Back/Forward or brand link)
  useEffect(() => {
    if (!formRef.current || pendingSubmitsRef.current > 0) {
      return;
    }

    const committedParams = new URLSearchParams(location.search);
    const form = formRef.current;
    const qInput = form.elements.namedItem("q");
    if (
      qInput instanceof HTMLInputElement &&
      (navigationType === NavigationType.Pop ||
        document.activeElement !== qInput)
    ) {
      clearTimeoutRef(searchTimerRef);
      qInput.value = committedParams.get("q") ?? "";
    }

    const likedInput = form.elements.namedItem("liked");
    if (likedInput instanceof HTMLInputElement) {
      likedInput.checked =
        Boolean(user) && isLikedFilterEnabled(committedParams.get("liked"));
    }

    const minRatingInput = form.elements.namedItem("minRating");
    if (minRatingInput instanceof HTMLInputElement) {
      const rating = Number(committedParams.get("minRating")) || 0;
      minRatingInput.value = rating > 0 ? String(rating) : "";
    }

    const committedTags = new Set(parseTagsParam(committedParams));
    for (const el of form.querySelectorAll<HTMLInputElement>(
      'input[name="tags"]'
    )) {
      el.checked = committedTags.has(el.value);
    }

    const sortSelect = form.elements.namedItem("sort");
    if (sortSelect instanceof HTMLSelectElement) {
      sortSelect.value = parseSortParam(committedParams.get("sort"));
    }
  }, [location, navigationType, user]);

  const submitCatalogForm = (form: HTMLFormElement, force = false) => {
    const cleanedFormData = getCatalogFormData(form);
    const nextParams = new URLSearchParams();
    for (const [key, value] of cleanedFormData.entries()) {
      if (typeof value === "string") {
        nextParams.append(key, value);
      }
    }

    const targetSearch =
      navigation.state !== "idle" &&
      navigation.location?.pathname === recipesPath
        ? navigation.location.search
        : location.search;
    if (
      !force &&
      nextParams.toString() === new URLSearchParams(targetSearch).toString()
    ) {
      return;
    }

    const prevQuery = searchParams.get("q")?.trim() ?? "";
    const nextQuery = nextParams.get("q") ?? "";
    const isStartingNewSearch = !prevQuery && Boolean(nextQuery);

    pendingSubmitsRef.current += 1;
    startTransition(async () => {
      try {
        await submit(cleanedFormData, {
          method: "get",
          action: recipesPath,
          replace: !isStartingNewSearch,
          preventScrollReset: true,
        });
      } finally {
        pendingSubmitsRef.current -= 1;
      }
    });
  };

  const activeQueryText = searchParams.get("q")?.trim() || "";
  const activeLikedOnly = isLikedFilterEnabled(searchParams.get("liked"));
  const activeMinRating = Number(searchParams.get("minRating")) || 0;
  const activeTags = parseTagsParam(searchParams);
  const hasFilters =
    activeLikedOnly ||
    Boolean(activeQueryText) ||
    activeMinRating > 0 ||
    activeTags.length > 0;

  if ((!recipes || recipes.length === 0) && !hasFilters) {
    return <ZeroState />;
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

  const canFilterByLikes = Boolean(user);
  const isSignedOut = !user;
  const countLabel = hasMore ? `${recipes.length}+` : String(recipes.length);

  const isEmptyLikedOnly =
    activeLikedOnly &&
    !activeQueryText &&
    activeMinRating === 0 &&
    activeTags.length === 0;

  return (
    <Form
      ref={formRef}
      method="get"
      action={recipesPath}
      replace
      preventScrollReset
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeoutRef(searchTimerRef);
        submitCatalogForm(e.currentTarget, true);
      }}
      onChange={(e) => {
        clearTimeoutRef(searchTimerRef);
        if (e.target instanceof HTMLInputElement && e.target.name === "q") {
          const form = e.currentTarget;
          searchTimerRef.current = setTimeout(() => {
            searchTimerRef.current = null;
            submitCatalogForm(form);
          }, SEARCH_DEBOUNCE_MS);
          return;
        }
        submitCatalogForm(e.currentTarget);
      }}
      className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-4"
    >
      <div className="md:col-start-2 md:row-start-1">
        <SearchBar />
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

          <SortControl />
        </div>

        {!recipes || recipes.length === 0 ? (
          <ViewTransition
            key="empty-results"
            default="none"
            enter="vt-recipe-card-enter"
            exit="vt-recipe-card-exit"
          >
            <div className="space-y-4 rounded-md border bg-card px-6 py-12 text-center shadow-xs">
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
                <RecipeCard key={recipe.id} recipe={recipe} />
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
                      className="h-10 w-full sm:w-auto rounded-md bg-card px-6 shadow-xs disabled:opacity-100"
                    >
                      <Spinner className="size-4" />
                      <span>Loading recipes...</span>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      className="h-10 w-full sm:w-auto rounded-md bg-card px-6 shadow-xs hover:border-primary/40 hover:bg-accent/50"
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
    </Form>
  );
}
