import type { FC } from "react";
import { href, useLocation, useSubmit } from "react-router";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_SORT,
  getLatestCatalogSearchParams,
  parseSortParam,
  recordInFlightCatalogSearch,
  SORT_OPTIONS,
  useOptimisticRecipesSearchParams,
} from "@/lib/recipes-catalog";
import { cn } from "@/lib/utils";

export const SortControl: FC<{ ssr: boolean }> = ({ ssr }) => {
  const activeSearchParams = useOptimisticRecipesSearchParams();
  const location = useLocation();
  const submit = useSubmit();
  const recipesPath = href("/recipes");

  const activeSort = parseSortParam(activeSearchParams.get("sort"));

  const handleSortChange = (nextSortValue: string) => {
    const nextSort = parseSortParam(nextSortValue);
    const nextParams = getLatestCatalogSearchParams(
      location.key,
      activeSearchParams
    );
    nextParams.delete("limit");
    if (nextSort !== DEFAULT_SORT) {
      nextParams.set("sort", nextSort);
    } else {
      nextParams.delete("sort");
    }
    recordInFlightCatalogSearch(location.key, nextParams);
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
          "h-8 w-auto rounded-md bg-card pl-2.5 pr-7 text-xs font-medium text-foreground md:text-xs",
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
