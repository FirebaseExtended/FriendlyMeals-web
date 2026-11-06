import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  and,
  average,
  concat,
  countAll,
  documentId,
  execute,
  exists,
  field,
  join,
  or,
  stringContains,
  subcollection,
  toLower,
  variable,
} from "firebase/firestore/pipelines";
import { firebaseApp } from "./firebase";

export interface InstructionStep {
  title: string;
  content: string;
}

export interface Recipe {
  id: string;
  title: string;
  instructions: InstructionStep[];
  ingredients: string[];
  authorId: string;
  tags: string[];
  averageRating: number;
  likes: number;
  prepTime: string;
  cookTime: string;
  servings: string;
  imageUri?: string;
}

export type NewRecipeInput = Omit<
  Recipe,
  "id" | "authorId" | "averageRating" | "likes"
>;

export type RecipeSort = "newest" | "title" | "rating" | "likes";

export const DEFAULT_RECIPES_LIMIT = 20;
export const RECIPES_LIMIT_STEP = 20;
export const MAX_RECIPES_LIMIT = 100;

export interface RecipeFilters {
  searchTerm?: string;
  minRating?: number;
  tags?: string[];
  likedByUserId?: string;
  sort?: RecipeSort;
  limit?: number;
}

export interface RecipesQueryResult {
  recipes: Recipe[];
  hasMore: boolean;
}

// Firestore Enterprise requires a named database ID (here "friendlymeals", matching firebase.json)
export const db = getFirestore(firebaseApp, "friendlymeals");

export async function getTop5Tags(): Promise<string[]> {
  const pipeline = db
    .pipeline()
    .collection("recipes")
    .unnest(field("tags").as("tagName"))
    .aggregate({
      accumulators: [countAll().as("tagCount")],
      groups: ["tagName"],
    })
    .sort(field("tagCount").descending(), field("tagName").ascending())
    .limit(5);

  const { results } = await execute(pipeline);
  return results
    .map((result) => result.data().tagName)
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
}

function toPlainRecipe(id: string, raw: Record<string, unknown>): Recipe {
  const { createdAt: _createdAt, ...rest } = raw;
  void _createdAt;
  return {
    ...(rest as Omit<Recipe, "id">),
    id,
  };
}

export async function publishRecipe(
  userId: string,
  recipe: NewRecipeInput
): Promise<string> {
  const recipeRef = await addDoc(collection(db, "recipes"), {
    ...recipe,
    tags: recipe.tags ?? [],
    authorId: userId,
    createdAt: serverTimestamp(),
  });
  return recipeRef.id;
}

export async function getRecipe(recipeId: string): Promise<Recipe | null> {
  const pipeline = db
    .pipeline()
    .documents([`recipes/${recipeId}`])
    .where(exists("title"))
    .define(documentId(field("__name__")).as("parentRecipeId"))
    .addFields(
      subcollection("reviews")
        .aggregate(average("rating").as("avg"))
        .toScalarExpression()
        .coalesce(0)
        .as("averageRating"),
      db
        .pipeline()
        .collection("likes")
        .where(field("recipeId").equal(variable("parentRecipeId")))
        .aggregate(countAll().as("count"))
        .toScalarExpression()
        .coalesce(0)
        .as("likes")
    );

  const { results } = await execute(pipeline);
  const result = results[0];
  const raw = result?.data();
  if (!result?.id || !raw) {
    return null;
  }

  return toPlainRecipe(result.id, raw);
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await deleteDoc(doc(db, "recipes", recipeId));
}

export async function addReview(
  recipeId: string,
  userId: string,
  rating: number,
  text?: string
): Promise<void> {
  // Deterministic doc ID (`userId`) ensures one updatable review per user per recipe
  await setDoc(doc(db, "recipes", recipeId, "reviews", userId), {
    recipeId,
    userId,
    rating,
    text: text || "",
  });
}

export async function likeRecipe(
  userId: string,
  recipeId: string
): Promise<void> {
  const likeId = `${recipeId}_${userId}`;
  await setDoc(doc(db, "likes", likeId), {
    userId,
    recipeId,
  });
}

export async function unlikeRecipe(
  userId: string,
  recipeId: string
): Promise<void> {
  const likeId = `${recipeId}_${userId}`;
  await deleteDoc(doc(db, "likes", likeId));
}

export async function isRecipeLikedByUser(
  userId: string,
  recipeId: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, "likes", `${recipeId}_${userId}`));
  return snap.exists();
}

/**
 * Workshop pipeline query: loads public recipes with dynamically aggregated
 * review averages and like counts, then applies URL-driven filters and sorting.
 * Fetches `limit + 1` rows to detect `hasMore` without a second count pipeline.
 * Works identically in Node SSR loaders and browser clientLoaders.
 */
