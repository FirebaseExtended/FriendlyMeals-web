import { type FC, type ReactNode } from "react";
import {
  href,
  isRouteErrorResponse,
  Link,
  Outlet,
  useMatch,
} from "react-router";
import { Flame, Sparkles } from "lucide-react";
import type { Route } from "./+types/Layout";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/firebase/auth";
import { useWasServerRendered } from "@/lib/ssr";
import { cn } from "@/lib/utils";

const AppShell: FC<{ children: ReactNode; forceHeader?: boolean }> = ({
  children,
  forceHeader = false,
}) => {
  const isSsr = useWasServerRendered();
  const { user, authReady } = useAuthUser();
  const onGenerate = Boolean(useMatch(href("/generate")));
  const onRecipeDetail = Boolean(useMatch("/recipes/:recipeId"));
  const onLogin = Boolean(useMatch(href("/login")));
  const showHeader = forceHeader || (!onGenerate && !onRecipeDetail);

  return (
    <div className="min-h-screen bg-muted/40">
      {showHeader && (
        <header className={cn("border-b bg-card", isSsr && "ssr")}>
          <nav
            aria-label="Primary"
            className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
          >
            <Link
              to={href("/recipes")}
              className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight hover:opacity-85 transition-opacity"
            >
              <Flame aria-hidden="true" className="w-5 h-5 text-primary" />
              <span>Friendly Meals</span>
            </Link>

            {onLogin ? (
              <div aria-hidden="true" className="h-8 w-28" />
            ) : !authReady ? (
              <Button type="button" size="sm" disabled className="w-28 gap-1.5">
                <Sparkles aria-hidden="true" className="size-3.5" />
                <span>Generate</span>
              </Button>
            ) : user ? (
              <Button asChild size="sm" className="w-28 gap-1.5">
                <Link to={href("/generate")}>
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  <span>Generate</span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-28">
                <Link to={href("/login")}>Sign in</Link>
              </Button>
            )}
          </nav>
        </header>
      )}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isSsr = useWasServerRendered();
  let heading = "Something went wrong";
  let details = "An unexpected error occurred while loading this page.";

  if (isRouteErrorResponse(error)) {
    heading = error.status === 404 ? "404 - Not Found" : `Error ${error.status}`;
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
      <div
        className={cn(
          "max-w-xl mx-auto my-12 py-12 px-6 rounded-xl text-center space-y-4",
          isSsr && "ssr"
        )}
      >
        <h1 className="text-3xl font-bold text-foreground">{heading}</h1>
        <p className="text-muted-foreground">{details}</p>
        <div className="flex justify-center pt-2">
          <Button asChild>
            <Link to={href("/recipes")}>Browse Recipes</Link>
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
