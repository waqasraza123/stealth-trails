import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { getAuthCredibilityChips, getSignInCopy } from "./auth-content";
import { useT } from "@/i18n/use-t";

export function RecoveryShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const t = useT();
  const copy = getSignInCopy(t);
  return (
    <AuthShell
      formEyebrow="Account recovery"
      formTitle={title}
      formDescription={description}
      brandEyebrow={copy.brandEyebrow}
      brandTitle={copy.brandTitle}
      brandDescription={copy.brandDescription}
      chips={getAuthCredibilityChips(t)}
      footer={
        <Link
          to="/auth/sign-in"
          className="font-semibold text-auth-form-accent"
        >
          Back to sign in
        </Link>
      }
    >
      {children}
    </AuthShell>
  );
}
