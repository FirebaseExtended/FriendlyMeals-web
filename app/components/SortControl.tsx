import type { FC } from "react";
import { useSearchParams } from "react-router";
import { Select } from "@/components/ui/select";
import { parseSortParam, SORT_OPTIONS } from "@/lib/recipes-catalog";

export const SortControl: FC = () => {
  const [searchParams] = useSearchParams();
  const defaultSort = parseSortParam(searchParams.get("sort"));

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
        defaultValue={defaultSort}
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
