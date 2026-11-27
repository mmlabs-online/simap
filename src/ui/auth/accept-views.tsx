import { Button } from "../Button";
import { authErrorMessage } from "../copy/auth";
import { invitationsCopy } from "../copy/invitations";
import type { AuthError } from "@/lib/identity/types";
import { AuthLayout } from "./AuthLayout";
import { linkClass, Notice } from "./fields";

const copy = invitationsCopy.accept;

export function AcceptReadyView({
  email,
  status,
  error,
  onAccept,
  onOtherAccount,
}: {
  email: string;
  status: "idle" | "accepting";
  error?: AuthError | null;
  /** The controller always offers "Use another account"; a mismatch only adds the message. */
  offerOtherAccount?: boolean;
  onAccept: () => void;
  onOtherAccount: () => void;
}) {
  const busy = status === "accepting";
  return (
    <AuthLayout title={copy.title}>
      {error && <Notice kind="error">{authErrorMessage(error)}</Notice>}
      <Button size="lg" fullWidth disabled={busy} onClick={onAccept}>
        <span className="whitespace-normal break-all">
          {busy ? copy.accepting : copy.acceptAs(email)}
        </span>
      </Button>
      <Button variant="text" disabled={busy} onClick={onOtherAccount}>
        {copy.otherAccount}
      </Button>
    </AuthLayout>
  );
}

export function AcceptInvalidView() {
  return (
    <AuthLayout title={copy.invalidTitle}>
      <Notice kind="error">{copy.invalid}</Notice>
      <a href="/" className={linkClass}>
        {copy.goHome}
      </a>
    </AuthLayout>
  );
}

export function AcceptDoneView() {
  return (
    <AuthLayout title={copy.title}>
      <Notice kind="info" busy>
        {copy.joining}
      </Notice>
    </AuthLayout>
  );
}

export function AcceptSignInIntro() {
  return <p className="text-label font-normal">{copy.signInHint}</p>;
}

/** The links open a new tab so this tab keeps the token in memory. */
export function AcceptSignInFooter() {
  return (
    <>
      <p className="text-label font-normal text-text-secondary">{copy.newAccountHint}</p>
      <a href="/sign-up" target="_blank" rel="noopener noreferrer" className={linkClass}>
        {copy.createAccount}
      </a>
      <a href="/forgot-password" target="_blank" rel="noopener noreferrer" className={linkClass}>
        {copy.forgotPassword}
      </a>
    </>
  );
}
