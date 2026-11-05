import { type FC, type ReactNode } from "react";
import {
  href,
  isRouteErrorResponse,
  Link,
  Outlet,
  useMatch,
  useNavigate,
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
import { useWasServerRendered } from "@/lib/ssr";
import { cn } from "@/lib/utils";

const MenuLink: FC<{ to: string; label: string }> = ({ to, label }) => {
  const active = useMatch({ path: to, end: false });
  const classes =
    "group inline-flex h-9 w-max items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-emerald-50 data-[active]:text-emerald-700 data-[active]:font-semibold dark:data-[active]:bg-emerald-950/60 dark:data-[active]:text-emerald-300";

  return (
    <NavigationMenuLink asChild active={active !== null} className={classes}>
      <Link to={to}>{label}</Link>
    </NavigationMenuLink>
  );
};

const AppShell: FC<{ children: ReactNode }> = ({ children }) => {
  const isSsr = useWasServerRendered();
  const { user, authReady } = useAuthUser();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    navigate(href("/recipes"));
    await signOutUser();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className={cn("border-b bg-background", isSsr && "ssr")}>
        <div className="container max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to={href("/recipes")}
            className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight hover:opacity-90 transition-opacity"
          >
            <Flame className="w-5 h-5 text-emerald-600" />
            <span>Friendly Meals</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <NavigationMenu>
              <NavigationMenuList className="flex flex-wrap gap-1">
                <NavigationMenuItem>
                  <MenuLink to={href("/recipes")} label="Recipes" />
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <MenuLink to={href("/generate")} label="Generate" />
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            {!authReady ? (
              <div aria-hidden="true" className="h-8 w-28" />
            ) : user ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="w-28 gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-28">
                <Link to={href("/login")}>Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="container max-w-6xl mx-auto px-4 py-6">{children}</main>
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
    <AppShell>
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
