# FriendlyMeals (React Router SSR + Firebase Workshop)

FriendlyMeals is an AI-powered recipe generator and community cookbook built with **React 19**, **React Router v8 (Framework Mode with SSR)**, and **Firebase**:

- **Firebase AI Logic (`firebase/ai`)**: Generates structured JSON recipes directly from the browser with `gemini-3.8-flash` and `Schema.object`.
- **Firestore Enterprise (`firebase/firestore/pipelines`)**: Computes recipe review averages, like counts, tags, and search filters in a single pipeline query shared between Node SSR `loader`s and browser `clientLoader`s.
- **React Router SSR + Resource Routes**: Renders `/`, `/recipes`, and `/recipes/:recipeId` on the server with Cloud CDN `Cache-Control` headers, skips the server hop on subsequent SPA navigations, handles mutations with `clientAction` + `useFetcher`, and serves raw `text/markdown` at `/recipes/:recipeId.md` for agents and `curl`.
- **Firebase Authentication (`@firebase-oss/ui-shadcn`)**: Prebuilt Shadcn sign-in and sign-up screens (Email/Password + Google) with client-side route protection (`clientMiddleware` + `clientLoader` in `app/routes/_protected.tsx`) and `request.auth.uid` Security Rules.
- **Production Hardening & App Hosting**: Browser-guarded Firebase App Check, Remote Config (`recipe_system_prompt` and `recipe_model`), Crashlytics for Web (`<HydratedRouter onError>` + `entry.server.tsx handleError` + hidden sourcemaps), and Firebase App Hosting (`apphosting.yaml`).

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure Firebase:**

   Paste your Firebase web app config into `app/firebase/firebase-config.ts` (`localFirebaseConfig`), or create a `.env.local` file:

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   # Optional: override Firestore database ID (defaults to named Enterprise DB "default")
   VITE_FIRESTORE_DATABASE_ID=default
   # Optional (Production Hardening): reCAPTCHA Enterprise site key & localhost debug token
   VITE_RECAPTCHA_SITE_KEY=...
   VITE_APPCHECK_DEBUG_TOKEN=...
   ```

   > **Note on Firestore Enterprise database IDs:** Firestore Enterprise requires a named database ID rather than `(default)`. This repo targets `"default"` (without parentheses) in `firebase.json` and `app/firebase/firebase-config.ts`. If you created a different named Enterprise database in the Firebase Console, set `VITE_FIRESTORE_DATABASE_ID` (and update `firebase.json`) to match.

3. **Provision Firestore Enterprise, Indexes, and Security Rules:**

   ```bash
   firebase firestore:databases:create default \
     --location=nam5 \
     --edition=enterprise \
     --firestore-data-access=ENABLED \
     --mongodb-compatible-data-access=DISABLED

   firebase deploy --only firestore
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   ```

## Production Hardening Notes

- **App Check enforcement:** Enforce App Check on **Firebase AI Logic** (Gemini requests run strictly in the browser where reCAPTCHA Enterprise tokens are minted). Leave App Check unenforced on **Firestore**, because Node SSR `loader`s on Cloud Run query public recipes with the Firebase Web SDK without a browser reCAPTCHA token.
- **Remote Config parameters:** Create `recipe_system_prompt` and `recipe_model` in Firebase Remote Config to tune prompts or swap Gemini models without redeploying. Both fall back cleanly to local defaults when offline or unconfigured.

## Production Build, Deploy & Sourcemaps

```bash
# Typecheck, lint, and build SSR + client bundles (with hidden sourcemaps)
npm run typecheck
npm run lint
npm run build

# Deploy to Firebase App Hosting from local source
firebase deploy

# Upload hidden sourcemaps to Firebase Crashlytics
npm run upload:sourcemaps -- --app <YOUR_FIREBASE_WEB_APP_ID>
```
