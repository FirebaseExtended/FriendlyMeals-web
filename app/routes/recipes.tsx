import { useRef, useState, type FC } from "react";
import {
  data,
  Form,
  href,
  Link,
  useNavigation,
  useSearchParams,
} from "react-router";
import { BookOpen, ChevronDown, ChevronUp, Search, Star, X } from "lucide-react";
import type { Route } from "./+types/recipes";
import {
  getTop5Tags,
  queryRecipes,
  type Recipe,
  type RecipeFilters,
} from "@/firebase/data";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";

const PUBLIC_RECIPES_CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  if (errorHeaders) {
    return {};
  }
  const cacheControl = loaderHeaders.get("Cache-Control");
  return cacheControl ? { "Cache-Control": cacheControl } : {};
}

export function meta() {
  return [
    { title: "All Recipes - Friendly Meals" },
    { name: "description", content: "Browse community recipes" },
  ];
}

function isSafeImageUrl(url: string | undefined): url is string {
  return Boolean(
    url && (url.startsWith("https://") || url.startsWith("http://"))
  );
}

function parseFiltersFromUrl(requestUrl: string): RecipeFilters {
  const url = new URL(requestUrl);
  const rawMinRating = Number(url.searchParams.get("minRating"));
  const rawTags = url.searchParams.get("tags");
  const rawSort = url.searchParams.get("sort");

  return {
    searchTerm: url.searchParams.get("q")?.trim() || undefined,
    minRating:
      !Number.isNaN(rawMinRating) && rawMinRating > 0
        ? rawMinRating
        : undefined,
    tags: rawTags ? rawTags.split(",").filter(Boolean) : undefined,
    sort: rawSort && rawSort !== "none" ? rawSort : undefined,
  };
}

async function loadRecipesCatalog(request: Request) {
  const filters = parseFiltersFromUrl(request.url);
  const [recipes, topTags] = await Promise.all([
    queryRecipes(filters),
    getTop5Tags(),
  ]);
  return { recipes, topTags };
}

// Initial HTML request renders on Cloud Run so search engines and agents get full HTML
export async function loader({ request }: Route.LoaderArgs) {
  const payload = await loadRecipesCatalog(request);
  return data(
    { ...payload, ssr: true },
    {
      headers: { "Cache-Control": PUBLIC_RECIPES_CACHE_CONTROL },
    }
  );
}

// Subsequent navigations and filter submissions run directly in the browser against Firestore
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const payload = await loadRecipesCatalog(request);
  return { ...payload, ssr: false };
}

const ZeroState: FC<{ ssr: boolean }> = ({ ssr }) => {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
      <Empty className={cn(ssr && "ssr")}>
        <EmptyMedia variant="icon">
          <BookOpen className="h-6 w-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No recipes yet</EmptyTitle>
          <EmptyDescription>
            Generate a recipe with Gemini to start building the community cookbook.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to={href("/generate")}>Generate Recipe</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
};

