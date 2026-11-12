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

export function parseTagsParam(params: URLSearchParams | FormData): string[] {
  return params
    .getAll("tags")
    .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseFiltersFromUrl(
  requestUrl: string,
  likedByUserId?: string
): RecipeFilters {
  const url = new URL(requestUrl);
  const rawMinRating = Number(url.searchParams.get("minRating"));
  const tags = parseTagsParam(url.searchParams);

  return {
    searchTerm: url.searchParams.get("q")?.trim() || undefined,
    minRating:
      !Number.isNaN(rawMinRating) && rawMinRating > 0
        ? rawMinRating
        : undefined,
    tags: tags.length > 0 ? tags : undefined,
    likedByUserId,
    sort: parseSortParam(url.searchParams.get("sort")),
    limit: parseLimitParam(url.searchParams.get("limit")),
  };
}

export function getCatalogFormData(form: HTMLFormElement): FormData {
  const raw = new FormData(form);
  const cleaned = new FormData();

  const q = raw.get("q");
  if (typeof q === "string" && q.trim()) {
    cleaned.set("q", q.trim());
  }

  const rawLiked = raw.get("liked");
  if (typeof rawLiked === "string" && isLikedFilterEnabled(rawLiked)) {
    cleaned.set("liked", "1");
  }

  const minRating = Number(raw.get("minRating"));
  if (!Number.isNaN(minRating) && minRating > 0) {
    cleaned.set("minRating", String(minRating));
  }

  for (const tag of parseTagsParam(raw)) {
    cleaned.append("tags", tag);
  }

  const rawSort = raw.get("sort");
  const sort = parseSortParam(typeof rawSort === "string" ? rawSort : null);
  if (sort !== DEFAULT_SORT) {
    cleaned.set("sort", sort);
  }

  return cleaned;
}
