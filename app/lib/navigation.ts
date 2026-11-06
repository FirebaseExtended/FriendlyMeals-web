import { href, useLocation } from "react-router";
import { useIsServerOrHydrating } from "@/lib/ssr";

export interface RecipesReturnState {
  recipesSearch?: string;
}

export function sanitizeRecipesSearch(raw: unknown): string {
  if (typeof raw !== "string" || !raw) {
    return "";
  }
  const query = raw.startsWith("?") ? raw.slice(1) : raw;
  const canonical = new URLSearchParams(query).toString();
  return canonical ? `?${canonical}` : "";
}

export function buildRecipesReturnState(
  search: string
): RecipesReturnState | undefined {
  const recipesSearch = sanitizeRecipesSearch(search);
  return recipesSearch ? { recipesSearch } : undefined;
}

export function getRecipesHrefWithSearch(rawSearch: unknown): string {
  const basePath = href("/recipes");
  const search = sanitizeRecipesSearch(rawSearch);
  return search ? `${basePath}${search}` : basePath;
}

/**
 * Resolves the `"Back to recipes"` href from `<Link state={{ recipesSearch }}>`,
 * returning plain `/recipes` during SSR/hydration (`Cmd+R`) and on direct entry
 * so server HTML and client hydration always match while keeping detail URLs
 * clean and CDN-cacheable.
 */
export function useBackToRecipesHref(): {
  backHref: string;
  recipesSearch: string;
} {
  const location = useLocation();
  const isServerOrHydrating = useIsServerOrHydrating();
  const state = location.state as RecipesReturnState | null;
  const recipesSearch = isServerOrHydrating
    ? ""
    : sanitizeRecipesSearch(state?.recipesSearch);
  const basePath = href("/recipes");
  return {
    backHref: recipesSearch ? `${basePath}${recipesSearch}` : basePath,
    recipesSearch,
  };
}
