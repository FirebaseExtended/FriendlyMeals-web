import { useState, type FC } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const CUISINES = [
  { label: "Any cuisine", value: "" },
  { label: "Italian", value: "Italian" },
  { label: "Mexican", value: "Mexican" },
  { label: "Asian", value: "Asian" },
  { label: "American", value: "American" },
] as const;

interface IngredientInputProps {
  handleSubmit: (ingredients: string, cuisineType: string) => Promise<void>;
  isLoading: boolean | string;
  submitDisabled?: boolean;
  hasPreview?: boolean;
  onCancelEdit?: () => void;
  ssr?: boolean;
}

export const IngredientInput: FC<IngredientInputProps> = ({
  handleSubmit,
  isLoading,
  submitDisabled = false,
  hasPreview = false,
  onCancelEdit,
  ssr = false,
}) => {
  const [ingredients, setIngredients] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const busy = Boolean(isLoading);

  const submitForm = () => {
    if (busy || submitDisabled) return;
    handleSubmit(ingredients, cuisineType);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitForm();
      }}
      className={cn(
        "rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        ssr && "ssr"
      )}
    >
      <label htmlFor="ingredients-input" className="sr-only">
        Ingredients on hand
      </label>
      <textarea
        id="ingredients-input"
        disabled={busy}
        placeholder="e.g., ripe bananas, day-old muffins, blueberries, cinnamon..."
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submitForm();
          }
        }}
        rows={3}
        className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-3 py-2.5">
        <div
          role="group"
          aria-label="Cuisine style"
          className="flex flex-wrap items-center gap-1"
        >
          {CUISINES.map((option) => {
            const selected = cuisineType === option.value;
            return (
              <button
                key={option.label}
                type="button"
                disabled={busy}
                aria-pressed={selected}
                onClick={() => setCuisineType(option.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50",
                  selected
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/25 dark:bg-emerald-950/70 dark:text-emerald-300 dark:ring-emerald-500/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {hasPreview && onCancelEdit && !busy && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={busy || submitDisabled}
            className={cn("rounded-xl px-4 gap-1.5", busy && "disabled:opacity-100")}
          >
            {busy ? (
              <Spinner className="size-4" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>
              {busy
                ? typeof isLoading === "string"
                  ? `${isLoading}...`
                  : "Generating..."
                : hasPreview
                  ? "Regenerate"
                  : "Generate Recipe"}
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
};
