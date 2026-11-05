import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";

// Paste output of `firebase apps:sdkconfig WEB` here for local development
const firebaseConfig: FirebaseOptions & Record<string, unknown> = {};

export function initializeFirebaseApp(): FirebaseApp {
  if (firebaseConfig.apiKey) {
    return initializeApp(firebaseConfig);
  }

  try {
    // Automatic initialization on Firebase App Hosting
    // https://firebase.google.com/docs/app-hosting/firebase-sdks#initialize-with-no-arguments
    return initializeApp();
  } catch {
    throw new Error(
      "Missing Firebase config. Paste it into app/firebase/firebase-config.ts (run: firebase apps:sdkconfig WEB)."
    );
  }
}
