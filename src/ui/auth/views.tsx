"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { AccountChoice, AuthError, Credentials } from "@/lib/identity/types";
import { hasErrors, validateSignIn, type FieldErrors } from "@/lib/validate/credentials";
import { Button } from "../Button";
import { apiErrorMessage } from "../copy/api";
import { authCopy, authErrorMessage } from "../copy/auth";
import { orgCopy } from "../copy/org";
import type { OrgNotice } from "@/lib/identity/orgs";
import { AuthLayout } from "./AuthLayout";
import { Field, linkClass, Notice, ShowPasswordToggle } from "./fields";

export function CheckingView() {
  return (
    <AuthLayout title={authCopy.signIn.title}>
      <Notice kind="info" busy>
        {authCopy.checking}
      </Notice>
    </AuthLayout>
  );
}

export type SignInNotice = "signed_out" | "logout_unconfirmed";

export function SignInView({
  status,
  error,
  notice,
  initialEmail = "",
  onSignIn,
  signUpHref,
  forgotHref,
  turnstileSlot,
  turnstileRequired,
  accounts,
  onContinueAs,
  continuingId,
}: {
  status: "idle" | "submitting";
  error?: AuthError | null;
  notice?: SignInNotice | null;
  initialEmail?: string;
  onSignIn: (values: Credentials) => void;
  /** The links render only when set. */
  signUpHref?: string;
  forgotHref?: string;
  turnstileSlot?: ReactNode;
  /** Keeps the slot visible next to other errors once Identity has asked for Turnstile. */
  turnstileRequired?: boolean;
  accounts?: AccountChoice[];
  onContinueAs?: (account: AccountChoice) => void;
  continuingId?: string | null;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const submitting = status === "submitting";
  const showTurnstile =
    turnstileRequired || error?.code === "turnstile_required" || error?.code === "turnstile_failed";
  const copy = authCopy.signIn;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const found = validateSignIn({ email, password });
    setErrors(found);
    if (hasErrors(found)) return;
    onSignIn({ email: email.trim(), password });
  }

  return (
    <AuthLayout title={copy.title}>
      {notice && (
        <Notice kind="info">
          {notice === "logout_unconfirmed" ? copy.logoutUnconfirmed : copy.signedOut}
        </Notice>
      )}
      {error && <Notice kind="error">{authErrorMessage(error)}</Notice>}
      {accounts && accounts.length > 0 && onContinueAs && (
        <>
          <section aria-label={copy.accountsLabel} className="flex flex-col gap-2">
            {accounts.map((a, i) => (
              <Button
                key={a.accountId}
                variant={i === 0 ? "filled" : "tonal"}
                disabled={submitting}
                onClick={() => onContinueAs(a)}
              >
                <span className="whitespace-normal break-all">
                  {continuingId === a.accountId ? copy.continuing : copy.continueAs(a.email)}
                </span>
              </Button>
            ))}
          </section>
          <p className="text-center text-sm text-on-surface-variant">{copy.otherAccount}</p>
        </>
      )}
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field
          id="signin-email"
          label={authCopy.fields.email}
          icon="mail"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email && authCopy.fieldErrors[errors.email]}
          onChange={(v) => {
            setEmail(v);
            setErrors(({ email: _, ...rest }) => rest);
          }}
        />
        <Field
          id="signin-password"
          label={authCopy.fields.password}
          icon="login"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          error={errors.password && authCopy.fieldErrors[errors.password]}
          onChange={(v) => {
            setPassword(v);
            setErrors(({ password: _, ...rest }) => rest);
          }}
        />
        <ShowPasswordToggle checked={showPassword} onChange={setShowPassword} />
        {showTurnstile && <div className="min-h-[65px]">{turnstileSlot}</div>}
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>
      {forgotHref && (
        <a href={forgotHref} className={linkClass}>
          {copy.forgot}
        </a>
      )}
      {signUpHref && (
        <a href={signUpHref} className={linkClass}>
          {copy.toSignUp}
        </a>
      )}
    </AuthLayout>
  );
}

