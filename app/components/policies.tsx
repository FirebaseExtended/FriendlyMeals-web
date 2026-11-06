import { useContext } from "react";
import { getTranslation } from "@firebase-oss/ui-core";
import { PolicyContext, useUI } from "@firebase-oss/ui-react";
import { cn } from "@/lib/utils";

export function Policies() {
  const ui = useUI();
  const policies = useContext(PolicyContext);

  if (!policies) {
    return null;
  }

  const { termsOfServiceUrl, privacyPolicyUrl, onNavigate } = policies;
  const termsAndPrivacyText = getTranslation(ui, "messages", "termsAndPrivacy");
  const parts = termsAndPrivacyText.split(/(\{tos\}|\{privacy\})/);

  const className = cn("hover:underline font-semibold");
  const renderPolicyLink = (
    key: number,
    url: typeof termsOfServiceUrl,
    label: string
  ) =>
    onNavigate ? (
      <button
        key={key}
        type="button"
        className={className}
        onClick={() => onNavigate(url)}
      >
        {label}
      </button>
    ) : (
      <a
        key={key}
        href={url.toString()}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );

  return (
    <div className="text-muted-foreground text-center text-xs">
      {parts.map((part: string, index: number) => {
        if (part === "{tos}") {
          return renderPolicyLink(
            index,
            termsOfServiceUrl,
            getTranslation(ui, "labels", "termsOfService")
          );
        }

        if (part === "{privacy}") {
          return renderPolicyLink(
            index,
            privacyPolicyUrl,
            getTranslation(ui, "labels", "privacyPolicy")
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}
