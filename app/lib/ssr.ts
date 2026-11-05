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