/** "Continue as <email>": the click is the consent to join (D8). `pending`: waiting for approval, nothing to click. */
export function JoinView({
  email,
  status,
  error,
  pending,
  onJoin,
  onUseOtherAccount,
}: {
  email: string;
  status: "idle" | "submitting";
  error?: AuthError | null;
  pending?: boolean;
  onJoin: () => void;
  onUseOtherAccount: () => void;
}) {
  const copy = authCopy.join;
  const busy = status === "submitting";
  return (
    <AuthLayout title={copy.title}>
      {pending ? (
        <Notice kind="info">{copy.pending}</Notice>
      ) : (
        <p className="text-sm">{copy.body}</p>
      )}
      {error && <Notice kind="error">{authErrorMessage(error)}</Notice>}
      {!pending && (
        <Button size="lg" fullWidth disabled={busy} onClick={onJoin}>
          <span className="whitespace-normal break-all">
            {busy ? copy.joining : copy.continue(email)}
          </span>
        </Button>
      )}
      <Button variant="text" onClick={onUseOtherAccount}>
        {copy.otherAccount}
      </Button>
    </AuthLayout>
  );
}

/** Token or restore got 403 `email_unverified`: re-check, or leave. */
export function UnverifiedView({
  email,
  still,
  onCheckAgain,
  onUseOtherAccount,
  onResend,
  resend = "idle",
  resendError,
}: {
  email: string | null;
  /** The last re-check still found the email unverified. */
  still?: boolean;
  onCheckAgain: () => void;
  onUseOtherAccount: () => void;
  /** "Resend email" renders only when set. */
  onResend?: () => void;
  resend?: "idle" | "sending" | "sent";
  resendError?: AuthError | null;
}) {
  const copy = authCopy.unverified;
  return (
    <AuthLayout title={copy.title}>
      <Notice kind="info">{copy.body(email)}</Notice>
      {still && <Notice kind="error">{authCopy.errors.email_unverified}</Notice>}
      {resend === "sent" && <Notice kind="info">{copy.resent}</Notice>}
      {resendError && <Notice kind="error">{authErrorMessage(resendError)}</Notice>}
      <Button size="lg" fullWidth onClick={onCheckAgain}>
        {copy.checkAgain}
      </Button>
      {onResend && (
        <Button variant="tonal" disabled={resend === "sending"} onClick={onResend}>
          {resend === "sending" ? copy.resending : copy.resend}
        </Button>
      )}
      <Button variant="text" onClick={onUseOtherAccount}>
        {copy.otherAccount}
      </Button>
    </AuthLayout>
  );
}

export function NoOrgView({
  email,
  notice,
  onSignOut,
}: {
  email: string | null;
  notice?: OrgNotice;
  onSignOut: () => void;
}) {
  return (
    <AuthLayout title={orgCopy.none.title}>
      {notice && <Notice kind="info">{orgCopy.notices[notice]}</Notice>}
      <Notice kind="info">{orgCopy.none.body(email)}</Notice>
      <p className="text-sm text-on-surface-variant">{orgCopy.none.howTo}</p>
      <Button variant="tonal" onClick={onSignOut}>
        {authCopy.actions.signOut}
      </Button>
    </AuthLayout>
  );
}

export function NoAccessView({
  code,
  onSignOut,
}: {
  code: "forbidden" | "member_deactivated";
  onSignOut?: () => void;
}) {
  return (
    <AuthLayout title={authCopy.noAccess.title}>
      <Notice kind="error">{apiErrorMessage(code)}</Notice>
      {onSignOut && (
        <Button variant="tonal" onClick={onSignOut}>
          {authCopy.actions.signOut}
        </Button>
      )}
    </AuthLayout>
  );
}

/** A server or network fault: the session is kept; the user can try again (AUT-02). No sign-out here. */
export function RetryView({ error, onRetry }: { error: AuthError; onRetry: () => void }) {
  return (
    <AuthLayout title={authCopy.retry.title}>
      <Notice kind="error">{authErrorMessage(error)}</Notice>
      <Button size="lg" fullWidth onClick={onRetry}>
        {authCopy.retry.button}
      </Button>
    </AuthLayout>
  );
}
