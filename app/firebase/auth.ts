import { useSyncExternalStore } from "react";
import {
  getAuth,
  onIdTokenChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { initializeUI, type FirebaseUIStore } from "@firebase-oss/ui-core";
import { firebaseApp } from "./firebase";

let uiStoreInstance: FirebaseUIStore | null = null;

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

let isAuthReady = false;

/**
 * Waits for Firebase Auth to restore any IndexedDB session in the browser.
 */
export async function getUser(): Promise<FirebaseUser | null> {
  const auth = getAuth(firebaseApp);
  await auth.authStateReady();
  isAuthReady = true;
  return auth.currentUser;
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuth(firebaseApp));
}

function subscribeToAuth(callback: () => void) {
  return onIdTokenChanged(getAuth(firebaseApp), () => {
    isAuthReady = true;
    callback();
  });
}

export function useAuthUser(): FirebaseUser | null | undefined {
  return useSyncExternalStore(
    subscribeToAuth,
    () => (isAuthReady ? getAuth(firebaseApp).currentUser : undefined),
    () => undefined
  );
}
