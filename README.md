# FriendlyMeals (React Router SSR + Firebase Workshop)

FriendlyMeals is a recipe generator and community cookbook built with React 19, React Router v8 (Framework Mode with SSR), and Firebase:

- **Firebase AI Logic (`firebase/ai`)**: Generates structured JSON recipes from the browser with `gemini-3.8-flash` and `Schema.object`.
- **Firestore Enterprise (`firebase/firestore/pipelines`)**: Computes recipe review averages, like counts, tags, and search filters in a single pipeline query shared between Node SSR `loader`s and browser `clientLoader`s.
- **React Router SSR + resource routes**: Renders `/`, `/recipes`, and `/recipes/:recipeId` on the server with Cloud CDN `Cache-Control` headers, skips the server hop on subsequent SPA navigations, handles mutations with `clientAction` + `useFetcher`, and serves raw `text/markdown` at `/recipes/:recipeId.md` for agents and `curl`.
- **Firebase Authentication (`@firebase-oss/ui-shadcn`)**: Prebuilt Shadcn sign-in and sign-up screens (Email/Password + Google) with client-side route protection (`clientMiddleware` + `clientLoader` in `app/routes/_protected.tsx`) and `request.auth.uid` Security Rules.
- **Production hardening + App Hosting**: Browser-guarded Firebase App Check, Remote Config (`recipe_system_prompt` and `recipe_model`), Crashlytics for Web (`<HydratedRouter onError>` + `entry.server.tsx handleError` + hidden sourcemaps), and Firebase App Hosting (`apphosting.yaml`).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Firebase project and register a web app**

   - Create or select a project in the [Firebase Console](https://console.firebase.google.com/) and [upgrade to the Blaze pay-as-you-go plan](https://console.firebase.google.com/project/_/overview?purchaseBillingPlan=metered) (required for Firestore Enterprise and App Hosting).
   - Register a Web app in [Project settings](https://console.firebase.google.com/project/_/settings/general/) and paste the `firebaseConfig` object into `app/firebase/firebase-config.ts`. When `firebaseConfig` is empty, `initializeFirebaseApp()` falls back to zero-argument `initializeApp()` on Firebase App Hosting.
   - Log in and select the project in the Firebase CLI for the steps below:

     ```bash
     firebase login
     firebase use <YOUR_PROJECT_ID>
     ```

3. **Enable Authentication providers**

   In [Authentication > Sign-in method](https://console.firebase.google.com/project/_/authentication/providers), enable **Email/Password** and **Google**.

4. **Provision Firestore Enterprise, rules, and indexes**

   Firestore Enterprise uses a named database ID (`friendlymeals` in `firebase.json` and `app/firebase/data.ts`), with native Firestore access and realtime updates enabled by default:

   ```bash
   firebase firestore:databases:create friendlymeals \
     --location=nam5 \
     --edition=enterprise

   firebase deploy --only firestore
   ```

5. **Enable and configure Firebase AI Logic**

   Enable the Gemini Developer API provider, restrict requests to authenticated users, and turn on AI monitoring:

   ```bash
   firebase ailogic:providers:enable gemini-developer-api
   firebase ailogic:config:set security.auth-only true --force
   firebase ailogic:config:set monitoring.state true --force
   ```

6. **Deploy Remote Config parameters**

   Publish `remoteconfig.template.json` (`recipe_model` and `recipe_system_prompt`):

   ```bash
   firebase deploy --only remoteconfig
   ```

   You can update live values later in [Remote Config](https://console.firebase.google.com/project/_/config) without redeploying the app, or pull remote edits locally with `firebase remoteconfig:get -o remoteconfig.template.json`.

7. **Start the dev server**

   ```bash
   npm run dev
   ```

## Production hardening and deployment

- **App Check**: Register your Web app with reCAPTCHA Enterprise (and manage localhost debug tokens) in [App Check > Apps](https://console.firebase.google.com/project/_/appcheck/apps), then set `VITE_RECAPTCHA_SITE_KEY` (and optional `VITE_APPCHECK_DEBUG_TOKEN` in `.env.local` for local dev). Enforce App Check on **Firebase AI Logic** in [App Check > APIs](https://console.firebase.google.com/project/_/appcheck/products). Leave **Cloud Firestore** unenforced so Cloud Run SSR `loader`s can read public recipes without a browser reCAPTCHA token.
- **App Hosting**: Connect your GitHub repository and create the `friendly-meals` backend in [App Hosting](https://console.firebase.google.com/project/_/apphosting) to deploy the SSR server and static assets (`apphosting.yaml`).
- **Crashlytics**: View client and SSR crash reports in [Crashlytics](https://console.firebase.google.com/project/_/crashlytics). After running `npm run build`, upload the hidden sourcemaps in `build` for deobfuscated stack traces:

  ```bash
  npm run upload:sourcemaps -- --app <YOUR_FIREBASE_WEB_APP_ID>
  ```

## Scripts

```bash
npm run dev        # Start Vite + React Router SSR dev server
npm run typecheck  # Run react-router typegen && tsc
npm run lint       # Run ESLint
npm run build      # Build client assets (hidden sourcemaps) + SSR server bundle
npm run start      # Serve production SSR build locally
```
