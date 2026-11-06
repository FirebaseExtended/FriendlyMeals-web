import { useEffect } from "react";
import {
  href,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/_protected";
import { useAuthUser, waitForAuthReady } from "@/firebase/auth";

/**
 * Firebase Auth persists credentials in browser IndexedDB rather than HTTP
 * cookies. Client middleware runs on SPA navigations to guard protected routes
 * before transitioning into them.
 */
const authGuardMiddleware: Route.ClientMiddlewareFunction = async (
  { request },
  next
) => {
  const user = await waitForAuthReady();
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = `${url.pathname}${url.search}`;
    throw redirect(
      `${href("/login")}?redirectTo=${encodeURIComponent(redirectTo)}`
    );
  }
  await next();
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  authGuardMiddleware,
];

/**
 * Allows child routes (such as `/generate`) to SSR their static UI immediately,
 * while silently redirecting to `/login` once IndexedDB auth resolves if the
 * user is signed out.
 */
export default function ProtectedLayout() {
  const { user, authReady } = useAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isLeaving =
    navigation.location != null &&
    navigation.location.pathname !== location.pathname;

  useEffect(() => {
    if (authReady && !user && !isLeaving) {
      const redirectTo = `${location.pathname}${location.search}`;
      void navigate(
        `${href("/login")}?redirectTo=${encodeURIComponent(redirectTo)}`,
        { replace: true }
      );
    }
  }, [authReady, user, isLeaving, location.pathname, location.search, navigate]);

  return <Outlet />;
}
