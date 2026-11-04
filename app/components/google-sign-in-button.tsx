import { GoogleAuthProvider } from "firebase/auth";
import { getTranslation } from "@firebase-oss/ui-core";
import {
  GoogleLogo,
  useUI,
  type GoogleSignInButtonProps,
} from "@firebase-oss/ui-react";
import { OAuthButton } from "@/components/oauth-button";

export type { GoogleSignInButtonProps };

const defaultGoogleProvider = new GoogleAuthProvider();

export function GoogleSignInButton({
  provider,
  ...props
}: GoogleSignInButtonProps) {
  const ui = useUI();

  return (
    <OAuthButton {...props} provider={provider ?? defaultGoogleProvider}>
      <GoogleLogo />
      <span>{getTranslation(ui, "labels", "signInWithGoogle")}</span>
    </OAuthButton>
  );
}
