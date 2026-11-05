import { useState, type FC } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

interface IngredientInputProps {
  handleSubmit: (ingredients: string, cuisineType: string) => Promise<void>;
  isLoading: boolean | string;
  submitDisabled?: boolean;
}

export const IngredientInput: FC<IngredientInputProps> = ({
  handleSubmit,
  isLoading,
  submitDisabled = false,
}) => {
  const [ingredients, setIngredients] = useState("");
  const [cuisineType, setCuisineType] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isLoading || submitDisabled) return;
        handleSubmit(ingredients, cuisineType);
      }}
      className="space-y-4"
    >
      <Field>
        <FieldLabel htmlFor="ingredients-input">Ingredients on hand</FieldLabel>
        <Textarea
          id="ingredients-input"
          disabled={!!isLoading}
          placeholder="e.g., ripe bananas, day-old muffins, blueberries, cinnamon..."
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={3}
          className="resize-y bg-background"
        />
      </Field>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <Field className="sm:w-56">
          <FieldLabel htmlFor="cuisine-select">Cuisine style</FieldLabel>
          <Select
            id="cuisine-select"
            disabled={!!isLoading}
            value={cuisineType}
            onChange={(e) => setCuisineType(e.target.value)}
            className="bg-background"
          >
            <option value="">Any cuisine</option>
            <option value="Italian">Italian</option>
            <option value="Mexican">Mexican</option>
            <option value="Asian">Asian</option>
            <option value="American">American</option>
          </Select>
        </Field>

        <Button
          className="sm:w-auto px-6"
          disabled={!!isLoading || submitDisabled}
          type="submit"
        >
          {isLoading && <Spinner className="mr-2 h-4 w-4" />}
          {isLoading
            ? typeof isLoading === "string"
              ? `${isLoading}...`
              : "Generating..."
            : "Generate Recipe"}
        </Button>
      </div>
    </form>
  );
};
