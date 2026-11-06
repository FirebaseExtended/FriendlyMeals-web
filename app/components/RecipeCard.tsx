import { ViewTransition, type FC } from "react";
import { href, Link } from "react-router";
import { ChevronRight, Star } from "lucide-react";
import type { Recipe } from "@/firebase/data";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { getRecipeTitleTransitionName, isSafeImageUrl } from "@/lib/utils";

export interface RecipeCardProps {
  recipe: Recipe;
}

export const RecipeCard: FC<RecipeCardProps> = ({ recipe }) => {
  const prepTime = recipe.prepTime?.trim();
  const cookTime = recipe.cookTime?.trim();

  return (
    <ViewTransition
      default="none"
      enter="vt-recipe-card-enter"
      exit="vt-recipe-card-exit"
      update="vt-recipe-card-move"
    >
      <li>
        <Item
          asChild
          variant="outline"
          className="rounded-md bg-card px-5 py-3.5 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all"
        >
          <Link
            to={href("/recipes/:recipeId", {
              recipeId: recipe.id,
            })}
            prefetch="intent"
          >
            {isSafeImageUrl(recipe.imageUri) && (
              <ItemMedia className="size-16 rounded-md overflow-hidden border bg-muted shrink-0">
                <img
                  src={recipe.imageUri}
                  alt={recipe.title}
                  className="size-full object-cover"
                />
              </ItemMedia>
            )}
            <ItemContent className="gap-1.5">
              <ViewTransition
                name={getRecipeTitleTransitionName(recipe.id)}
                default="none"
                share="vt-recipe-title"
              >
                <ItemTitle
                  asChild
                  className="mb-1.5 text-base font-semibold text-foreground group-hover/item:text-primary transition-colors"
                >
                  <h2>{recipe.title}</h2>
                </ItemTitle>
              </ViewTransition>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                {recipe.averageRating > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Star
                      aria-hidden="true"
                      className="w-3.5 h-3.5 fill-star-fill text-star-stroke"
                    />
                    {recipe.averageRating.toFixed(1)}
                  </span>
                ) : (
                  <span>New</span>
                )}
                {recipe.likes > 0 && (
                  <span>
                    • {recipe.likes} {recipe.likes === 1 ? "like" : "likes"}
                  </span>
                )}
                {prepTime && <span>• {prepTime} prep</span>}
                {cookTime && <span>• {cookTime} cook</span>}
              </div>
              {recipe.tags?.length > 0 && (
                <ul aria-label="Tags" className="flex flex-wrap gap-1.5 pt-0.5">
                  {recipe.tags.map((tag) => (
                    <li
                      key={tag}
                      className="px-2 py-0.5 text-xs font-medium rounded-md bg-muted text-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </ItemContent>
            <ItemActions className="text-muted-foreground group-hover/item:text-foreground group-hover/item:translate-x-0.5 transition-all">
              <ChevronRight aria-hidden="true" className="w-5 h-5" />
            </ItemActions>
          </Link>
        </Item>
      </li>
    </ViewTransition>
  );
};
