import { useState, type FC } from "react";
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
  ingredients: string;
  onIngredientsChange: (value: string) => void;
  cuisineType: string;
  onCuisineTypeChange: (value: string) => void;
  handleSubmit: () => void;
  isLoading: boolean | string;
  submitDisabled?: boolean;
  hasPreview?: boolean;
  onCancelEdit?: () => void;
}

export const IngredientInput: FC<IngredientInputProps> = ({
  ingredients,
  onIngredientsChange,
  cuisineType,
  onCuisineTypeChange,
  handleSubmit,
  isLoading,
  submitDisabled = false,
  hasPreview = false,
  onCancelEdit,
}) => {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const busy = Boolean(isLoading);

  const submitForm = () => {
    if (busy || submitDisabled) return;
    if (!ingredients.trim()) {
      setFieldError(
        "Enter a couple of ingredients first\u2014even pantry staples work."
      );
      return;
    }
    setFieldError(null);
    handleSubmit();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitForm();
      }}
      className={cn(
        "rounded-md border bg-card shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        fieldError &&
          "border-destructive/60 focus-within:border-destructive focus-within:ring-destructive/20"
      )}
    >
      <label htmlFor="ingredients-input" className="sr-only">
        Ingredients on hand
      </label>
      <textarea
        id="ingredients-input"
        disabled={busy}
        aria-invalid={Boolean(fieldError)}
        aria-describedby={fieldError ? "ingredients-error" : undefined}
        placeholder="half a bag of spinach, canned chickpeas, garlic, a lemon, and way too much parmesan..."
        value={ingredients}
        onChange={(e) => {
          onIngredientsChange(e.target.value);
          if (fieldError && e.target.value.trim()) {
            setFieldError(null);
          }
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submitForm();
          }
        }}
        rows={3}
        className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />

      {fieldError && (
        <p
          id="ingredients-error"
          role="alert"
          className="px-4 pb-2 text-xs font-medium text-destructive"
        >
          {fieldError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-3 py-2.5">
        <fieldset className="min-w-0">
          <legend className="sr-only">Cuisine style</legend>
          <div className="flex flex-wrap items-center gap-1">
            {CUISINES.map((option) => {
              const selected = cuisineType === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  disabled={busy}
                  aria-pressed={selected}
                  onClick={() => onCuisineTypeChange(option.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                    selected
                      ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

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
            className={cn(
              "rounded-md px-4 gap-1.5",
              busy && "disabled:opacity-100"
            )}
          >
            {busy && <Spinner className="size-4" />}
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
