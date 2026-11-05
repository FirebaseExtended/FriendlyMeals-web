import { useEffect, useState } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import { initializeUI, type FirebaseUIStore } from "@firebase-oss/ui-core";
import { firebaseApp } from "./firebase";

let authInstance: Auth | null = null;
let uiStoreInstance: FirebaseUIStore | null = null;

export function getClientAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error(
      "Firebase Auth uses IndexedDB in the browser and cannot be called during SSR."
    );
  }
  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
  }
  return authInstance;
}

export function getFirebaseUI(): FirebaseUIStore {
  if (typeof window === "undefined") {
    throw new Error("FirebaseUI can only be initialized in the browser.");
  }
  if (!uiStoreInstance) {
    uiStoreInstance = initializeUI({
      app: firebaseApp,
    });
  }
  return uiStoreInstance;
}

/**
 * Waits for Firebase Auth to restore any IndexedDB session in the browser.
 * Returns null when signed out or called outside the browser.
 */
export async function waitForAuthReady(): Promise<FirebaseUser | null> {
  if (typeof window === "undefined") {
    return null;
  }
  const auth = getClientAuth();
  await auth.authStateReady();
  return auth.currentUser;
}

export async function signOutUser(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  await signOut(getClientAuth());
}

/**
 * Hydration-safe React hook for reading client-side Firebase Auth state.
 * Renders `{ user: null, authReady: false }` on SSR and initial hydration pass,
 * then updates once IndexedDB auth state resolves.
 */
export function useAuthUser(): {
  user: FirebaseUser | null;
  authReady: boolean;
} {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  return { user, authReady };
}
