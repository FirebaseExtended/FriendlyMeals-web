import { initializeFirestore, addDoc, collection, doc, deleteDoc, setDoc } from "firebase/firestore";
import { execute, field, countAll, subcollection, average, variable, score, documentMatches, documentId } from "firebase/firestore/pipelines";
import { firebaseApp } from "./firebase";

export interface Review {
    recipeId: string;
    userId: string;
    rating: number;
    // Keeping text/id as they are useful, but strictly following spec for fields to mention
    text?: string;
    id?: string;
}

export interface Like {
    recipeId: string;
    userId: string;
    id?: string;
}

export interface User {
    authId: string;
    id?: string;
}

export interface Save {
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

export const db = initializeFirestore(firebaseApp, {}, 'default');

// Get top 5 most popular tags across all recipes
export async function getTop5Tags(): Promise<string[]> {
    // TODO: Implement suggest tags pipeline query
    return [];
}

export async function publishRecipe(userId: string, recipe: Omit<Recipe, "id">): Promise<string> {
    // TODO: Implement writing data to Firestore
    return "";
}

export async function getRecipe(recipeId: string): Promise<Recipe | null> {
    // TODO: Implement reading a single recipe with dynamic rating and likes aggregation
    return null;
}

export async function deleteRecipe(recipeId: string) {
    await deleteDoc(doc(db, `recipes/${recipeId}`));
}

export async function addReview(recipeId: string, userId: string, rating: number, text?: string) {
    // add the new review
    await addDoc(collection(db, `recipes/${recipeId}/reviews`), {
        recipeId,
        userId,
        rating,
        text: text || ""
    });
}

export async function likeRecipe(userId: string, recipeId: string) {
    const likeId = `${recipeId}_${userId}`;
    await setDoc(doc(db, "likes", likeId), {
        userId,
        recipeId
    });
}

export async function unlikeRecipe(userId: string, recipeId: string) {
    const likeId = `${recipeId}_${userId}`;
    await deleteDoc(doc(db, "likes", likeId));
}

export async function isRecipeLikedByUser(userId: string, recipeId: string): Promise<boolean> {
    const pipeline = db.pipeline()
        .collection("likes")
        .where(field("userId").equal(userId))
        .where(field("recipeId").equal(recipeId))
        .limit(1);

    const { results } = await execute(pipeline);
    return results.length > 0;
}

export async function queryRecipes(filters: {
    searchTerm?: string;
    minRating?: number;
    tags?: string[];
    authorId?: string;
    likedOnly?: boolean;
    sort?: string;
    userId?: string;
}): Promise<Recipe[]> {
    let pipeline = db.pipeline().collection("recipes");

    // TODO: Implement this function in the next codelab steps.

    const { results } = await execute(pipeline);
    return results.map(result => ({ ...result.data(), id: result.id }) as Recipe);
}