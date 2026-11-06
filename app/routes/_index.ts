import { href, redirect } from "react-router";
import type { Route } from "./+types/_index";

export function loader({ request }: Route.LoaderArgs) {
  const { search } = new URL(request.url);
  const cacheControl = search ? "private, no-store" : "public, max-age=3600";
  return redirect(`${href("/recipes")}${search}`, {
    headers: { "Cache-Control": cacheControl },
  });
}

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { search } = new URL(request.url);
  return redirect(`${href("/recipes")}${search}`);
}
