import { useEffect, useState } from "react";
import {
  data,
  href,
  redirect,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
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
import { getRecipesHrefWithSearch } from "@/lib/navigation";
import { isDebugSsrEnabled } from "@/lib/ssr";

export const handle = { hideHeader: true };

// Omit `s-maxage` so Firebase App Hosting's Cloud CDN honors `stale-while-revalidate`
const PUBLIC_RECIPE_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";

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
export async function loader({ request, params }: Route.LoaderArgs) {
  if (!params.recipeId) {
    throw data("No recipe ID provided", { status: 400 });
  }
  const recipe = await getRecipe(params.recipeId);
  if (!recipe) {
    throw data("Recipe not found", { status: 404 });
  }
  const cacheControl = isDebugSsrEnabled(new URL(request.url).searchParams)
    ? "private, no-store"
    : PUBLIC_RECIPE_CACHE_CONTROL;
  return data(
    {
      recipe,
      isLiked: false,
      checkedLikesForUid: null as string | null,
      ssr: true,
    },
    {
      headers: { "Cache-Control": cacheControl },
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
    ssr: false,
  };
}

export function shouldRevalidate({
  actionResult,
  currentParams,
  nextParams,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod && formMethod.toLowerCase() !== "get") {
    if (
      actionResult &&
      typeof actionResult === "object" &&
      "ok" in actionResult &&
      actionResult.ok === false
    ) {
      return false;
    }
    return defaultShouldRevalidate;
  }
  return currentParams.recipeId !== nextParams.recipeId;
}

// Client mutations run with browser Firebase Auth credentials and automatically revalidate clientLoader
export async function clientAction({
  request,
  params,
}: Route.ClientActionArgs) {
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
  const rawIntent = formData.get("intent");
  const intent = typeof rawIntent === "string" ? rawIntent : "";

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
        return data(
          { ok: false, error: "Rating must be between 1 and 5." },
          { status: 400 }
        );
      }
      await addReview(recipeId, user.uid, rating);
      return { ok: true };
    }

    if (intent === "delete") {
      await deleteRecipe(recipeId);
      return redirect(getRecipesHrefWithSearch(formData.get("recipesSearch")));
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
  const { recipe, isLiked, checkedLikesForUid, ssr } = loaderData;
  const { user, authReady } = useAuthUser();
  const [clientLikedLookup, setClientLikedLookup] = useState<{
    recipeId: string;
    uid: string;
    liked: boolean;
  } | null>(null);

  // If a signed-in user hard-refreshes an SSR-rendered recipe page, hydrate their liked state once
  // without re-running clientLoader (preserving the SSR recipe payload).
  useEffect(() => {
    if (!authReady) {
      return;
    }
    const uid = user?.uid ?? null;
    if (!uid || uid === checkedLikesForUid) {
      return;
    }
    let cancelled = false;
    isRecipeLikedByUser(uid, recipe.id)
      .then((liked) => {
        if (!cancelled) {
          setClientLikedLookup({ recipeId: recipe.id, uid, liked });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientLikedLookup({ recipeId: recipe.id, uid, liked: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, user?.uid, checkedLikesForUid, recipe.id]);

  const uid = user?.uid ?? null;
  const hasLoaderLikesForUser = Boolean(uid && checkedLikesForUid === uid);
  const hasHydratedLikesForUser = Boolean(
    uid &&
    clientLikedLookup?.recipeId === recipe.id &&
    clientLikedLookup.uid === uid
  );

  let resolvedIsLiked = false;
  if (hasLoaderLikesForUser) {
    resolvedIsLiked = isLiked;
  } else if (hasHydratedLikesForUser && clientLikedLookup) {
    resolvedIsLiked = clientLikedLookup.liked;
  }

  const isLikeStateReady =
    authReady && (!uid || hasLoaderLikesForUser || hasHydratedLikesForUser);

  return (
    <RecipeDetail
      recipe={recipe}
      isLiked={resolvedIsLiked}
      likeStateReady={isLikeStateReady}
      ssr={ssr}
    />
  );
}
