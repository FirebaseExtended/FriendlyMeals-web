import { href, useNavigation, useSearchParams } from "react-router";
import {
  DEFAULT_RECIPES_LIMIT,
  MAX_RECIPES_LIMIT,
  type RecipeFilters,
  type RecipeSort,
} from "@/firebase/data";

export const DEFAULT_SORT: RecipeSort = "newest";

export const SORT_OPTIONS: ReadonlyArray<{ value: RecipeSort; label: string }> =
  [
    { value: "newest", label: "Newest" },
    { value: "title", label: "Alphabetical" },
    { value: "rating", label: "Rating" },
    { value: "likes", label: "Likes" },
  ];

export function parseSortParam(raw: string | null): RecipeSort {
  return raw === "title" || raw === "rating" || raw === "likes"
    ? raw
    : DEFAULT_SORT;
}

export function parseLimitParam(raw: string | null): number {
  if (!raw) {
    return DEFAULT_RECIPES_LIMIT;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_RECIPES_LIMIT;
  }
  return Math.min(MAX_RECIPES_LIMIT, Math.floor(parsed));
}

export function isLikedFilterEnabled(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

export function parseFiltersFromUrl(
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

export function useOptimisticRecipesSearchParams(): URLSearchParams {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  return navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath
    ? new URLSearchParams(navigation.location.search)
    : searchParams;
}

let debounceSearchQuery: string | null = null;
let inFlightCatalogSearch: { locationKey: string; search: string } | null =
  null;

export function getLatestCatalogSearchParams(
  locationKey: string,
  fallback: URLSearchParams
): URLSearchParams {
  if (inFlightCatalogSearch?.locationKey === locationKey) {
    return new URLSearchParams(inFlightCatalogSearch.search);
  }
  return new URLSearchParams(fallback);
}

export function recordInFlightCatalogSearch(
  locationKey: string,
  params: URLSearchParams,
  options?: { debounce?: boolean }
) {
  const search = params.toString();
  inFlightCatalogSearch = { locationKey, search };
  debounceSearchQuery = options?.debounce ? search : null;
}

export function consumeCatalogSearchDebounce(requestSearch: string): boolean {
  const shouldDebounce =
    debounceSearchQuery !== null && debounceSearchQuery === requestSearch;
  debounceSearchQuery = null;
  return shouldDebounce;
}

export function clearResolvedInFlightSearch(
  requestSearch: string,
  aborted: boolean
) {
  if (!aborted && inFlightCatalogSearch?.search === requestSearch) {
    inFlightCatalogSearch = null;
  }
}
