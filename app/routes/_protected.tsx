import { createContext, href, Outlet, redirect } from "react-router";
import type { Route } from "./+types/_protected";
import { Spinner } from "@/components/ui/spinner";
import { waitForAuthReady } from "@/firebase/auth";
import { useWasServerRendered } from "@/lib/ssr";
import { cn } from "@/lib/utils";

export interface AuthenticatedUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
}

const authUserContext = createContext<AuthenticatedUserSummary | null>(
  null
);

async function requireAuthenticatedUser(
  request: Request
): Promise<AuthenticatedUserSummary> {
  const user = await waitForAuthReady();
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = `${url.pathname}${url.search}`;
    throw redirect(`${href("/login")}?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

/**
 * Firebase Auth persists credentials in browser IndexedDB rather than HTTP
 * cookies. Client middleware runs on SPA navigations to guard protected routes
 * before their loaders execute.
 */
const authGuardMiddleware: Route.ClientMiddlewareFunction = async (
  { request, context },
  next
) => {
  const user = await requireAuthenticatedUser(request);
  context.set(authUserContext, user);
  await next();
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  authGuardMiddleware,
];

/**
 * Runs in the browser on initial hydration of a hard-refreshed protected URL
 * as well as on client-side navigations.
 */
export async function clientLoader({
  request,
  context,
}: Route.ClientLoaderArgs) {
  const user =
    context.get(authUserContext) ?? (await requireAuthenticatedUser(request));
  return { user };
}

export function HydrateFallback() {
  const isSsr = useWasServerRendered();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-6 py-4 text-muted-foreground",
          isSsr && "ssr"
        )}
      >
        <Spinner className="h-5 w-5" />
        <span>Checking authentication...</span>
      </div>
    </div>
  );
}

export default function ProtectedLayout() {
  return <Outlet />;
}
