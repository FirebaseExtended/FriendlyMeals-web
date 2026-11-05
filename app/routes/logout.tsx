import { data, href, redirect } from "react-router";
import type { Route } from "./+types/logout";
import { Spinner } from "@/components/ui/spinner";
import { signOutUser, waitForAuthReady } from "@/firebase/auth";
import { useWasServerRendered } from "@/lib/ssr";
import { cn } from "@/lib/utils";

export function meta() {
  return [{ title: "Signing Out - Friendly Meals" }];
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const cacheControl = loaderHeaders.get("Cache-Control");
  return cacheControl ? { "Cache-Control": cacheControl } : {};
}

// Never redirect on the server: Firebase Auth lives in browser IndexedDB,
// so hard navigations to /logout must hydrate in the browser to clear session state.
export async function loader() {
  return data(null, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function clientLoader() {
  await waitForAuthReady();
  await signOutUser();
  throw redirect(href("/recipes"));
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  const isSsr = useWasServerRendered();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl px-6 py-4 text-muted-foreground",
          isSsr && "ssr"
        )}
      >
        <Spinner className="h-5 w-5" />
        <span>Signing out...</span>
      </div>
    </div>
  );
}

export default function LogoutPage() {
  return null;
}
