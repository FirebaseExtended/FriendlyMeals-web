import { useState } from "react";
import { href, redirect, useNavigate } from "react-router";
import { FirebaseUIProvider } from "@firebase-oss/ui-react";
import type { Route } from "./+types/login";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SignInAuthScreen } from "@/components/sign-in-auth-screen";
import { SignUpAuthScreen } from "@/components/sign-up-auth-screen";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getFirebaseUI, waitForAuthReady } from "@/firebase/auth";
import { isFirebaseConfigured } from "@/firebase/firebase-config";

export function meta() {
  return [
    { title: "Sign In - Friendly Meals" },
    {
      name: "description",
      content: "Sign in to generate, rate, and save recipes.",
    },
  ];
}

function getSafeRedirectPath(rawRedirect: string | null): string {
  if (!rawRedirect || !rawRedirect.startsWith("/") || rawRedirect.startsWith("//")) {
    return href("/generate");
  }
  return rawRedirect;
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = getSafeRedirectPath(url.searchParams.get("redirectTo"));

  if (isFirebaseConfigured) {
    const user = await waitForAuthReady();
    if (user) {
      throw redirect(redirectTo);
    }
  }

  return { redirectTo };
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        <span>Loading sign-in...</span>
      </div>
    </div>
  );
}

export default function LoginPage({ loaderData }: Route.ComponentProps) {
  const { redirectTo } = loaderData;
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const handleAuthenticated = () => {
    navigate(redirectTo, { replace: true });
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Firebase Setup Required</CardTitle>
            <CardDescription>
              Configure your Firebase web app before signing in.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Paste your web app config into{" "}
              <code className="font-mono text-foreground">
                app/firebase/firebase-config.ts
              </code>{" "}
              or add <code className="font-mono text-foreground">VITE_FIREBASE_*</code>{" "}
              variables to <code className="font-mono text-foreground">.env.local</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ui = getFirebaseUI();

  return (
    <div className="py-10 px-4">
      <FirebaseUIProvider ui={ui}>
        {mode === "signin" ? (
          <SignInAuthScreen
            onSignIn={handleAuthenticated}
            onSignUpClick={() => setMode("signup")}
          >
            <GoogleSignInButton onSignIn={handleAuthenticated} />
          </SignInAuthScreen>
        ) : (
          <SignUpAuthScreen
            onSignUp={handleAuthenticated}
            onSignInClick={() => setMode("signin")}
          >
            <GoogleSignInButton onSignIn={handleAuthenticated} />
          </SignUpAuthScreen>
        )}
      </FirebaseUIProvider>
    </div>
  );
}