const FilterPanel: FC<{
  isOpen: boolean;
  onToggle: () => void;
  availableTags: string[];
  ssr: boolean;
}> = ({ isOpen, onToggle, availableTags, ssr }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const recipesPath = href("/recipes");
  const isFiltering =
    navigation.state !== "idle" &&
    navigation.location?.pathname === recipesPath;

  const queryText = searchParams.get("q") || "";
  const sortBy =
    (searchParams.get("sort") as "rating" | "title" | "likes" | "none") ||
    "none";
  const initialSelectedTags =
    searchParams.get("tags")?.split(",").filter(Boolean) || [];
  const initialMinRating = Number(searchParams.get("minRating")) || 0;

  const [minRating, setMinRating] = useState(initialMinRating);
  const [selectedTags, setSelectedTags] =
    useState<string[]>(initialSelectedTags);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleLocalReset = () => {
    formRef.current?.reset();
    setMinRating(0);
    setSelectedTags([]);
  };

  const hasFilters = Array.from(searchParams.entries()).some(
    ([key, value]) => Boolean(value) && !(key === "sort" && value === "none")
  );

  return (
    <div
      className={cn(
        "bg-card border rounded-xl mb-6 overflow-hidden",
        ssr && "ssr"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Filter Recipes</span>
          {hasFilters && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <Form
          method="get"
          action={recipesPath}
          className="p-4 border-t"
          ref={formRef}
        >
          {minRating > 0 && (
            <input type="hidden" name="minRating" value={String(minRating)} />
          )}
          {selectedTags.length > 0 && (
            <input
              type="hidden"
              name="tags"
              value={selectedTags.join(",")}
            />
          )}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="recipe-search">Search Recipes</FieldLabel>
              <Input
                id="recipe-search"
                placeholder="e.g. Pasta, Salad, Garlic..."
                defaultValue={queryText}
                name="q"
              />
            </Field>

            <Field>
              <FieldLabel>Minimum Rating</FieldLabel>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Minimum ${star} star${star === 1 ? "" : "s"}`}
                    onClick={() =>
                      setMinRating(star === minRating ? 0 : star)
                    }
                    className="p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star
                      className={`w-7 h-7 cursor-pointer transition-all ${
                        star <= minRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30 hover:text-amber-400"
                      }`}
                    />
                  </button>
                ))}
                {minRating > 0 && (
                  <button
                    type="button"
                    onClick={() => setMinRating(0)}
                    className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Clear minimum rating"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Field>

            {availableTags.length > 0 && (
              <Field>
                <FieldLabel>Popular Tags</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                        selectedTags.includes(tag)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field>
              <FieldLabel>Sort By</FieldLabel>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="none"
                    defaultChecked={!sortBy || sortBy === "none"}
                    className="accent-primary"
                  />
                  <span className="text-sm">No sort</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="rating"
                    defaultChecked={sortBy === "rating"}
                    className="accent-primary"
                  />
                  <span className="text-sm">Rating</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="title"
                    defaultChecked={sortBy === "title"}
                    className="accent-primary"
                  />
                  <span className="text-sm">Alphabetical</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    value="likes"
                    defaultChecked={sortBy === "likes"}
                    className="accent-primary"
                  />
                  <span className="text-sm">Likes</span>
                </label>
              </div>
            </Field>

            <div className="flex gap-3 pt-2">
              {hasFilters ? (
                <Button asChild variant="outline" className="flex-1">
                  <Link to={recipesPath}>Reset</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLocalReset}
                  className="flex-1"
                >
                  Reset
                </Button>
              )}
              <Button type="submit" disabled={isFiltering} className="flex-1">
                {isFiltering ? "Filtering..." : "Apply Filters"}
              </Button>
            </div>
          </FieldGroup>
        </Form>
      )}
    </div>
  );
};

export default function RecipesPage({ loaderData }: Route.ComponentProps) {
  const { recipes, topTags, ssr } = loaderData;
  const [searchParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const filterKey = searchParams.toString();

  if (!recipes || recipes.length === 0) {
    const hasFilters = Array.from(searchParams.entries()).some(
      ([key, value]) => Boolean(value) && !(key === "sort" && value === "none")
    );
    if (hasFilters) {
      return (
        <div className="p-4">
          <FilterPanel
            key={filterKey}
            isOpen={filterOpen}
            onToggle={() => setFilterOpen(!filterOpen)}
            availableTags={topTags}
            ssr={ssr}
          />
          <div className={cn("text-center py-12 rounded-xl", ssr && "ssr")}>
            <p className="text-muted-foreground">
              No recipes match your filters.
            </p>
            <Button asChild variant="link" className="mt-2">
              <Link to={href("/recipes")}>Clear all filters</Link>
            </Button>
          </div>
        </div>
      );
    }
    return <ZeroState ssr={ssr} />;
  }

  return (
    <div>
      <FilterPanel
        key={filterKey}
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        availableTags={topTags}
        ssr={ssr}
      />
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
      </h3>
      <ItemGroup className="gap-4">
        {recipes.map((recipe: Recipe) => (
          <Item
            key={recipe.id}
            variant="outline"
            className={cn(ssr && "ssr")}
          >
            {isSafeImageUrl(recipe.imageUri) && (
              <ItemMedia className="p-0 overflow-hidden rounded-md border bg-muted/5 flex items-center justify-center shrink-0">
                <img
                  src={recipe.imageUri}
                  alt={recipe.title}
                  className="max-h-20 max-w-20 object-contain"
                />
              </ItemMedia>
            )}
            <ItemContent>
              <ItemTitle>{recipe.title}</ItemTitle>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="flex"
                  aria-label={`Rating: ${recipe.averageRating || 0} out of 5`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= (recipe.averageRating || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>•</span>
                  <span>{recipe.likes || 0} likes</span>
                </div>
              </div>
              <ItemDescription>
                {recipe.tags?.join(", ") || "No tags"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm" asChild>
                <Link to={href("/recipes/:recipeId", { recipeId: recipe.id })}>
                  Open
                </Link>
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
