import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { firebaseConfig } from "./firebase-config";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { getStorage } from "firebase/storage";

export const firebaseApp = initializeApp(firebaseConfig);

// Initialize App Check
// See http://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
// for instructions for generating reCAPTCHA key.
initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider('RECAPTCHA_KEY'), 
  isTokenAutoRefreshEnabled: true
});

// Initialize the Gemini Developer API backend service
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

export const storage = getStorage(firebaseApp);

export { ai };
