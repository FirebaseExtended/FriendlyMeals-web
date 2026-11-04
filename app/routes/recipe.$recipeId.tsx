import { useEffect } from "react";
import { data, href, redirect, useRevalidator } from "react-router";
import type { Route } from "./+types/recipe.$recipeId";
import RecipeDetail from "@/components/Recipe";
import {
  addReview,
  deleteRecipe,
  getRecipe,
  isRecipeLikedByUser,
  likeRecipe,
  unlikeRecipe,
} from "@/firebase/data";
import { useAuthUser, waitForAuthReady } from "@/firebase/auth";
import { reportClientError } from "@/firebase/crashlytics";

const PUBLIC_RECIPE_CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  if (errorHeaders) {
    return {};
  }
  const cacheControl = loaderHeaders.get("Cache-Control");
  return cacheControl ? { "Cache-Control": cacheControl } : {};
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.recipe?.title || "Recipe";
  return [
    { title: `${title} - Friendly Meals` },
    { name: "description", content: `View recipe: ${title}` },
  ];
}

// Initial HTML request runs on the server and can be cached by Cloud CDN
export async function loader({ params }: Route.LoaderArgs) {
  if (!params.recipeId) {
    throw data("No recipe ID provided", { status: 400 });
  }
  const recipe = await getRecipe(params.recipeId);
  if (!recipe) {
    throw data("Recipe not found", { status: 404 });
  }
  return data(
    {
      recipe,
      isLiked: false,
      checkedLikesForUid: null as string | null,
    },
    {
      headers: { "Cache-Control": PUBLIC_RECIPE_CACHE_CONTROL },
    }
  );
}

// Subsequent SPA navigations and post-mutation revalidations query Firestore directly from the browser
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (!params.recipeId) {
    throw data("No recipe ID provided", { status: 400 });
  }
  const user = await waitForAuthReady();
  const [recipe, isLiked] = await Promise.all([
    getRecipe(params.recipeId),
    user
      ? isRecipeLikedByUser(user.uid, params.recipeId).catch(() => false)
      : Promise.resolve(false),
  ]);
  if (!recipe) {
    throw data("Recipe not found", { status: 404 });
  }
  return {
    recipe,
    isLiked,
    checkedLikesForUid: user?.uid ?? null,
  };
}

// Client mutations run with browser Firebase Auth credentials and automatically revalidate clientLoader
export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const recipeId = params.recipeId;
  if (!recipeId) {
    throw data("No recipe ID provided", { status: 400 });
  }

  const user = await waitForAuthReady();
  if (!user) {
    const recipePath = href("/recipes/:recipeId", { recipeId });
    return redirect(
      `${href("/login")}?redirectTo=${encodeURIComponent(recipePath)}`
    );
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    if (intent === "like") {
      const nextLiked = formData.get("nextLiked") === "true";
      if (nextLiked) {
        await likeRecipe(user.uid, recipeId);
      } else {
        await unlikeRecipe(user.uid, recipeId);
      }
      return { ok: true };
    }

    if (intent === "rate") {
      const rating = Number(formData.get("rating"));
      if (Number.isNaN(rating) || rating < 1 || rating > 5) {
        return data({ ok: false, error: "Rating must be between 1 and 5." }, { status: 400 });
      }
      await addReview(recipeId, user.uid, rating);
      return { ok: true };
    }

    if (intent === "delete") {
      await deleteRecipe(recipeId);
      return redirect(href("/recipes"));
    }

    return data({ ok: false, error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    reportClientError(error, { route: "recipe.$recipeId", intent });
    return data(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save your change. Please try again.",
      },
      { status: 500 }
    );
  }
}

export default function RecipePage({ loaderData }: Route.ComponentProps) {
  const { recipe, isLiked, checkedLikesForUid } = loaderData;
  const { user, authReady } = useAuthUser();
  const revalidator = useRevalidator();

  // If a signed-in user hard-refreshes an SSR-rendered recipe page, hydrate their liked state once
  useEffect(() => {
    if (
      authReady &&
      (user?.uid ?? null) !== checkedLikesForUid &&
      revalidator.state === "idle"
    ) {
      revalidator.revalidate();
    }
  }, [authReady, user?.uid, checkedLikesForUid, revalidator]);

  return <RecipeDetail recipe={recipe} isLiked={isLiked} />;
}
