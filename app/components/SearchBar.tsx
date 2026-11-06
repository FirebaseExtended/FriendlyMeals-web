import { useEffect, useEffectEvent, useRef, useState, type FC } from "react";
import {
  Form,
  href,
  NavigationType,
  useLocation,
  useNavigation,
  useNavigationType,
  useSearchParams,
  useSubmit,
} from "react-router";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useOptimisticRecipesSearchParams } from "@/lib/recipes-catalog";

const SEARCH_DEBOUNCE_MS = 300;

export const SearchBar: FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeSearchParams = useOptimisticRecipesSearchParams();
  const navigationType = useNavigationType();
  const submit = useSubmit();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetLocation =
    navigation.location?.pathname === recipesPath
      ? navigation.location
      : location;
  const urlQuery = searchParams.get("q") || "";
  const targetUrlQuery = activeSearchParams.get("q") || "";
  const prevUrlQueryRef = useRef(targetUrlQuery);
  const prevTargetKeyRef = useRef(targetLocation.key);
  const prevCommittedKeyRef = useRef(location.key);
  const [liveQuery, setLiveQuery] = useState(urlQuery);

  const clearPendingDebounce = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const syncFromUrl = useEffectEvent(
    (
      nextUrlQuery: string,
      nextTargetKey: string,
      committedLocationKey: string
    ) => {
      const urlQueryChanged = prevUrlQueryRef.current !== nextUrlQuery;
      const targetKeyChanged = prevTargetKeyRef.current !== nextTargetKey;
      const committedKeyChanged =
        prevCommittedKeyRef.current !== committedLocationKey;
      prevUrlQueryRef.current = nextUrlQuery;
      prevTargetKeyRef.current = nextTargetKey;
      prevCommittedKeyRef.current = committedLocationKey;

      if (!urlQueryChanged && !targetKeyChanged && !committedKeyChanged) {
        return;
      }

      // Don't wipe an in-progress search draft when the user clicks a filter or sort control mid-debounce.
      if (
        !urlQueryChanged &&
        navigationType !== NavigationType.Pop &&
        document.activeElement?.closest("#recipe-filters, #recipe-sort")
      ) {
        return;
      }

      if (
        navigationType === NavigationType.Pop ||
        document.activeElement !== inputRef.current
      ) {
        clearPendingDebounce();
        setLiveQuery(nextUrlQuery);
      }
    }
  );

  // Sync controlled input on Back/Forward ("POP") or external resets (e.g. header brand link)
  useEffect(() => {
    syncFromUrl(targetUrlQuery, targetLocation.key, location.key);
  }, [targetUrlQuery, targetLocation.key, location.key]);

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
    if (liveQuery.trim() === targetUrlQuery.trim()) {
      return;
    }
    const timer = setTimeout(() => {
      timerRef.current = null;
      onDebouncedSearch(liveQuery);
    }, SEARCH_DEBOUNCE_MS);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (timerRef.current === timer) {
        timerRef.current = null;
      }
    };
  }, [liveQuery, targetUrlQuery]);

  const isSearching =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath &&
    (new URLSearchParams(navigation.location.search).get("q") || "") !==
      urlQuery;

  return (
    <Form
      method="get"
      action={recipesPath}
      role="search"
      aria-label="Search recipes"
      onSubmit={(e) => {
        e.preventDefault();
        clearPendingDebounce();
        submitSearch(liveQuery, true);
      }}
      className="relative"
    >
      {[...activeSearchParams.entries()]
        .filter(([key]) => key !== "q" && key !== "limit")
        .map(([key, value]) => (
          <input
            key={`${key}:${value}`}
            type="hidden"
            name={key}
            value={value}
          />
        ))}

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
        className="h-11 rounded-md bg-card pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {liveQuery.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clearPendingDebounce();
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
