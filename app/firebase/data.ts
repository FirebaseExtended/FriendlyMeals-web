import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import {
  average,
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

export interface Review {
  recipeId: string;
  userId: string;
  rating: number;
  text?: string;
  id?: string;
}

export interface Like {
  recipeId: string;
  userId: string;
  id?: string;
}

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

export type RecipeSort = "title" | "rating" | "likes";

export interface RecipeFilters {
  searchTerm?: string;
  minRating?: number;
  tags?: string[];
  sort?: RecipeSort;
}

// Firestore Enterprise requires a named database ID (here "friendlymeals", matching firebase.json)
export const db = getFirestore(firebaseApp, "friendlymeals");

export async function getRecipeCount(maxCount = 50): Promise<number> {
  const pipeline = db
    .pipeline()
    .collection("recipes")
    .limit(maxCount)
    .aggregate(countAll().as("count"));

  const { results } = await execute(pipeline);
  const count = results[0]?.data()?.count;
  return typeof count === "number" ? count : 0;
}

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

export async function publishRecipe(
  userId: string,
  recipe: NewRecipeInput
): Promise<string> {
  const recipeRef = await addDoc(collection(db, "recipes"), {
    ...recipe,
    tags: recipe.tags ?? [],
    authorId: userId,
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

  return {
    ...raw,
    id: result.id,
  } as Recipe;
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
 * Works identically in Node SSR loaders and browser clientLoaders.
 */
export async function queryRecipes(filters: RecipeFilters): Promise<Recipe[]> {
  let pipeline = db
    .pipeline()
    .collection("recipes")
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
    pipeline = pipeline.where(field("tags").arrayContainsAny(filters.tags));
  }

  switch (filters.sort) {
    case "rating":
      pipeline = pipeline.sort(
        field("averageRating").descending(),
        field("title").ascending()
      );
      break;
    case "likes":
      pipeline = pipeline.sort(
        field("likes").descending(),
        field("title").ascending()
      );
      break;
    case "title":
    default:
      pipeline = pipeline.sort(field("title").ascending());
      break;
  }

  pipeline = pipeline.limit(50);

  const { results } = await execute(pipeline);
  return results.map((result) => ({ ...result.data(), id: result.id }) as Recipe);
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
  const rawServings = String(recipe.servings ?? "").trim();
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