export async function queryRecipes(
  filters: RecipeFilters
): Promise<RecipesQueryResult> {
  const effectiveLimit = Math.min(
    MAX_RECIPES_LIMIT,
    Math.max(1, Math.floor(filters.limit ?? DEFAULT_RECIPES_LIMIT))
  );

  let pipeline = db
    .pipeline()
    .collection("recipes")
    .define(documentId(field("__name__")).as("parentRecipeId"));

  if (filters.likedByUserId) {
    // Match deterministic `{recipeId}_{userId}` user-like doc IDs so synthetic
    // `{recipeId}_seed_like_NN` engagement rows written by the seeder are excluded.
    pipeline = pipeline.where(
      db
        .pipeline()
        .collection("likes")
        .where(
          and(
            field("recipeId").equal(variable("parentRecipeId")),
            field("userId").equal(filters.likedByUserId),
            documentId(field("__name__")).equal(
              concat(variable("parentRecipeId"), "_", filters.likedByUserId)
            )
          )
        )
        .limit(1)
        .aggregate(countAll().as("liked"))
        .toScalarExpression()
        .coalesce(0)
        .greaterThan(0)
    );
  }

  pipeline = pipeline.addFields(
    subcollection("reviews")
      .aggregate(average("rating").as("avg"))
      .toScalarExpression()
      .coalesce(0)
      .as("averageRating"),
    db
      .pipeline()
      .collection("likes")
      .where(field("recipeId").equal(variable("parentRecipeId")))
      .aggregate(countAll().as("count"))
      .toScalarExpression()
      .coalesce(0)
      .as("likes")
  );

  const trimmedSearch = filters.searchTerm?.trim().toLowerCase();
  if (trimmedSearch) {
    pipeline = pipeline.where(
      or(
        stringContains(toLower(field("title").coalesce("")), trimmedSearch),
        stringContains(
          toLower(join("ingredients", " ").ifError("")),
          trimmedSearch
        ),
        stringContains(toLower(join("tags", " ").ifError("")), trimmedSearch)
      )
    );
  }

  if (filters.minRating && filters.minRating > 0) {
    pipeline = pipeline.where(
      field("averageRating").greaterThanOrEqual(filters.minRating)
    );
  }

  if (filters.tags && filters.tags.length > 0) {
    pipeline = pipeline.where(field("tags").arrayContainsAll(filters.tags));
  }

  switch (filters.sort) {
    case "title":
      pipeline = pipeline.sort(
        field("title").ascending(),
        field("__name__").ascending()
      );
      break;
    case "rating":
      pipeline = pipeline.sort(
        field("averageRating").descending(),
        field("title").ascending(),
        field("__name__").ascending()
      );
      break;
    case "likes":
      pipeline = pipeline.sort(
        field("likes").descending(),
        field("title").ascending(),
        field("__name__").ascending()
      );
      break;
    case "newest":
    default:
      pipeline = pipeline.sort(
        field("createdAt").coalesce(field("__create_time__")).descending(),
        field("title").ascending(),
        field("__name__").ascending()
      );
      break;
  }

  pipeline = pipeline.limit(effectiveLimit + 1);

  const { results } = await execute(pipeline);
  const rows = results.flatMap((result) =>
    result.id ? [toPlainRecipe(result.id, result.data())] : []
  );
  const hasMore = rows.length > effectiveLimit;
  return {
    recipes: hasMore ? rows.slice(0, effectiveLimit) : rows,
    hasMore,
  };
}

export function formatRecipeMarkdown(recipe: Recipe): string {
  const ratingLabel =
    recipe.averageRating > 0
      ? `${recipe.averageRating.toFixed(1)} / 5`
      : "No ratings yet";
  const tagsLine =
    recipe.tags.length > 0 ? `\n- **Tags:** ${recipe.tags.join(", ")}` : "";
  const ingredientsList =
    recipe.ingredients.length > 0
      ? recipe.ingredients.map((item) => `- ${item}`).join("\n")
      : "- None listed";
  const rawServings = (recipe.servings ?? "").trim();
  const servingsLabel = /^\d+$/.test(rawServings)
    ? `${rawServings} servings`
    : rawServings;

  const steps = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const instructionsBody =
    steps.length > 0
      ? steps
          .map(
            (step, idx) =>
              `### ${idx + 1}. ${step.title}\n\n${step.content.trim()}`
          )
          .join("\n\n")
      : "No instructions listed.";

  return `# ${recipe.title}

- **Prep Time:** ${recipe.prepTime}
- **Cook Time:** ${recipe.cookTime}
- **Servings:** ${servingsLabel}
- **Rating:** ${ratingLabel}
- **Likes:** ${recipe.likes}${tagsLine}

## Ingredients

${ingredientsList}

## Instructions

${instructionsBody}
`;
}
