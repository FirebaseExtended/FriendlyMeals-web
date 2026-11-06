import { useRef } from "react";
import type { User } from "firebase/auth";
import { getTranslation } from "@firebase-oss/ui-core";
import {
  useOnUserAuthenticated,
  useUI,
  type SignUpAuthScreenProps,
} from "@firebase-oss/ui-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SignUpAuthForm } from "@/components/sign-up-auth-form";

export type { SignUpAuthScreenProps };

export function SignUpAuthScreen({
  children,
  onSignUp,
  onSignInClick,
  ...props
}: SignUpAuthScreenProps) {
  const ui = useUI();
  const handledUserIdRef = useRef<string | null>(null);

  const titleText = getTranslation(ui, "labels", "signUp");
  const subtitleText = getTranslation(ui, "prompts", "enterDetailsToCreate");

  const handleSignUp = (user: User) => {
    if (handledUserIdRef.current === user.uid) {
      return;
    }
    handledUserIdRef.current = user.uid;
    onSignUp?.(user);
  };

  useOnUserAuthenticated(children ? handleSignUp : undefined);

  return (
    <div className="max-w-sm mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle>{titleText}</CardTitle>
          <CardDescription>{subtitleText}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpAuthForm
            {...props}
            onSignInClick={children ? undefined : onSignInClick}
            onSignUp={(credential) => {
              handleSignUp(credential.user);
            }}
          />
          {children ? (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">{children}</div>
              {onSignInClick ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={onSignInClick}
                  className="mt-2 w-full"
                >
                  <span className="text-xs">
                    {getTranslation(ui, "prompts", "haveAccount")}{" "}
                    {getTranslation(ui, "labels", "signIn")}
                  </span>
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
