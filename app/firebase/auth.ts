import { useSyncExternalStore } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import { initializeUI, type FirebaseUIStore } from "@firebase-oss/ui-core";
import { firebaseApp } from "./firebase";

export interface AuthSnapshot {
  user: FirebaseUser | null;
  authReady: boolean;
}

const INITIAL_AUTH_SNAPSHOT: AuthSnapshot = {
  user: null,
  authReady: false,
};

let authInstance: Auth | null = null;
let uiStoreInstance: FirebaseUIStore | null = null;
let currentAuthSnapshot: AuthSnapshot = INITIAL_AUTH_SNAPSHOT;
let authSubscriptionStarted = false;
const authSubscribers = new Set<() => void>();

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

function updateAuthSnapshot(nextUser: FirebaseUser | null): void {
  if (currentAuthSnapshot.authReady && currentAuthSnapshot.user === nextUser) {
    return;
  }
  currentAuthSnapshot = {
    user: nextUser,
    authReady: true,
  };
  for (const listener of authSubscribers) {
    listener();
  }
}

function ensureAuthSubscription(): void {
  if (authSubscriptionStarted || typeof window === "undefined") {
    return;
  }
  authSubscriptionStarted = true;
  const auth = getClientAuth();
  // `onAuthStateChanged` fires its first callback only after IndexedDB auth state resolves
  onAuthStateChanged(auth, (nextUser) => {
    updateAuthSnapshot(nextUser);
  });
}

function subscribeToAuth(onStoreChange: () => void): () => void {
  ensureAuthSubscription();
  authSubscribers.add(onStoreChange);
  return () => {
    authSubscribers.delete(onStoreChange);
  };
}

function getClientAuthSnapshot(): AuthSnapshot {
  ensureAuthSubscription();
  return currentAuthSnapshot;
}

function getServerAuthSnapshot(): AuthSnapshot {
  return INITIAL_AUTH_SNAPSHOT;
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
  ensureAuthSubscription();
  await auth.authStateReady();
  updateAuthSnapshot(auth.currentUser);
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
 * waits for IndexedDB `authStateReady` before flipping `authReady: true`, and
 * synchronously returns the resolved snapshot on all subsequent SPA mounts.
 */
export function useAuthUser(): AuthSnapshot {
  return useSyncExternalStore(
    subscribeToAuth,
    getClientAuthSnapshot,
    getServerAuthSnapshot
  );
}
