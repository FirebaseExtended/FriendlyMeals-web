import { useEffect, useRef, type FC, type ReactNode } from "react";
import {
  href,
  isRouteErrorResponse,
  Link,
  Outlet,
  useMatch,
  useNavigate,
  useRevalidator,
} from "react-router";
import { Flame, LogOut } from "lucide-react";
import type { Route } from "./+types/Layout";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { signOutUser, useAuthUser } from "@/firebase/auth";

const MenuLink: FC<{ to: string; label: string }> = ({ to, label }) => {
  const active = useMatch({ path: to, end: false });
  const classes =
    "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50";

  return (
    <NavigationMenuLink asChild active={active !== null} className={classes}>
      <Link to={to}>{label}</Link>
    </NavigationMenuLink>
  );
};

const AppShell: FC<{ children: ReactNode }> = ({ children }) => {
  const { user, authReady } = useAuthUser();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const prevUidRef = useRef<string | null>(null);

  // Revalidate active clientLoaders (such as _protected) if the user signs out in another tab
  useEffect(() => {
    if (!authReady) {
      return;
    }
    const nextUid = user?.uid ?? null;
    if (prevUidRef.current && !nextUid) {
      revalidator.revalidate();
    }
    prevUidRef.current = nextUid;
  }, [authReady, user?.uid, revalidator]);

  const handleSignOut = async () => {
    await signOutUser();
    navigate(href("/recipes"));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b">
        <Link
          to={href("/")}
          className="flex items-center gap-2 text-xl font-bold hover:opacity-90 transition-opacity"
        >
          <Flame className="w-5 h-5 text-emerald-600" />
          <span>Friendly Meals</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <NavigationMenu>
            <NavigationMenuList className="flex flex-wrap">
              <NavigationMenuItem>
                <MenuLink to={href("/recipes")} label="Recipes" />
              </NavigationMenuItem>
              <NavigationMenuItem>
                <MenuLink to={href("/generate")} label="Generate" />
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {authReady ? (
            user ? (
              <div className="flex items-center gap-2 pl-2 border-l">
                <span className="text-xs text-muted-foreground max-w-[160px] truncate hidden md:inline">
                  {user.displayName || user.email || "Signed in"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to={href("/login")}>Sign In</Link>
              </Button>
            )
          ) : (
            <div className="w-20 h-8" aria-hidden="true" />
          )}
        </div>
      </header>
      <main className="container mx-auto p-2 sm:p-4">{children}</main>
    </div>
  );
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
    <AppShell>
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">{heading}</h1>
        <p className="text-muted-foreground">{details}</p>
        <div className="flex justify-center gap-3 pt-2">
          <Button asChild variant="outline">
            <Link to={href("/recipes")}>Browse Recipes</Link>
          </Button>
          <Button asChild>
            <Link to={href("/")}>Back to Home</Link>
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
