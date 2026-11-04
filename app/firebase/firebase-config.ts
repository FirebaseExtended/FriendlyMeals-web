import type { FirebaseOptions } from "firebase/app";

declare const __FIREBASE_WEBAPP_CONFIG__: string | undefined;
declare const __FIRESTORE_DATABASE_ID__: string | undefined;

/**
 * Paste your Firebase web app configuration below, or provide VITE_FIREBASE_*
 * variables in .env.local. On Firebase App Hosting, FIREBASE_WEBAPP_CONFIG is
 * injected automatically at build time and bridged into both SSR and browser
 * bundles via `define` in vite.config.ts.
 *
 * Fetch your config from the CLI with:
 *   npx firebase-tools apps:sdkconfig web
 */
const localFirebaseConfig: FirebaseOptions | null = null;

function parseWebAppConfigJson(rawJson: string | undefined): FirebaseOptions | null {
  if (!rawJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawJson) as FirebaseOptions;
    if (parsed.apiKey && parsed.projectId) {
      return parsed;
    }
  } catch {
    // Ignore malformed JSON and fall through
  }
  return null;
}

function readEnvFirebaseConfig(): FirebaseOptions | null {
  const viteEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  if (viteEnv?.VITE_FIREBASE_API_KEY && viteEnv?.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: viteEnv.VITE_FIREBASE_API_KEY,
      authDomain: viteEnv.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: viteEnv.VITE_FIREBASE_PROJECT_ID,
      storageBucket: viteEnv.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: viteEnv.VITE_FIREBASE_APP_ID,
      measurementId: viteEnv.VITE_FIREBASE_MEASUREMENT_ID,
    };
  }

  const bridgedWebAppConfig =
    typeof __FIREBASE_WEBAPP_CONFIG__ !== "undefined"
      ? __FIREBASE_WEBAPP_CONFIG__
      : undefined;
  const fromDefine = parseWebAppConfigJson(bridgedWebAppConfig);
  if (fromDefine) {
    return fromDefine;
  }

  const runtimeWebAppConfig =
    typeof process !== "undefined" ? process.env?.FIREBASE_WEBAPP_CONFIG : undefined;
  return parseWebAppConfigJson(runtimeWebAppConfig);
}

const resolvedConfig = localFirebaseConfig ?? readEnvFirebaseConfig();

export const isFirebaseConfigured = Boolean(
  resolvedConfig?.apiKey && resolvedConfig?.projectId
);

export const firebaseConfig: FirebaseOptions = resolvedConfig ?? {
  apiKey: "demo-unconfigured-api-key",
  authDomain: "demo-friendly-meals.firebaseapp.com",
  projectId: "demo-friendly-meals",
  appId: "1:000000000000:web:000000000000",
};

/**
 * Firestore Enterprise databases require a named database ID (such as "default",
 * without parentheses) rather than "(default)". Override via
 * VITE_FIRESTORE_DATABASE_ID or FIRESTORE_DATABASE_ID if needed.
 */
export const FIRESTORE_DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_FIRESTORE_DATABASE_ID?.trim()) ||
  (typeof __FIRESTORE_DATABASE_ID__ !== "undefined" &&
    __FIRESTORE_DATABASE_ID__.trim()) ||
  (typeof process !== "undefined" && process.env?.FIRESTORE_DATABASE_ID?.trim()) ||
  "default";

export function assertFirebaseConfigured(): void {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured yet. Set localFirebaseConfig in app/firebase/firebase-config.ts or add VITE_FIREBASE_* variables to .env.local."
    );
  }
}
