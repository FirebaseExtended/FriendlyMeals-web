# Production React Apps with Firebase and Google Cloud

Follow this workshop guide alongside the live presentation to set up **FriendlyMeals**, run it locally against your own Firebase project, explore how React Router and Firebase split work between the server and browser, and deploy to Firebase App Hosting behind Cloud CDN.

## Prerequisites

- [Node.js](https://nodejs.org/) `>= 22` and `npm` (`node -v`)
- [Git](https://git-scm.com/) and a [GitHub](https://github.com/) account
- A personal `@gmail.com` Google account (required to redeem event billing credits)

---

## Part 1: Set Up a Firebase Project

### 1. Claim $5 in Google Developer Program Credits

1. Open [g.dev/credits/react-summit-us-2026](https://g.dev/credits/react-summit-us-2026) in a browser signed in to your personal `@gmail.com` account.
2. Join the [Google Developer Program](https://developers.google.com/program) if you are not already a member.
3. Claim the event badge and complete mobile verification.
4. Wait 2 to 5 minutes for your credits billing account to finish provisioning.
5. Open a new window in the same `@gmail.com` browser session, go to the [Firebase Console](https://console.firebase.google.com/), and create a new project.
6. Confirm that your new project is linked to the **Google Developer Program Credits** billing account ([Firestore Enterprise edition](https://firebase.google.com/docs/firestore/enterprise/overview) and [Firebase App Hosting](https://firebase.google.com/docs/app-hosting) both require a billed project).

### 2. Create a Web App

1. In [Project settings](https://console.firebase.google.com/project/_/settings/general/), click the Web icon (`</>`) under **Your apps**.
2. Enter an app nickname (for example, `friendlymeals`) and click **Register app** (leave classic Firebase Hosting unchecked; you will use App Hosting later).

### 3. Create the `"friendlymeals"` Firestore Enterprise Database

1. Open [Firestore Database](https://console.firebase.google.com/project/_/firestore/databases) and click **Create database**.
2. Choose **Enterprise edition**.
3. Set the **Database ID** to **`friendlymeals`** (do not leave it as `(default)`, since `firebase.json` and `app/firebase/data.ts` target `"friendlymeals"`).
4. Pick a location (such as `nam5` in North America), keep default rules for now (you will deploy `firestore.rules` from the CLI in Part 2), and click **Create**.

### 4. Enable Authentication

1. Open [Authentication > Sign-in method](https://console.firebase.google.com/project/_/authentication/providers) (click **Get started** first if prompted).
2. Enable **Email/Password** and **Google** sign-in.

### 5. Set Spend Caps

1. Open [Google Cloud Billing Budgets & Alerts](https://console.cloud.google.com/billing) (or your project's billing settings) and set a **$5 budget / spend cap** so your project stays within your event credit grant.

### 6. Enable Firebase AI Logic and App Check

1. Open [Firebase AI Logic](https://console.firebase.google.com/project/_/ailogic) and enable the **Gemini Developer API** provider.
2. Open [App Check > Apps](https://console.firebase.google.com/project/_/appcheck/apps) and register your Web app with a [reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) site key.
3. In [App Check > APIs](https://console.firebase.google.com/project/_/appcheck/products), enforce App Check on **Firebase AI Logic** if desired, while leaving **Cloud Firestore** unenforced so unauthenticated [Cloud Run](https://cloud.google.com/run/docs) SSR loaders can read public recipes without a browser reCAPTCHA token.

---

## Part 2: Set Up Friendly Meals Locally

### 1. Fork and Clone the Repository

1. Open [github.com/FirebaseExtended/FriendlyMeals-web](https://github.com/FirebaseExtended/FriendlyMeals-web) and click **Fork** in the top right (making sure **Copy the `main` branch only** is unchecked if you want all workshop branches in your fork, or fetch the branch directly).
2. Clone your fork, check out `workshop/react-summit-2026`, and install dependencies:

   ```bash
   # Clone your fork of Friendly Meals
   git clone https://github.com/<YOUR_GITHUB_USERNAME>/FriendlyMeals-web.git

   # Navigate into the directory
   cd FriendlyMeals-web

   # Check out the workshop branch
   git checkout workshop/react-summit-2026

   # Install dependencies
   npm install
   ```

### 2. Deploy Firestore Rules and Print Your Web SDK Config

Install the [Firebase CLI](https://firebase.google.com/docs/cli), select your Firebase project, deploy `firestore.rules` and `firestore.indexes.json` to your `friendlymeals` database, and print your Web app configuration:

```bash
# Install the Firebase CLI
npm i -g firebase-tools

# Log in and select your Firebase project
firebase login
firebase use <YOUR_PROJECT_ID>

# Deploy Firestore security rules and indexes
firebase deploy --only firestore

# Print SDK config
firebase apps:sdkconfig WEB
```

### 3. Add Your Firebase Config and Start the Dev Server

1. Open `app/firebase/firebase-config.ts` and paste the JSON object printed by `firebase apps:sdkconfig WEB` into `firebaseConfig`:

   ```ts
   // Paste output of `firebase apps:sdkconfig WEB` here for local development
   const firebaseConfig: FirebaseOptions & Record<string, unknown> = {
     projectId: "your-project",
     appId: "1:12345:web:1234567",
     storageBucket: "<your-project>.firebasestorage.app",
     apiKey: "<your-public-api-key>",
     authDomain: "<your-auth-domain>.firebaseapp.com",
     messagingSenderId: "123456",
     projectNumber: "123456",
     version: "2",
   };
   ```

   Leave `app/firebase/firebase-config.ts` uncommitted in git (`{}`) if you plan to deploy from GitHub so [Firebase App Hosting](https://firebase.google.com/docs/app-hosting/firebase-sdks#initialize-with-no-arguments) uses zero-argument `initializeApp()` in production.

2. Start the [Vite](https://vite.dev/) + [React Router](https://reactrouter.com/) SSR dev server:

   ```bash
   npm run dev
   ```

### 4. Register Your Localhost App Check Debug Token

1. Open `http://localhost:5173` in Chrome and open **DevTools > Console**.
2. In development mode, `app/firebase/firebase.ts` automatically activates the [App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider) and logs `Firebase App Check debug token: <DEBUG_TOKEN>` (along with a ready-to-run CLI command).
3. In a second terminal inside `FriendlyMeals-web`, register that token with your Web app ID:

   ```bash
   firebase appcheck:debugtokens:create <DEBUG_TOKEN> --app <WEB_APP_ID>
   ```

### 5. Try It Out!

1. Click **Sign in** at `http://localhost:5173/login` and create an account with Email/Password or Google.
2. Back on `/recipes`, click **Seed 20 recipes** to populate starter recipes, ratings, and likes.
3. Try searching (`pasta`), filtering by tags (`Vegetarian`) and minimum rating, sorting by **Likes**, and toggling **My likes**.
4. Click **Generate** in the top navigation (`/generate`), type whatever ingredients are in your kitchen, pick a cuisine, click **Generate Recipe**, and click **Publish to Cookbook**.

---

## Part 3: How Does It Work?

### 1. Schema-Compliant Gemini Output (`app/firebase/firebaseAILogic.client.ts`)

FriendlyMeals calls Gemini directly from the browser using [Firebase AI Logic](https://firebase.google.com/docs/ai-logic) without maintaining a custom backend API route. Passing `responseMimeType: "application/json"` and a `Schema.object` [structured output schema](https://firebase.google.com/docs/ai-logic/generate-structured-output) guarantees that Gemini returns typed fields (`title`, `ingredients`, `instructions`, `tags`, `prepTime`, `cookTime`, `servings`):

```ts
const ai = getFirebaseAI();
const { model: modelName, systemInstruction } =
  await getRecipeGenerationSettings();

const model = getGenerativeModel(ai, {
  model: modelName,
  systemInstruction,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: recipeSchema,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  },
});

const result = await model.generateContent(prompt);
const parsed = JSON.parse(result.response.text());
```

`getRecipeGenerationSettings()` in `app/firebase/remoteConfig.client.ts` reads `recipe_model` and `recipe_system_prompt` from [Firebase Remote Config](https://firebase.google.com/docs/remote-config/get-started?platform=web) (with built-in fallback defaults), letting you swap Gemini models or tune prompts without redeploying the app.

### 2. Sorting, Filtering, and Text Search (`app/firebase/data.ts`)

Instead of fetching recipes and issuing `N + 1` follow-up reads for ratings and likes, `queryRecipes()` builds a single [Firestore Enterprise pipeline](https://firebase.google.com/docs/firestore/enterprise/pipelines) (`firebase/firestore/pipelines`) that computes review averages and like counts inline before applying search, tag, rating, and sort stages:

```ts
let pipeline = db
  .pipeline()
  .collection("recipes")
  .define(documentId(field("__name__")).as("parentRecipeId"))
  .addFields(
    subcollection("reviews")
      .aggregate(average("rating").as("avg"))
      .toScalarExpression()
      .coalesce(0)
      .as("averageRating"),
    db
      .pipeline()
      .collection("likes")
      .where(field("recipeId").equal(variable("parentRecipeId")))
      .aggregate(countAll().as("count"))
      .toScalarExpression()
      .coalesce(0)
      .as("likes")
  );

// ...after URL filter, sort & limit stages:
const { results } = await execute(pipeline);
```

Because FriendlyMeals uses the standard Firebase Web SDK (rather than `firebase-admin`) in SSR loaders, the exact same `queryRecipes()` function runs on Cloud Run and in the browser while honoring [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) (`firestore.rules`).

### 3. What Renders Where? (`loader`, `clientLoader`, and `clientLoader.hydrate`)

[React Router Framework Mode](https://reactrouter.com/) lets each route pick the rendering model that fits its data and authentication requirements:

| Primitive                     | When it runs                                | How FriendlyMeals uses it                                                                                                                                                                         |
| :---------------------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loader`                      | On the server (initial HTML request)        | Renders public HTML (and `.md`) on Cloud Run so crawlers, AI agents, and first-time visitors get complete responses cached on Cloud CDN.                                                          |
| `clientLoader`                | In the browser on client navigations        | Queries Firestore directly from the browser on follow-up clicks, skipping the server hop.                                                                                                         |
| `clientLoader.hydrate = true` | In the browser during initial hydration too | Layers browser-only IndexedDB [Firebase Authentication](https://firebase.google.com/docs/auth/web/start) state onto SSR pages (`?liked=1` and `isLiked`) or guards pure CSR routes (`/generate`). |

Each route in FriendlyMeals applies one of three patterns:

- **Viewing a recipe (`/recipes/:recipeId` and `/recipes/:recipeId.md`):**
  - `app/routes/recipe.$recipeId.tsx` renders HTML on the server via `loader` on first load, hydrates the signed-in user's heart button via `clientLoader.hydrate`, and fetches directly from Firestore in the browser on follow-up navigations.
  - `app/routes/recipe.$recipeId.md.ts` is a componentless React Router resource route returning raw `text/markdown; charset=utf-8` for AI agents and `curl` (try `curl http://localhost:5173/recipes/seed-apricot-cardamom-oat-crisp.md`).
- **Generating a recipe (`/generate` in `app/routes/generate.tsx`):**
  - Pure CSR. Firebase Auth stores tokens in browser IndexedDB and Firebase AI Logic requires browser App Check tokens, so `/generate` exports `clientLoader` (`clientLoader.hydrate = true`) + `HydrateFallback` to check `getUser()` in the browser and redirect signed-out visitors to `/login`.
- **Recipe list (`/recipes` in `app/routes/recipes.tsx`):**
  - Hydrated SSR. Cloud Run renders the public recipe list on first load; in the browser, `clientLoader` reuses `serverLoader()` unless `?liked=1` is active, in which case it queries the signed-in user's liked recipes directly. Search, tags, minimum rating, sort, and pagination live in URL query parameters via `<Form method="get">`, so `loader` and `clientLoader` share the exact same URL parser (`parseFiltersFromUrl`).

---

## Part 4: Hosting Friendly Meals & Edge Caching

### 1. Deploy to Firebase App Hosting

[Firebase App Hosting](https://firebase.google.com/docs/app-hosting) builds your SSR app with [Cloud Build](https://cloud.google.com/build/docs), runs the Node server on [Cloud Run](https://cloud.google.com/run/docs), and fronts it with [Cloud CDN](https://cloud.google.com/cdn/docs) (`apphosting.yaml`).

- **Option A: Connect GitHub in the Firebase Console (automatic deploy on `git push`)**
  1. Push any desired branch changes to your GitHub fork (leaving `app/firebase/firebase-config.ts` as `{}` in git).
  2. Open [App Hosting](https://console.firebase.google.com/project/_/apphosting), click **Get started**, connect your GitHub fork and branch (`workshop/react-summit-2026`), set the backend ID to `friendly-meals`, and **associate your Firebase Web app** so App Hosting injects `FIREBASE_WEBAPP_CONFIG` automatically.

- **Option B: Deploy from local source via the Firebase CLI**

  ```bash
  firebase apphosting:backends:create \
    --non-interactive \
    --backend friendly-meals \
    --primary-region us-central1 \
    --app <WEB_APP_ID> \
    --root-dir /

  firebase deploy --only apphosting
  ```

After your rollout finishes:

1. Add your `<BACKEND_ID>--<PROJECT_ID>.<REGION>.hosted.app` domain in [Authentication > Settings > Authorized domains](https://console.firebase.google.com/project/_/authentication/settings) so Google Sign-In works on the live URL.
2. If you enforce App Check on Firebase AI Logic in production, add your reCAPTCHA Enterprise site key to `apphosting.yaml` under `env` as `VITE_RECAPTCHA_SITE_KEY` (and add your `.hosted.app` domain to that key's allowed domains in Google Cloud Console).

### 2. Inspect Cloud CDN Caching (`app/routes/recipes.tsx`)

Compare regional Cloud Run latency against your nearest edge POP on [GCPing](https://gcping.com/). To cache public SSR pages at the Cloud CDN edge without caching 404 or 500 error responses, `app/routes/recipes.tsx` forwards `Cache-Control` from `loader` only when `errorHeaders` is absent:

```tsx
export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  if (errorHeaders) return {};
  const cacheControl = loaderHeaders.get("Cache-Control");
  return cacheControl ? { "Cache-Control": cacheControl } : {};
}

// Initial HTML request renders on Cloud Run (cached on Cloud CDN)
export async function loader({ request }: Route.LoaderArgs) {
  const payload = await loadRecipesCatalog(request);
  return data(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
```

Omitting `s-maxage` keeps `stale-while-revalidate` active on Cloud CDN. Open your deployed `.hosted.app/recipes` URL in **Chrome DevTools > Network > Headers** (or run two `GET` requests with `curl`) and reload within 60 seconds to see `cdn-cache-status: hit` and `age`:

```bash
curl -sD - -o /dev/null https://friendly-meals--<YOUR_PROJECT_ID>.us-central1.hosted.app/recipes \
  | grep -iE '^(HTTP/|cache-control:|cdn-cache-status:|age:)'
```

### 3. Production Hardening Checklist

1. **Firebase App Check + Spend Caps:** Keep Gemini calls inside `.client` modules (`app/firebase/firebaseAILogic.client.ts`), register localhost debug tokens during development, configure `VITE_RECAPTCHA_SITE_KEY` in `apphosting.yaml` for production, and set a $5 billing budget.
2. **Firebase Remote Config:** Publish `remoteconfig.template.json` (`firebase deploy --only remoteconfig`) so you can update `recipe_model` and `recipe_system_prompt` live in the [Remote Config Console](https://console.firebase.google.com/project/_/config) without redeploying.
3. **Error Reporting & Observability:** `app/entry.server.tsx` writes structured `severity: "ERROR"` JSON payloads with `httpRequest` metadata to [Cloud Logging](https://cloud.google.com/logging/docs) on Cloud Run, and client apps can pair `<HydratedRouter onError>` with [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics).

---

## Products and Documentation Referenced in This Workshop

| Category              | Product / Tool                                       | Documentation                                                                                                                                        |
| :-------------------- | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credits & Console** | Google Developer Program                             | [developers.google.com/program](https://developers.google.com/program)                                                                               |
|                       | React Summit US Event Credits                        | [g.dev/credits/react-summit-us-2026](https://g.dev/credits/react-summit-us-2026)                                                                     |
|                       | Firebase Console                                     | [console.firebase.google.com](https://console.firebase.google.com/)                                                                                  |
|                       | Firebase CLI (`firebase-tools`)                      | [firebase.google.com/docs/cli](https://firebase.google.com/docs/cli)                                                                                 |
| **AI & Config**       | Firebase AI Logic (`firebase/ai`)                    | [firebase.google.com/docs/ai-logic](https://firebase.google.com/docs/ai-logic)                                                                       |
|                       | Structured JSON Output (`Schema.object`)             | [firebase.google.com/docs/ai-logic/generate-structured-output](https://firebase.google.com/docs/ai-logic/generate-structured-output)                 |
|                       | Gemini API                                           | [ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)                                                                               |
|                       | Firebase Remote Config                               | [firebase.google.com/docs/remote-config/get-started?platform=web](https://firebase.google.com/docs/remote-config/get-started?platform=web)           |
| **Data & Auth**       | Cloud Firestore Enterprise Edition                   | [firebase.google.com/docs/firestore/enterprise/overview](https://firebase.google.com/docs/firestore/enterprise/overview)                             |
|                       | Firestore Pipelines (`firebase/firestore/pipelines`) | [firebase.google.com/docs/firestore/enterprise/pipelines](https://firebase.google.com/docs/firestore/enterprise/pipelines)                           |
|                       | Firestore Security Rules                             | [firebase.google.com/docs/firestore/security/get-started](https://firebase.google.com/docs/firestore/security/get-started)                           |
|                       | Firebase Authentication                              | [firebase.google.com/docs/auth/web/start](https://firebase.google.com/docs/auth/web/start)                                                           |
|                       | FirebaseUI (`@firebase-oss/ui-react`)                | [github.com/firebase/firebaseui-web](https://github.com/firebase/firebaseui-web)                                                                     |
| **Security & Ops**    | Firebase App Check                                   | [firebase.google.com/docs/app-check](https://firebase.google.com/docs/app-check)                                                                     |
|                       | App Check reCAPTCHA Enterprise Provider              | [firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) |
|                       | App Check Debug Provider                             | [firebase.google.com/docs/app-check/web/debug-provider](https://firebase.google.com/docs/app-check/web/debug-provider)                               |
|                       | Google Cloud Billing Budgets & Spend Caps            | [cloud.google.com/billing/docs/how-to/budgets](https://cloud.google.com/billing/docs/how-to/budgets)                                                 |
|                       | Cloud Logging                                        | [cloud.google.com/logging/docs](https://cloud.google.com/logging/docs)                                                                               |
|                       | Firebase Crashlytics                                 | [firebase.google.com/docs/crashlytics](https://firebase.google.com/docs/crashlytics)                                                                 |
| **Hosting & Edge**    | Firebase App Hosting                                 | [firebase.google.com/docs/app-hosting](https://firebase.google.com/docs/app-hosting)                                                                 |
|                       | App Hosting Zero-Arg SDK Init                        | [firebase.google.com/docs/app-hosting/firebase-sdks](https://firebase.google.com/docs/app-hosting/firebase-sdks#initialize-with-no-arguments)        |
|                       | Cloud Run                                            | [cloud.google.com/run/docs](https://cloud.google.com/run/docs)                                                                                       |
|                       | Cloud CDN                                            | [cloud.google.com/cdn/docs](https://cloud.google.com/cdn/docs)                                                                                       |
|                       | Cloud Build                                          | [cloud.google.com/build/docs](https://cloud.google.com/build/docs)                                                                                   |
|                       | Cloud Load Balancing                                 | [cloud.google.com/load-balancing/docs](https://cloud.google.com/load-balancing/docs)                                                                 |
|                       | Cloud DNS                                            | [cloud.google.com/dns/docs](https://cloud.google.com/dns/docs)                                                                                       |
|                       | Certificate Manager                                  | [cloud.google.com/certificate-manager/docs](https://cloud.google.com/certificate-manager/docs)                                                       |
|                       | Developer Connect                                    | [cloud.google.com/developer-connect/docs/overview](https://cloud.google.com/developer-connect/docs/overview)                                         |
|                       | Artifact Registry                                    | [cloud.google.com/artifact-registry/docs](https://cloud.google.com/artifact-registry/docs)                                                           |
|                       | Secret Manager                                       | [cloud.google.com/secret-manager/docs](https://cloud.google.com/secret-manager/docs)                                                                 |
|                       | GCPing (Regional Latency Tool)                       | [gcping.com](https://gcping.com/)                                                                                                                    |
| **Web Stack**         | React 19                                             | [react.dev](https://react.dev/)                                                                                                                      |
|                       | React Router (Framework Mode)                        | [reactrouter.com](https://reactrouter.com/)                                                                                                          |
|                       | Vite                                                 | [vite.dev](https://vite.dev/)                                                                                                                        |
