import type { FC } from "react";
import { href, useSubmit } from "react-router";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_SORT,
  parseSortParam,
  SORT_OPTIONS,
  useOptimisticRecipesSearchParams,
} from "@/lib/recipes-catalog";

export const SortControl: FC = () => {
  const activeSearchParams = useOptimisticRecipesSearchParams();
  const submit = useSubmit();
  const recipesPath = href("/recipes");

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
        className="h-8 w-auto rounded-md bg-card pl-2.5 pr-7 text-xs font-medium text-foreground md:text-xs"
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
