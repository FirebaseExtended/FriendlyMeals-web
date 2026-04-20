import { initializeFirestore, addDoc, collection, getDoc, doc, deleteDoc, updateDoc, persistentLocalCache, setDoc, getDocs, query, where, runTransaction, increment } from "firebase/firestore";
import { execute, field, countAll, subcollection, average, variable, score, documentMatches } from "firebase/firestore/pipelines";
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
    const pipeline = db.pipeline()
        .collection("recipes")
        .unnest(field("tags").as("tagName"))
        .aggregate({
            accumulators: [countAll().as("tagCount")],
            groups: ["tagName"]
        })
        .sort(field("tagCount").descending())
        .limit(5);

    const { results } = await execute(pipeline);
    return results.map(result => result.data().tagName as string);
}

export async function publishRecipe(userId: string, recipe: Omit<Recipe, "id">): Promise<string> {
    const recipeRef = await addDoc(collection(db, "recipes"), {
        ...recipe,
        authorId: userId
    });
    return recipeRef.id;
}

export async function getRecipe(recipeId: string): Promise<Recipe | null> {
    const pipeline = db.pipeline()
        .documents([`recipes/${recipeId}`])
        .define(field("__name__").as("parentRecipeId"))
        .addFields(
            subcollection("reviews")
                .aggregate(average("rating").as("avg"))
                .toScalarExpression()
                .as("averageRating"),
            db.pipeline()
                .collection("likes")
                .where(field("recipeId").equal(variable("parentRecipeId")))
                .aggregate(countAll().as("count"))
                .toScalarExpression()
                .as("likes")
        );

    const { results } = await execute(pipeline);
    const result = results[0];

    if (!result) {
        return null;
    }

    return {
        ...result.data(),
        id: result.id,
    } as Recipe;
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
}): Promise<Recipe[]> {
    let pipeline = db.pipeline().collection("recipes");

    if (filters.searchTerm) {
        pipeline = pipeline.search({
            query: documentMatches(filters.searchTerm),
            addFields: [
                score().as("searchScore")
            ]
        });
    }

    pipeline = pipeline.define(field("__name__").as("parentRecipeId"))
        .addFields(
            subcollection("reviews")
                .aggregate(average("rating").as("avg"))
                .toScalarExpression()
                .as("averageRating"),
            db.pipeline()
                .collection("likes")
                .where(field("recipeId").equal(variable("parentRecipeId")))
                .aggregate(countAll().as("count"))
                .toScalarExpression()
                .as("likes")
        );

    if (filters.authorId) {
        pipeline = pipeline.where(field("authorId").equal(filters.authorId));
    }

    if (filters.minRating && filters.minRating > 0) {
        pipeline = pipeline.where(field("averageRating").greaterThanOrEqual(filters.minRating));
    }

    if (filters.tags && filters.tags.length > 0) {
        pipeline = pipeline.where(field("tags").arrayContainsAny(filters.tags));
    }

    if (filters.likedOnly) {
        pipeline = pipeline.where(field("likes").greaterThan(0));
    }

    if (filters.sort) {
        switch (filters.sort) {
            case 'title':
                pipeline = pipeline.sort(field('title').ascending());
                break;
            case 'rating':
                pipeline = pipeline.sort(field('averageRating').descending());
                break;
            case 'likes':
                pipeline = pipeline.sort(field('likes').descending());
                break;
        }
    } else if (filters.searchTerm) {
        pipeline = pipeline.sort(field('searchScore').descending());
    }

    const { results } = await execute(pipeline);
    return results.map(result => ({ ...result.data(), id: result.id }) as Recipe);
}