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

2. **Configure Firebase (`app/firebase/firebase-config.ts`):**

   Fetch your web app configuration and paste it into `firebaseConfig` in `app/firebase/firebase-config.ts`:

   ```bash
   firebase apps:sdkconfig WEB
   ```

   *(When `firebaseConfig` is left empty, `initializeFirebaseApp()` falls back to zero-argument `initializeApp()` for automatic initialization on Firebase App Hosting.)*

3. **Provision Firestore Enterprise, Indexes, and Security Rules:**

   Firestore Enterprise requires a named database ID rather than `(default)`. This repo targets `"default"` (without parentheses) in `firebase.json` and `app/firebase/data.ts`:

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

- **App Check:** Set `VITE_RECAPTCHA_SITE_KEY` (and optional `VITE_APPCHECK_DEBUG_TOKEN` in `.env.local` for localhost) to initialize App Check in the browser. Enforce App Check on **Firebase AI Logic** (browser-only), and leave it unenforced on **Firestore** because Cloud Run SSR `loader`s query public recipes using the Firebase Web SDK without a browser reCAPTCHA token.
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
