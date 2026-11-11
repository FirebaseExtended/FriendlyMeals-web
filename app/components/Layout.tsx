import type { FC, ReactNode } from "react";
import {
  href,
  isRouteErrorResponse,
  Link,
  Outlet,
  useLocation,
  useMatches,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/Layout";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/firebase/auth";
import { cn } from "@/lib/utils";

const FirebaseLogo: FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 192 192"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m124.072 170.836-.005-.002a66.724 66.724 0 0 1-30.396 6.125 67.007 67.007 0 0 1-22.703-4.797l-22.054-66.018 15.28-29.593h56.347s3.533 94.286 3.531 94.285Z"
      fill="#FF9100"
    />
    <path
      d="M94.438 152.218c-19.528-18.059-31.377-44.2-30.374-72.873.033-.929.083-1.862.139-2.791a50.693 50.693 0 0 0-10.906-1.59 50.617 50.617 0 0 0-15.503 1.862 66.7 66.7 0 0 0-8.752 30.832c-1.012 28.964 16.515 54.269 41.926 64.504a50.692 50.692 0 0 0 23.47-19.944Z"
      fill="#FFC400"
    />
    <path
      d="M99.54 8.69C86.749 18.94 76.643 32.451 70.534 48.02a94.509 94.509 0 0 0-6.34 28.534c22.462 5.795 38.691 26.561 37.846 50.706a50.355 50.355 0 0 1-7.616 24.963 94.543 94.543 0 0 0 29.648 18.613c22.218-10.268 37.98-32.365 38.891-58.502.591-16.936-5.915-32.028-15.106-44.768C138.148 54.096 99.54 8.69 99.54 8.69Z"
      fill="#DD2C00"
    />
  </svg>
);

type RouteHandle = {
  hideHeader?: boolean;
  hideHeaderActions?: boolean;
};

const AppShell: FC<{ children: ReactNode; forceHeader?: boolean }> = ({
  children,
  forceHeader = false,
}) => {
  const user = useAuthUser();
  const location = useLocation();
  const navigation = useNavigation();
  const matches = useMatches();
  const hideHeaderFromRoute = matches.some((match) =>
    Boolean((match.handle as RouteHandle | undefined)?.hideHeader)
  );
  const hideHeaderActions = matches.some((match) =>
    Boolean((match.handle as RouteHandle | undefined)?.hideHeaderActions)
  );
  const showHeader = forceHeader || !hideHeaderFromRoute;
  const loginPath = href("/login");
  const targetLocation =
    navigation.location && navigation.location.pathname !== loginPath
      ? navigation.location
      : location;
  const signInHref = `${loginPath}?redirectTo=${encodeURIComponent(`${targetLocation.pathname}${targetLocation.search}`)}`;

  return (
    <div
      className={cn(
        "grid min-h-dvh bg-background",
        showHeader ? "grid-rows-[auto_1fr_auto]" : "grid-rows-[1fr_auto]"
      )}
    >
      {showHeader && (
        <header className="border-b bg-card">
          <nav
            aria-label="Primary"
            className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
          >
            <Link
              to={href("/recipes")}
              prefetch="intent"
              className="inline-flex w-fit items-center font-display text-2xl sm:text-[1.65rem] font-normal tracking-wide hover:opacity-85 transition-opacity"
            >
              Friendly Meals
            </Link>

            {hideHeaderActions ? (
              <div aria-hidden="true" className="h-8 w-28" />
            ) : user ? (
              <Button asChild size="sm" className="w-28">
                <Link to={href("/generate")} prefetch="intent">
                  Generate
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-28">
                <Link to={signInHref} prefetch="intent">
                  Sign in
                </Link>
              </Button>
            )}
          </nav>
        </header>
      )}
      <main className="mx-auto w-full min-w-0 max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-5xl items-center justify-center px-4 py-5 text-xs text-muted-foreground sm:px-6">
        <a
          href="https://firebase.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-muted-foreground/85 hover:text-foreground transition-colors"
        >
          <FirebaseLogo className="size-4 shrink-0" />
          <span>built with Firebase</span>
        </a>
      </footer>
    </div>
  );
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let heading = "Something went wrong";
  let details = "An unexpected error occurred while loading this page.";

  if (isRouteErrorResponse(error)) {
    heading =
      error.status === 404 ? "404 - Not Found" : `Error ${error.status}`;
    details =
      error.status === 404
        ? "The requested recipe or page could not be found."
        : typeof error.data === "string"
          ? error.data
          : error.statusText || details;
  } else if (error instanceof Error) {
    details = error.message;
  }

  return (
    <AppShell forceHeader>
      <div className="max-w-xl mx-auto my-12 py-12 px-6 rounded-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">{heading}</h1>
        <p className="text-muted-foreground">{details}</p>
        <div className="flex justify-center pt-2">
          <Button asChild>
            <Link to={href("/recipes")} prefetch="intent">
              Browse Recipes
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

const Layout: FC = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default Layout;
