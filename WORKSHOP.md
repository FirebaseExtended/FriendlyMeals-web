# FriendlyMeals Hands-On Workshop Guide

Build, secure, and deploy **FriendlyMeals**, a server-rendered React 19 and React Router v8 recipe app backed by Firebase AI Logic, Firestore Enterprise pipelines, Firebase Authentication, App Check, Remote Config, Crashlytics, and Firebase App Hosting.

## Prerequisites

- **Node.js `>= 22`** and `npm` (`node -v`)
- **Git** and a GitHub account (optional if deploying App Hosting from the CLI)
- **Firebase CLI** (`npx firebase-tools@latest --version` or a global `firebase` install)
- A Google account to create a new Firebase project and redeem workshop credits

## Checkpoint Branches

Every hands-on step has a matching Git branch. If you fall behind or hit a typo, check out the branch for the step you want to start from:

| Branch              | Included state                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `workshop-start`    | Starter code with `// TODO(Exercise 1)` through `// TODO(Exercise 5)` stubs                                            |
| `workshop-1`        | Exercise 1 complete (Firebase AI Logic structured recipe generation)                                                   |
| `workshop-2`        | Exercises 1 and 2 complete (Firestore Enterprise pipeline query)                                                       |
| `workshop-3`        | Exercises 1 to 3 complete (Selective SSR, Cloud CDN headers, and `clientLoader`)                                       |
| `workshop-4`        | Exercises 1 to 4 complete (**Midpoint Break catch-up branch**: `getUser()` auth readiness and `/generate` route guard) |
| `workshop-solution` | All 5 exercises complete (adds Crashlytics for Web and SSR error flush)                                                |

> **Switching branches with local `firebaseConfig`:** Leave `app/firebase/firebase-config.ts` uncommitted (`{}` in git). Every workshop branch commits the same `app/firebase/firebase-config.ts` file, so `git checkout workshop-<N>` carries your local `firebaseConfig` forward without overwriting it. If you started editing an exercise file and want to jump cleanly to a checkpoint branch, reset your exercise edits first:
>
> ```bash
> git checkout -- app/routes app/firebase/firebaseAILogic.client.ts app/firebase/data.ts app/firebase/auth.ts app/firebase/crashlytics.ts
> git checkout workshop-4
> ```

## Part 1: Project Setup (Console + CLI)

1. **Clone the repository and start on `workshop-start`**

   Fork this repository on GitHub (so you can connect Firebase App Hosting at the midpoint break), clone your fork, and install packages:

   ```bash
   git checkout workshop-start
   npm install
   ```

