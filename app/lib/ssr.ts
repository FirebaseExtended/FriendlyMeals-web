import { useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => false;
const getServerSnapshot = () => true;

/**
 * Returns `true` if this component instance was rendered on the server (and
 * hydrated from SSR HTML), or `false` if it mounted purely in the browser.
 */
export function useWasServerRendered(): boolean {
  const isServerOrHydrating = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const [wasServerRendered] = useState(isServerOrHydrating);
  return wasServerRendered;
}

/**
 * Returns `true` when `?debugSSR` is present in `searchParams` (unless
 * explicitly disabled with `debugSSR=false` or `debugSSR=0`).
 */
export function isDebugSsrEnabled(searchParams: URLSearchParams): boolean {
  if (!searchParams.has("debugSSR")) {
    return false;
  }
  const raw = searchParams.get("debugSSR")?.trim().toLowerCase();
  return raw !== "false" && raw !== "0";
}
