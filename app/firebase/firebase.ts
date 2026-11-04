import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import {
  assertFirebaseConfigured,
  firebaseConfig,
  isFirebaseConfigured,
} from "./firebase-config";

function createOrGetFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  if (isFirebaseConfigured) {
    return initializeApp(firebaseConfig);
  }
  try {
    return initializeApp();
  } catch {
    return initializeApp(firebaseConfig);
  }
}

export const firebaseApp = createOrGetFirebaseApp();

let appCheckInstance: AppCheck | null = null;

/**
 * Initializes Firebase App Check in the browser only when a reCAPTCHA Enterprise
 * site key is configured. Guarding on `typeof window !== "undefined"` keeps
 * Node SSR loaders safe.
 */
export function initializeBrowserAppCheck(): AppCheck | null {
  if (typeof window === "undefined" || !isFirebaseConfigured) {
    return null;
  }
  if (appCheckInstance) {
    return appCheckInstance;
  }

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) {
    return null;
  }

  if (import.meta.env.DEV) {
    const debugGlobal = self as typeof self & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
    };
    const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN?.trim();
    debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
  }

  appCheckInstance = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });

  return appCheckInstance;
}

if (typeof window !== "undefined") {
  initializeBrowserAppCheck();
}

let aiInstance: AI | null = null;

export function getFirebaseAI(): AI {
  assertFirebaseConfigured();
  if (!aiInstance) {
    const activeAppCheck = initializeBrowserAppCheck();
    aiInstance = getAI(firebaseApp, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: Boolean(activeAppCheck),
    });
  }
  return aiInstance;
}
