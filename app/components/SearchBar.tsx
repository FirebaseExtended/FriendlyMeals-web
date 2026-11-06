import { useEffect, useEffectEvent, useRef, useState, type FC } from "react";
import {
  Form,
  href,
  NavigationType,
  useNavigation,
  useNavigationType,
  useSearchParams,
  useSubmit,
} from "react-router";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_SORT,
  isLikedFilterEnabled,
  parseSortParam,
  useOptimisticRecipesSearchParams,
} from "@/lib/recipes-catalog";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export const SearchBar: FC<{ ssr: boolean }> = ({ ssr }) => {
  const [searchParams] = useSearchParams();
  const activeSearchParams = useOptimisticRecipesSearchParams();
  const navigationType = useNavigationType();
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");

  const inputRef = useRef<HTMLInputElement | null>(null);

  const urlQuery = searchParams.get("q") || "";
  const [liveQuery, setLiveQuery] = useState(urlQuery);

  const syncFromUrl = useEffectEvent((nextUrlQuery: string) => {
    if (
      navigationType === NavigationType.Pop ||
      document.activeElement !== inputRef.current
    ) {
      setLiveQuery(nextUrlQuery);
    }
  });

  // Sync controlled input on Back/Forward ("POP") or external resets (e.g. header brand link)
  useEffect(() => {
    syncFromUrl(urlQuery);
  }, [urlQuery]);

  const submitSearch = (nextValue: string, force = false) => {
    const trimmed = nextValue.trim();
    const currentTargetQuery = (activeSearchParams.get("q") || "").trim();
    if (!force && trimmed === currentTargetQuery) {
      return;
    }

    const nextParams = new URLSearchParams(activeSearchParams);
    nextParams.delete("limit");
    if (trimmed) {
      nextParams.set("q", nextValue);
    } else {
      nextParams.delete("q");
    }

    const hadCommittedQuery = Boolean(searchParams.get("q"));
    void submit(nextParams, {
      method: "get",
      action: recipesPath,
      replace: hadCommittedQuery || !trimmed,
      preventScrollReset: true,
    });
  };

  const onDebouncedSearch = useEffectEvent((nextValue: string) => {
    submitSearch(nextValue);
  });

  // Debounce live typing before committing `?q=` to the URL and querying Firestore
  useEffect(() => {
    const timer = setTimeout(() => {
      onDebouncedSearch(liveQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [liveQuery]);

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
      aria-label="Search recipes"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch(liveQuery, true);
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
        value={liveQuery}
        onChange={(e) => setLiveQuery(e.target.value)}
        className={cn(
          "h-11 rounded-md bg-card pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden",
          ssr && "ssr"
        )}
      />
      {liveQuery.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setLiveQuery("");
            submitSearch("", true);
            inputRef.current?.focus();
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
