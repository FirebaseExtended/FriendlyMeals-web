import { getTranslation } from "@firebase-oss/ui-core";
import {
  useOnUserAuthenticated,
  useUI,
  type SignInAuthScreenProps,
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
import { SignInAuthForm } from "@/components/sign-in-auth-form";

export type { SignInAuthScreenProps };

export function SignInAuthScreen({
  children,
  onSignIn,
  onSignUpClick,
  ...props
}: SignInAuthScreenProps) {
  const ui = useUI();

  const titleText = getTranslation(ui, "labels", "signIn");
  const subtitleText = getTranslation(ui, "prompts", "signInToAccount");

  useOnUserAuthenticated(onSignIn);

  return (
    <div className="max-w-sm mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle>{titleText}</CardTitle>
          <CardDescription>{subtitleText}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInAuthForm
            {...props}
            onSignUpClick={children ? undefined : onSignUpClick}
          />
          {children ? (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">{children}</div>
              {onSignUpClick ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={onSignUpClick}
                  className="mt-2 w-full"
                >
                  <span className="text-xs">
                    {getTranslation(ui, "prompts", "noAccount")}{" "}
                    {getTranslation(ui, "labels", "signUp")}
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
