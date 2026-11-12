import {
  CustomProvider,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import { initializeFirebaseApp } from "./firebase-config";

export const firebaseApp = initializeFirebaseApp();

let appCheckInstance: AppCheck | null = null;

/**
 * Initializes Firebase App Check in the browser. In development, activates
 * debug mode automatically (printing the debug token to the browser console)
 * without requiring a reCAPTCHA site key; in production, requires
 * `VITE_RECAPTCHA_SITE_KEY`. Guarding on `typeof window !== "undefined"` keeps
 * Node SSR loaders safe.
 */
export function initializeBrowserAppCheck(): AppCheck | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (appCheckInstance) {
    return appCheckInstance;
  }

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
  if (import.meta.env.PROD && !siteKey) {
    return null;
  }

  if (import.meta.env.DEV) {
    const debugGlobal = self as typeof self & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
    };
    const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN?.trim();
    debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
  }

  const provider = siteKey
    ? new ReCaptchaEnterpriseProvider(siteKey)
    : new CustomProvider({
        getToken: () =>
          Promise.reject(
            new Error("VITE_RECAPTCHA_SITE_KEY is required in production.")
          ),
      });

  appCheckInstance = initializeAppCheck(firebaseApp, {
    provider,
    isTokenAutoRefreshEnabled: true,
  });

  return appCheckInstance;
}

if (typeof window !== "undefined") {
  initializeBrowserAppCheck();
}

let aiInstance: AI | null = null;

export function getFirebaseAI(): AI {
  if (!aiInstance) {
    const activeAppCheck = initializeBrowserAppCheck();
    aiInstance = getAI(firebaseApp, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens:
        import.meta.env.PROD && Boolean(activeAppCheck),
    });
  }
  return aiInstance;
}
