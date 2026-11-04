import {
  useSignInWithProvider,
  useUI,
  type OAuthButtonProps,
} from "@firebase-oss/ui-react";
import { Button } from "@/components/ui/button";

export type { OAuthButtonProps };

export function OAuthButton({
  provider,
  children,
  themed,
  onSignIn,
}: OAuthButtonProps) {
  const ui = useUI();
  const { error, callback } = useSignInWithProvider(provider, onSignIn);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        disabled={ui.state !== "idle"}
        onClick={callback}
        data-provider={provider.providerId}
        data-themed={themed}
        className="w-full"
        variant={themed ? "default" : "outline"}
      >
        {children}
      </Button>
      {error && (
        <div className="text-destructive text-left text-xs">{error}</div>
      )}
    </div>
  );
}
