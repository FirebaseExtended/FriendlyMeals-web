# FriendlyMeals Agent Guide (`AGENTS.md`)

FriendlyMeals is a React 19 + React Router v8 (Framework Mode with selective SSR) recipe application backed by Firebase AI Logic, Firestore Enterprise pipelines, Firebase Authentication (`@firebase-oss/ui-shadcn`), App Check, Remote Config, Crashlytics, and Firebase App Hosting.

## Installed Agent Skills

Before editing Firebase or React Router code, consult the matching skill under `.agents/skills/`:

- `.agents/skills/react-router/SKILL.md`: React Router v8 Framework Mode (`loader`, `clientLoader`, `clientAction`, `clientMiddleware`, resource routes, `headers`, `HydratedRouter`).
- `.agents/skills/firebase-ai-logic-basics/SKILL.md`: Calling Gemini models from the browser with `firebase/ai` and `Schema.object`.
- `.agents/skills/firebase-firestore/SKILL.md`: Firestore Enterprise provisioning, indexes, and `firebase/firestore/pipelines` queries (`references/enterprise/web_sdk_usage.md`).
- `.agents/skills/firestore-rules-creation/SKILL.md`: Authoring schema-validated Firestore Security Rules (`firestore.rules`).
- `.agents/skills/firebase-auth-basics/SKILL.md`: Client-side Firebase Authentication and UID-scoped Security Rules.
- `.agents/skills/firebase-remote-config-basics/SKILL.md`: Managing Remote Config parameters (`recipe_system_prompt`, `recipe_model`).
- `.agents/skills/firebase-crashlytics/SKILL.md`: Reporting client and SSR errors (`flush` on Cloud Run) and uploading hidden sourcemaps.
- `.agents/skills/firebase-app-hosting-basics/SKILL.md`: Deploying SSR apps to Cloud Run + Cloud CDN via Firebase App Hosting (`apphosting.yaml` and `firebase.json`).

## Architectural Invariants

1. **Selective SSR, "Skip the Server Hop", and Safe CDN Caching**:
   - Public routes (`/recipes` and `/recipes/:recipeId`) export both `loader` (server-rendered initial HTML + `Cache-Control` response headers) and `clientLoader` (subsequent browser navigations and post-`clientAction` revalidations query Firestore directly without hitting Cloud Run).
   - `headers()` on public routes checks `if (errorHeaders) return {};` so 404 and 500 responses are never publicly cached by Cloud CDN.
   - `/recipes/:recipeId.md` (`app/routes/recipe.$recipeId.md.ts`) is a componentless resource route returning raw `text/markdown; charset=utf-8`. Link to it with `<Link reloadDocument>`.
2. **Client-Side Auth Guards (IndexedDB, Not Cookies)**:
   - Firebase Auth stores tokens in browser IndexedDB, so Node SSR loaders cannot read `auth.currentUser`.
   - Protected routes (`/generate`) sit behind `app/routes/_protected.tsx`, which guards access on the client via `clientMiddleware`, `clientLoader`, and `HydrateFallback`.
   - Mutations on `/recipes/:recipeId` (likes, ratings, deletes) run through `clientAction` + `useFetcher` so browser Auth tokens attach automatically and `clientLoader` revalidates Firestore aggregates.
3. **Firebase Initialization & Browser-Safe Services**:
   - `app/firebase/firebase-config.ts` uses `firebaseConfig` when pasted (`firebase apps:sdkconfig WEB`), and falls back to zero-argument `initializeApp()` for automatic initialization on Firebase App Hosting.
   - Guard browser-only SDKs (`initializeAppCheck`, `getRemoteConfig`, `getAuth`, `initializeUI`) behind `typeof window !== "undefined"` so importing `app/firebase/*` during Node SSR never accesses `window`, `self`, or IndexedDB.
   - Enforce App Check on Firebase AI Logic (browser-only), not on Firestore (which is queried by unauthenticated Node SSR `loader`s).
   - Keep sourcemap uploads (`npm run upload:sourcemaps`) out of `npm run build` so Cloud Build succeeds in Firebase App Hosting.

## Commands

```bash
npm run dev                 # Start Vite + React Router SSR dev server
npm run typecheck           # Run react-router typegen && tsc
npm run lint                # Run ESLint
npm run build               # Build client assets (hidden sourcemaps) + SSR server bundle
npm run start               # Serve production SSR build locally
```