2. **Create a Firebase project and attach billing**

   - Open the [Firebase Console](https://console.firebase.google.com/) and create a new project.
   - Redeem your workshop credits or [upgrade the project to the Blaze pay-as-you-go plan](https://console.firebase.google.com/project/_/overview?purchaseBillingPlan=metered). Firestore Enterprise and Firebase App Hosting both require Blaze billing.

3. **Enable Authentication sign-in providers**

   - Open [Authentication > Sign-in method](https://console.firebase.google.com/project/_/authentication/providers) (click **Get started** first if prompted).
   - Enable **Email/Password** and **Google** sign-in. Turning both on now lets you sign in right away for Exercise 1 and seed sample recipes in Exercise 2.

4. **Select your project and configure `app/firebase/firebase-config.ts`**

   Log in to the Firebase CLI, select your project, and register a Web app:

   ```bash
   firebase login
   firebase use <YOUR_PROJECT_ID>
   firebase apps:create WEB friendlymeals
   firebase apps:sdkconfig WEB
   ```

   Paste the `firebaseConfig` object fields into `app/firebase/firebase-config.ts` (you can also copy them from [Project settings](https://console.firebase.google.com/project/_/settings/general/)). Keep `app/firebase/firebase-config.ts` uncommitted in git so Firebase App Hosting uses zero-argument `initializeApp()` in production.

5. **Create the Firestore Enterprise database, deploy rules and indexes, and start the dev server**

   FriendlyMeals uses a named Firestore Enterprise database (`friendlymeals`, configured in `firebase.json` and `app/firebase/data.ts`):

   ```bash
   firebase firestore:databases:create friendlymeals \
     --location=nam5 \
     --edition=enterprise

   firebase deploy --only firestore
   npm run dev
   ```

   Open `http://localhost:5173`. You should see the FriendlyMeals navigation bar and the empty cookbook state at `/recipes`.

## Exercise 1: Structured Recipe Generation with Firebase AI Logic

**Goal:** Call Gemini directly from the browser with `firebase/ai` and `Schema.object` to generate structured JSON recipes without a custom backend proxy.

1. **Enable Firebase AI Logic in the CLI**

   In a second terminal, enable the Gemini Developer API provider and turn on AI monitoring:

   ```bash
   firebase ailogic:providers:enable gemini-developer-api
   firebase ailogic:config:set monitoring.state true --force
   ```

   _(Wait until Part 2 to set `security.auth-only true`.)_

2. **Implement `generateStructuredJsonRecipe` in `app/firebase/firebaseAILogic.client.ts`**

   Open `app/firebase/firebaseAILogic.client.ts` and find `// TODO(Exercise 1)`. Notice that `recipeSchema` (`Schema.object`) and `normalizeRecipeResponse` are already defined in the file. Replace the `TODO` stub inside `generateStructuredJsonRecipe` to:

   - Call `getFirebaseAI()` and `await getRecipeGenerationSettings()` to get `{ model: modelName, systemInstruction }` (backed by Remote Config defaults).
   - Create `model` with `getGenerativeModel(ai, { model: modelName, systemInstruction, generationConfig })`, passing `responseMimeType: "application/json"`, `responseSchema: recipeSchema`, `maxOutputTokens: 8192`, and `thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }`.
   - Call `await model.generateContent(prompt)`, throw if `finishReason` is present and not `FinishReason.STOP`, parse `result.response.text()` with `JSON.parse`, and return `normalizeRecipeResponse(parsed)`.

   <details>
   <summary>Solution: <code>app/firebase/firebaseAILogic.client.ts</code></summary>

   ```ts
   export async function generateStructuredJsonRecipe(
     ingredients: string,
     cuisineType: string
   ): Promise<NewRecipeInput> {
     const cuisineClause = cuisineType ? ` in the ${cuisineType} cuisine` : "";
     const prompt = `Using the following list of ingredients, create a recipe${cuisineClause}: ${ingredients}.`;

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
     const finishReason = result.response.candidates?.[0]?.finishReason;
     if (finishReason && finishReason !== FinishReason.STOP) {
       throw new Error(`Recipe generation incomplete (${finishReason}).`);
     }
     const parsed = JSON.parse(
       result.response.text()
     ) as Partial<NewRecipeInput>;

     return normalizeRecipeResponse(parsed);
   }
   ```

   </details>

3. **Checkpoint**

   - Open `http://localhost:5173/login` and sign in with Google or create an Email/Password account.
   - On `/generate`, enter a few ingredients (for example, `chickpeas, lemon, garlic, spinach`) and click **Generate Recipe**.
   - Verify Gemini renders a structured recipe draft in the preview card. Hold off on clicking **Publish to Cookbook** until you seed the 20 starter recipes in Exercise 2 (so the empty-state **Seed 20 recipes** button remains visible on `/recipes`).

## Exercise 2: Firestore Enterprise Pipeline Query

**Goal:** Write one `firebase/firestore/pipelines` query that joins review averages and like counts onto each recipe in a single round-trip, shared between Node SSR `loader`s and browser `clientLoader`s under Firestore Security Rules.

1. **Implement `queryRecipes` in `app/firebase/data.ts`**

   Open `app/firebase/data.ts` and find `// TODO(Exercise 2)` inside `queryRecipes`. `applyRecipeFiltersAndSort` (URL search, tag, rating, liked-by-user, sort, and `limit + 1` stages) and the `rows` / `hasMore` return mapping are already prebuilt. Replace the `TODO` placeholder to:

   - Start `let pipeline = db.pipeline().collection("recipes").define(documentId(field("__name__")).as("parentRecipeId"))`.
   - Chain `.addFields(...)` with two scalar subqueries:
     - `subcollection("reviews").aggregate(average("rating").as("avg")).toScalarExpression().coalesce(0).as("averageRating")`
     - `db.pipeline().collection("likes").where(field("recipeId").equal(variable("parentRecipeId"))).aggregate(countAll().as("count")).toScalarExpression().coalesce(0).as("likes")`
   - Apply filters and sorting with `pipeline = applyRecipeFiltersAndSort(pipeline, filters, effectiveLimit)`.
   - Run `const { results } = await execute(pipeline)`.

   <details>
   <summary>Solution: <code>app/firebase/data.ts</code></summary>

   ```ts
   export async function queryRecipes(
     filters: RecipeFilters
   ): Promise<RecipesQueryResult> {
     const effectiveLimit = Math.min(
       MAX_RECIPES_LIMIT,
       Math.max(1, Math.floor(filters.limit ?? DEFAULT_RECIPES_LIMIT))
     );

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

     pipeline = applyRecipeFiltersAndSort(pipeline, filters, effectiveLimit);

     const { results } = await execute(pipeline);

     const rows = results.flatMap((result) =>
       result.id ? [toPlainRecipe(result.id, result.data())] : []
     );
     const hasMore = rows.length > effectiveLimit;
     return {
       recipes: hasMore ? rows.slice(0, effectiveLimit) : rows,
       hasMore,
     };
   }
   ```

   </details>

2. **Checkpoint**

   - Open `http://localhost:5173/recipes` while signed in and click **Seed 20 recipes**. _(If you already published a test recipe in Exercise 1, open that recipe and click **Delete** first so the empty-state **Seed 20 recipes** button appears.)_
   - Confirm 20 starter recipes render with computed star ratings, like counts, and top category tags in the filter panel.

## Exercise 3: Selective SSR, Cloud CDN Headers, and `clientLoader`

**Goal:** Server-render initial `/recipes` HTML with Cloud CDN `Cache-Control` headers, never cache error responses, reuse `serverLoader()` in memory on public hydration, and run follow-up searches and `?liked=1` filters directly from the browser against Firestore.

1. **Update `app/routes/recipes.tsx`**

   Open `app/routes/recipes.tsx` and complete the three `// TODO(Exercise 3)` sections:

   - Define `PUBLIC_RECIPES_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"`. Omit `s-maxage`, because Cloud CDN applies RFC 9111 `proxy-revalidate` semantics when `s-maxage` is present and disables `stale-while-revalidate`.
   - Export `headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs)`. Return `{}` when `errorHeaders` is defined so 404 and 500 responses never inherit public caching, and forward `loaderHeaders.get("Cache-Control")` otherwise.
   - Update `loader` to return `data(payload, { headers: { "Cache-Control": PUBLIC_RECIPES_CACHE_CONTROL } })`.
   - Export `clientLoader({ request, serverLoader }: Route.ClientLoaderArgs)` with `clientLoader.hydrate = true as const`. Track `let isInitialRecipesRequest = true` so initial public loads return `serverLoader()` from embedded SSR data without a duplicate Firestore read, `?liked=1` resolves via `await getUser()`, and subsequent browser navigations run `loadRecipesCatalog(request)` directly in the browser.

   <details>
   <summary>Solution: <code>app/routes/recipes.tsx</code></summary>

   ```ts
   // Omit `s-maxage` so Firebase App Hosting's Cloud CDN honors `stale-while-revalidate`
   const PUBLIC_RECIPES_CACHE_CONTROL =
     "public, max-age=60, stale-while-revalidate=300";

   export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
     if (errorHeaders) {
       return {};
     }
     const cacheControl = loaderHeaders.get("Cache-Control");
     return cacheControl ? { "Cache-Control": cacheControl } : {};
   }

   export function meta() {
     return [
       { title: "All Recipes - Friendly Meals" },
       { name: "description", content: "Browse community recipes" },
     ];
   }

   async function loadRecipesCatalog(request: Request, likedByUserId?: string) {
     const filters = parseFiltersFromUrl(request.url, likedByUserId);
     const [{ recipes, hasMore }, topTags] = await Promise.all([
       queryRecipes(filters),
       getTop5Tags(),
     ]);
     return { recipes, hasMore, topTags };
   }

   // Initial HTML request renders on Cloud Run so search engines and agents get full HTML
   export async function loader({ request }: Route.LoaderArgs) {
     const payload = await loadRecipesCatalog(request);
     return data(payload, {
       headers: { "Cache-Control": PUBLIC_RECIPES_CACHE_CONTROL },
     });
   }

   let isInitialRecipesRequest = true;

   // Hydrates `?liked=1` from IndexedDB auth and runs subsequent navigations directly in the browser
   export async function clientLoader({
     request,
     serverLoader,
   }: Route.ClientLoaderArgs) {
     const wasInitial = isInitialRecipesRequest;
     isInitialRecipesRequest = false;
     const url = new URL(request.url);

     if (isLikedFilterEnabled(url.searchParams.get("liked"))) {
       const user = await getUser();
       if (!user) {
         url.searchParams.delete("liked");
         url.searchParams.delete("limit");
         const fallbackQs = url.searchParams.toString();
         throw redirect(
           fallbackQs ? `${href("/recipes")}?${fallbackQs}` : href("/recipes")
         );
       }
       return loadRecipesCatalog(request, user.uid);
     }

     if (wasInitial) {
       return serverLoader();
     }
     return loadRecipesCatalog(request);
   }
   clientLoader.hydrate = true as const;
   ```

   </details>

2. **Checkpoint**

   - Hard-refresh `http://localhost:5173/recipes`, open DevTools > **Network**, and inspect the `/recipes` document response: confirm full recipe HTML arrived from SSR with `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
   - Click tag filters and sort options on `/recipes` while watching **Network**: confirm follow-up filter updates query Firestore directly in the browser without hitting the Node server for HTML or `.data` loader payloads.
   - Check the Markdown resource route (`app/routes/recipe.$recipeId.md.ts`) in your terminal or browser:

     ```bash
     curl -i http://localhost:5173/recipes/seed-apricot-cardamom-oat-crisp.md
     ```

     Confirm it returns `Content-Type: text/markdown; charset=utf-8` with `Cache-Control: public, max-age=60, stale-while-revalidate=300`.

## Exercise 4: Browser Auth Readiness and Client Route Guard

**Goal:** Wait for browser IndexedDB session restoration with `auth.authStateReady()` inside `getUser()` and guard `/generate` with `clientLoader` (`clientLoader.hydrate = true`).

1. **Await `auth.authStateReady()` in `app/firebase/auth.ts`**

   Firebase Auth stores credentials in browser IndexedDB rather than cookies, so `auth.currentUser` is `null` during the first milliseconds of a cold page load even when a user is signed in. Open `app/firebase/auth.ts`, find `// TODO(Exercise 4)` inside `getUser()`, await `auth.authStateReady()`, and return `auth.currentUser`.

2. **Guard `/generate` in `app/routes/generate.tsx`**

   Open `app/routes/generate.tsx` and find `// TODO(Exercise 4)` inside `clientLoader` (`clientLoader.hydrate = true as const` and `HydrateFallback` are already defined below it). Call `const user = await getUser()`; when `!user`, compute `redirectTo` from `new URL(request.url)` and `throw redirect(\`${href("/login")}?redirectTo=${encodeURIComponent(redirectTo)}\`)`before returning`null`.

   <details>
   <summary>Solution: <code>app/firebase/auth.ts</code> and <code>app/routes/generate.tsx</code></summary>

   In `app/firebase/auth.ts`:

   ```ts
   export async function getUser(): Promise<FirebaseUser | null> {
     const auth = getAuth(firebaseApp);
     await auth.authStateReady();
     return auth.currentUser;
   }
   ```

   In `app/routes/generate.tsx`:

   ```ts
   export async function clientLoader({ request }: Route.ClientLoaderArgs) {
     const user = await getUser();
     if (!user) {
       const url = new URL(request.url);
       const redirectTo = `${url.pathname}${url.search}`;
       throw redirect(
         `${href("/login")}?redirectTo=${encodeURIComponent(redirectTo)}`
       );
     }
     return null;
   }
   clientLoader.hydrate = true as const;
   ```

   </details>

3. **Checkpoint**

   - Open `http://localhost:5173/logout` to sign out, then visit `http://localhost:5173/generate`: confirm `clientLoader` redirects you immediately to `/login?redirectTo=%2Fgenerate`.
   - Sign back in and confirm the app sends you straight to `/generate`. Hard-refresh `http://localhost:5173/generate` to verify `getUser()` waits for `auth.authStateReady()` without falsely redirecting a signed-in session, then publish a generated recipe to `/recipes/<id>`.

## Midpoint Break and Firebase App Hosting Setup

If you want to sync up with the room before deploying, check out `workshop-4` (`git checkout workshop-4`). Start your first App Hosting rollout right before the 10-minute break so Cloud Build finishes while you step away.

> **Before pushing or deploying:** Run `git status` and confirm `app/firebase/firebase-config.ts` is **not** staged (`const firebaseConfig = {};` stays committed in git so App Hosting uses automatic initialization via `FIREBASE_WEBAPP_CONFIG`).

### Option A: Connect your GitHub fork in the Firebase Console

1. Commit your Exercise 1 to 4 changes (excluding `app/firebase/firebase-config.ts`) and push your branch to your GitHub fork.
2. Open [App Hosting](https://console.firebase.google.com/project/_/apphosting) and click **Get started**.
3. Connect your forked GitHub repository, select your active branch, set the backend ID to `friendly-meals` (matching `firebase.json`), and **associate your Firebase Web app** with the backend so App Hosting injects `FIREBASE_WEBAPP_CONFIG`.

### Option B: Deploy from local source via the Firebase CLI

If you prefer not to connect GitHub, find your Web App ID (`1:...`) with `firebase apps:list WEB`, then create the backend and deploy from local source:

```bash
firebase apphosting:backends:create \
  --non-interactive \
  --backend friendly-meals \
  --primary-region us-central1 \
  --app <YOUR_FIREBASE_WEB_APP_ID> \
  -s firebase-app-hosting-compute@<YOUR_PROJECT_ID>.iam.gserviceaccount.com \
  --root-dir /

firebase deploy --only apphosting
```

### Authorize your live domain and verify Cloud CDN

1. Once the backend rollout finishes, copy its `<BACKEND_ID>--<PROJECT_ID>.<REGION>.hosted.app` hostname and add it under [Authentication > Settings > Authorized domains](https://console.firebase.google.com/project/_/authentication/settings) so Google Sign-In works on your live URL.
2. Inspect Cloud CDN headers on your deployed `/recipes` page:

   ```bash
   curl -I https://friendly-meals--<YOUR_PROJECT_ID>.us-central1.hosted.app/recipes
   ```

   Run `curl -I` twice in a row: verify `cache-control: public, max-age=60, stale-while-revalidate=300` and watch `cdn-cache-status` change from `miss` to `hit` (and `stale` after 60 seconds while Cloud CDN refreshes in the background).

## Part 2: Production Hardening and Exercise 5

### 1. Restrict Firebase AI Logic with Auth, App Check, and budget alerts

1. Require a signed-in Firebase Auth user on every Gemini call:

   ```bash
   firebase ailogic:config:set security.auth-only true --force
   ```

2. Register App Check with reCAPTCHA Enterprise:
   - Open [App Check > Apps](https://console.firebase.google.com/project/_/appcheck/apps) and register your Web app using **reCAPTCHA Enterprise**.
   - Open your Web app's overflow menu in App Check > **Manage debug tokens**, create a debug token for `localhost`, and add both keys to `.env.local` (gitignored) in the repository root:

     ```ini
     VITE_RECAPTCHA_SITE_KEY=<YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY>
     VITE_APPCHECK_DEBUG_TOKEN=<YOUR_LOCALHOST_DEBUG_TOKEN>
     ```

     Restart `npm run dev` so Vite loads `.env.local`. For production on App Hosting, add `VITE_RECAPTCHA_SITE_KEY` under `env:` in `apphosting.yaml`.

   - Open [App Check > APIs](https://console.firebase.google.com/project/_/appcheck/products) and enforce App Check on **Firebase AI Logic** only. Leave **Cloud Firestore** unenforced so unauthenticated Cloud Run SSR `loader`s can read public recipes without a browser reCAPTCHA token.
3. Open [Google Cloud Billing > Budgets & alerts](https://console.cloud.google.com/billing) and set a \$5 budget alert on your workshop project.

### 2. Publish Remote Config parameters

Deploy `remoteconfig.template.json` (`recipe_model` and `recipe_system_prompt`):

```bash
firebase deploy --only remoteconfig
```

_(If you are reusing a project that already has Remote Config keys, run `firebase remoteconfig:get` first and merge existing parameters before deploying.)_

Open [Remote Config](https://console.firebase.google.com/project/_/config) to update `recipe_model` or `recipe_system_prompt` live without redeploying the app, or pull remote edits back locally with `firebase remoteconfig:get -o remoteconfig.template.json`.

### 3. Exercise 5: Crashlytics for Web and SSR Error Flush

**Goal:** Report unhandled browser errors (`<HydratedRouter onError>`) and Node SSR errors (`entry.server.tsx handleError`) to Firebase Crashlytics, flushing SSR telemetry before Cloud Run throttles CPU at response end.

1. **Initialize Crashlytics in the Console**

   Open [Crashlytics](https://console.firebase.google.com/project/_/crashlytics), select your Web app to initialize crash reporting, and verify the [Firebase Telemetry API](https://console.developers.google.com/apis/api/firebasetelemetry.googleapis.com/overview) and [Firebase Telemetry Admin API](https://console.developers.google.com/apis/api/firebasetelemetryadmin.googleapis.com/overview) are enabled on your project.

2. **Implement `app/firebase/crashlytics.ts`**

   Open `app/firebase/crashlytics.ts` and complete the three `// TODO(Exercise 5)` blocks:

   - In `initBrowserCrashlytics()`, initialize `clientCrashlytics` once with `getCrashlytics(firebaseApp, { features: [breadcrumbs()] })` and return it.
   - In `reportClientError()`, call `initBrowserCrashlytics()` and pass `enrichedAttributes` to `recordError(crashlytics, error, enrichedAttributes)` when initialized.
   - In `reportServerError()`, inside a `try / catch` block, initialize `serverCrashlytics` once with `getCrashlytics(firebaseApp)`, call `recordError(serverCrashlytics, error, { runtime: "ssr", method: request.method, url: request.url })`, and call `void flush(serverCrashlytics).catch(() => {})`.

   <details>
   <summary>Solution: <code>app/firebase/crashlytics.ts</code></summary>

   ```ts
   export function initBrowserCrashlytics(): Crashlytics | null {
     if (typeof window === "undefined" || !canUseCrashlytics()) {
       return null;
     }
     if (!clientCrashlytics) {
       clientCrashlytics = getCrashlytics(firebaseApp, {
         features: [breadcrumbs()],
       });
     }
     return clientCrashlytics;
   }

   export function reportClientError(
     error: unknown,
     attributes?: Record<string, string>
   ): void {
     const ownerStack = import.meta.env.DEV ? captureOwnerStack() : null;
     const enrichedAttributes = ownerStack
       ? { ...attributes, ownerStack }
       : attributes;
     console.error("[Client Error]", error);
     const crashlytics = initBrowserCrashlytics();
     if (crashlytics) {
       recordError(crashlytics, error, enrichedAttributes);
     }
   }

   export function reportServerError(error: unknown, request: Request): void {
     const message = error instanceof Error ? error.message : String(error);
     const stack = error instanceof Error ? error.stack : undefined;

     // Emit structured JSON so Cloud Run / Cloud Logging indexes severity and request metadata
     console.error(
       JSON.stringify({
         severity: "ERROR",
         message,
         stack,
         httpRequest: {
           requestMethod: request.method,
           requestUrl: request.url,
         },
       })
     );

     if (!canUseCrashlytics()) {
       return;
     }

     try {
       if (!serverCrashlytics) {
         serverCrashlytics = getCrashlytics(firebaseApp);
       }
       recordError(serverCrashlytics, error, {
         runtime: "ssr",
         method: request.method,
         url: request.url,
       });
       // Flush immediately so Cloud Run request-scoped CPU throttling does not stall OTLP batches
       void flush(serverCrashlytics).catch(() => {});
     } catch {
       // Never fail an SSR request if telemetry reporting encounters an error
     }
   }
   ```

   </details>

### 4. Final Deploy, Hidden Sourcemaps, and Project Cleanup

1. **Deploy rules, indexes, and App Hosting, then upload hidden sourcemaps**

   Vite builds hidden sourcemaps (`sourcemap: "hidden"` in `vite.config.ts`) so source code is not exposed publicly while Crashlytics can still deobfuscate client and SSR stack traces:

   ```bash
   firebase deploy --only firestore,apphosting

   npm run build
   npm run upload:sourcemaps -- --app <YOUR_FIREBASE_WEB_APP_ID>
   ```

   _(Sourcemap uploads stay separate from `npm run build` so Cloud Build on App Hosting requires no extra upload credentials.)_

2. **Inspect telemetry and clean up when finished**

   - Check [Crashlytics](https://console.firebase.google.com/project/_/crashlytics) for deobfuscated browser and SSR stack traces, and [Cloud Logging](https://console.cloud.google.com/logs/query) for structured `severity="ERROR"` SSR logs.
   - When you finish experimenting after the workshop, open [Project settings](https://console.firebase.google.com/project/_/settings/general/) and click **Delete project** at the bottom of the page to shut down all billed resources.
