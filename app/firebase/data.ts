import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import {
  average,
  countAll,
  documentId,
  execute,
  exists,
  field,
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

export interface Recipe {
  id: string;
  title: string;
  instructions: string;
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

export interface RecipeFilters {
  searchTerm?: string;
  minRating?: number;
  tags?: string[];
  sort?: string;
}

// Firestore Enterprise requires a named database ID (here "default", matching firebase.json)
export const db = getFirestore(firebaseApp, "default");

function normalizeRecipe(id: string, data: DocumentData): Recipe {
  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled Recipe",
    instructions: typeof data.instructions === "string" ? data.instructions : "",
    ingredients: Array.isArray(data.ingredients)
      ? data.ingredients.map(String)
      : [],
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    averageRating:
      typeof data.averageRating === "number" && !Number.isNaN(data.averageRating)
        ? data.averageRating
        : 0,
    likes:
      typeof data.likes === "number" && !Number.isNaN(data.likes)
        ? data.likes
        : 0,
    prepTime: typeof data.prepTime === "string" ? data.prepTime : "N/A",
    cookTime: typeof data.cookTime === "string" ? data.cookTime : "N/A",
    servings: typeof data.servings === "string" ? data.servings : "N/A",
    imageUri: typeof data.imageUri === "string" ? data.imageUri : undefined,
  };
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
    .sort(field("tagCount").descending())
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

  return normalizeRecipe(result.id, raw);
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
          toLower(field("instructions").coalesce("")),
          trimmedSearch
        )
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
    case "title":
      pipeline = pipeline.sort(field("title").ascending());
      break;
    case "rating":
      pipeline = pipeline.sort(field("averageRating").descending());
      break;
    case "likes":
      pipeline = pipeline.sort(field("likes").descending());
      break;
  }

  pipeline = pipeline.limit(50);

  const { results } = await execute(pipeline);
  return results.map((result) => normalizeRecipe(result.id, result.data()));
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

  return `# ${recipe.title}

- **Prep Time:** ${recipe.prepTime}
- **Cook Time:** ${recipe.cookTime}
- **Servings:** ${recipe.servings}
- **Rating:** ${ratingLabel}
- **Likes:** ${recipe.likes}${tagsLine}

## Ingredients

${ingredientsList}

## Instructions

${recipe.instructions.trim()}
`;
}
