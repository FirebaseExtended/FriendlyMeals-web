# FriendlyMeals (React Router SSR + Firebase Workshop)

FriendlyMeals is a recipe generator and community cookbook built with React 19, React Router v8 (Framework Mode with SSR), and Firebase:

- **Firebase AI Logic (`firebase/ai`)**: Generates structured JSON recipes from the browser with `gemini-3.8-flash` and `Schema.object`.
- **Firestore Enterprise (`firebase/firestore/pipelines`)**: Computes recipe review averages, like counts, tags, and search filters in a single pipeline query shared between Node SSR `loader`s and browser `clientLoader`s.
- **React Router SSR + resource routes**: Renders `/`, `/recipes`, and `/recipes/:recipeId` on the server with Cloud CDN `Cache-Control` headers, skips the server hop on subsequent SPA navigations, handles mutations with `clientAction` + `useFetcher`, and serves raw `text/markdown` at `/recipes/:recipeId.md` for agents and `curl`.
- **Firebase Authentication (`@firebase-oss/ui-shadcn`)**: Prebuilt Shadcn sign-in and sign-up screens (Email/Password + Google) with client-side route protection (`clientLoader` + `getUser()` in `app/routes/generate.tsx`), a client-hydrated `/logout` route, and `request.auth.uid` Security Rules.
- **Production hardening + App Hosting**: Browser-guarded Firebase App Check, Remote Config (`recipe_system_prompt` and `recipe_model`), structured Cloud Logging SSR error reporting, and Firebase App Hosting (`apphosting.yaml`).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Firebase project and register a web app**

   - Create or select a project in the [Firebase Console](https://console.firebase.google.com/) and [upgrade to the Blaze pay-as-you-go plan](https://console.firebase.google.com/project/_/overview?purchaseBillingPlan=metered) (required for Firestore Enterprise and App Hosting).
   - Log in and select the project in the Firebase CLI:

     ```bash
     firebase login
     firebase use <YOUR_PROJECT_ID>
     ```

   - Register a Web app in [Project settings](https://console.firebase.google.com/project/_/settings/general/) (or via CLI with `firebase apps:create WEB friendlymeals` and `firebase apps:sdkconfig WEB`) and paste the `firebaseConfig` object into `app/firebase/firebase-config.ts` for local development. Leave `firebaseConfig` uncommitted (`{}`) in git if you want Firebase App Hosting to use zero-argument `initializeApp()` automatic initialization in production.

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

   _(If you are reusing a Firebase project that already has Remote Config parameters, run `firebase remoteconfig:get` first and merge existing keys into `remoteconfig.template.json` before deploying.)_

   You can update live values later in [Remote Config](https://console.firebase.google.com/project/_/config) without redeploying the app, or pull remote edits locally with `firebase remoteconfig:get -o remoteconfig.template.json`.

7. **Start the dev server**

   ```bash
   npm run dev
   ```

## Production hardening and deployment

- **App Check**:
  1. In [App Check > Apps](https://console.firebase.google.com/project/_/appcheck/apps), register your Web app with a **reCAPTCHA Enterprise** site key.
  2. For local development (`npm run dev`), copy the `Firebase App Check debug token` printed in your browser console and add it in App Check > **Manage debug tokens**. For production on App Hosting, add `VITE_RECAPTCHA_SITE_KEY` under `env` in `apphosting.yaml`.
  3. In [App Check > APIs](https://console.firebase.google.com/project/_/appcheck/products), enforce App Check on **Firebase AI Logic** (note: once enforced, `/generate` rejects Gemini calls until your Web app and debug token are configured). Leave **Cloud Firestore** unenforced so Cloud Run SSR `loader`s can read public recipes without a browser reCAPTCHA token.
- **App Hosting**:
  1. In [App Hosting](https://console.firebase.google.com/project/_/apphosting), connect your GitHub repository, create the `friendly-meals` backend (`apphosting.yaml`), and **associate your Firebase Web app** with the backend so App Hosting injects `FIREBASE_WEBAPP_CONFIG` for zero-argument `initializeApp()`. (To provision and deploy from local source via CLI instead, run `firebase apphosting:backends:create --non-interactive --backend friendly-meals --primary-region us-central1 --app <YOUR_FIREBASE_WEB_APP_ID> -s firebase-app-hosting-compute@<YOUR_PROJECT_ID>.iam.gserviceaccount.com --root-dir /` followed by `firebase deploy --only apphosting`.)
  2. After the backend is created, add its `<BACKEND_ID>--<PROJECT_ID>.<REGION>.hosted.app` domain in [Authentication > Settings > Authorized domains](https://console.firebase.google.com/project/_/authentication/settings) so Google Sign-In works on the live URL.

## Scripts

```bash
npm run dev        # Start Vite 8 + React Router SSR dev server
npm run typecheck  # Run react-router typegen && tsc -b (TypeScript 7)
npm run lint       # Run Oxlint (type-aware + React Compiler rules)
npm run format     # Format files with Oxfmt
npm run build      # Build client assets (Oxc React Compiler) + SSR server bundle
npm run start      # Serve production SSR build locally
```
