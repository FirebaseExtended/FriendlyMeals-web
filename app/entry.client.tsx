import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { isRouteErrorResponse } from "react-router";
import { HydratedRouter } from "react-router/dom";
import {
  initBrowserCrashlytics,
  reportClientError,
} from "@/firebase/crashlytics";

initBrowserCrashlytics();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter
        useTransitions
        onError={(error, { location, errorInfo }) => {
          if (isRouteErrorResponse(error)) {
            return;
          }
          reportClientError(error, {
            path: location.pathname,
            ...(errorInfo?.componentStack
              ? { componentStack: errorInfo.componentStack }
              : {}),
          });
        }}
      />
    </StrictMode>
  );
});
