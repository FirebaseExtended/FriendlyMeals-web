import { ViewTransition, type FC } from "react";
import { ArrowUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export const NewRecipesBanner: FC<{
  count: number;
  isRefreshing: boolean;
  onShow: () => void;
}> = ({ count, isRefreshing, onShow }) => {
  if (count <= 0) {
    return null;
  }
  return (
    <ViewTransition
      key="new-recipes-banner"
      default="none"
      enter="vt-recipe-card-enter"
      exit="vt-recipe-card-exit"
    >
      <div className="mb-3 flex justify-center">
        <button
          type="button"
          disabled={isRefreshing}
          onClick={onShow}
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-1.5 font-serif text-xs font-medium text-primary shadow-xs transition-all hover:border-primary/50 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
        >
          {isRefreshing ? (
            <Spinner className="size-3.5" />
          ) : (
            <ArrowUp aria-hidden="true" className="size-3.5" />
          )}
          <span>
            {isRefreshing
              ? "Loading new recipes..."
              : `${count} new ${count === 1 ? "recipe" : "recipes"} — Show`}
          </span>
        </button>
      </div>
    </ViewTransition>
  );
};
