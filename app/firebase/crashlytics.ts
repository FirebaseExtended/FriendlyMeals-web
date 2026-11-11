import { captureOwnerStack } from "react";
import {
  breadcrumbs,
  flush,
  getCrashlytics,
  recordError,
  type Crashlytics,
} from "firebase/crashlytics";
import { firebaseApp } from "./firebase";

let clientCrashlytics: Crashlytics | null = null;
let serverCrashlytics: Crashlytics | null = null;

function canUseCrashlytics(): boolean {
  return Boolean(firebaseApp.options.appId);
}

export function initBrowserCrashlytics(): Crashlytics | null {
  if (typeof window === "undefined" || !canUseCrashlytics()) {
    return null;
  }
  // TODO(Exercise 5): Initialize `clientCrashlytics` once with
  // `getCrashlytics(firebaseApp, { features: [breadcrumbs()] })` and return it.
  void [breadcrumbs, clientCrashlytics, getCrashlytics];
  return null;
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
  // TODO(Exercise 5): Call `initBrowserCrashlytics()` and record the error with
  // `recordError(crashlytics, error, enrichedAttributes)` when initialized.
  void [enrichedAttributes, recordError];
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

  // TODO(Exercise 5): Record the SSR error with `getCrashlytics(firebaseApp)`,
  // `{ runtime: "ssr", method: request.method, url: request.url }` attributes,
  // and call `void flush(serverCrashlytics).catch(() => {})` inside a try/catch block.
  void [flush, serverCrashlytics];
}
