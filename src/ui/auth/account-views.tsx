"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { AuthError } from "@/lib/identity/types";
import {
  emailError,
  hasErrors,
  validateNewPassword,
  validateSignUp,
  type FieldErrors,
} from "@/lib/validate/credentials";
import { Button } from "../Button";
import { authCopy, authErrorMessage } from "../copy/auth";
import { AuthLayout } from "./AuthLayout";
import { Field, linkClass, Notice, ShowPasswordToggle } from "./fields";

type Status = "idle" | "submitting";

export function LinkCheckingView() {
  return (
    <AuthLayout title={authCopy.signIn.title}>
      <Notice kind="info" busy>
        {authCopy.linkChecking}
      </Notice>
    </AuthLayout>
  );
}

export function SignUpView({
  status,
  error,
  sentTo,
  onSubmit,
  turnstileSlot,
}: {
  status: Status;
  error?: AuthError | null;
  /** Set once Identity accepted the sign-up: the form is replaced by "check your inbox". */
  sentTo?: string | null;
  onSubmit: (values: { email: string; password: string }) => void;
  turnstileSlot: ReactNode;
}) {
  const copy = authCopy.signUp;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<"email" | "password" | "confirm">>({});
  const submitting = status === "submitting";

  if (sentTo) {
    return (
      <AuthLayout title={copy.title}>
        <Notice kind="info">{copy.sent(sentTo)}</Notice>
        <a href="/sign-in" className={linkClass}>
          {copy.toSignIn}
        </a>
      </AuthLayout>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const found = validateSignUp({ email, password, confirm });
    setErrors(found);
    if (hasErrors(found)) return;
    onSubmit({ email: email.trim(), password });
  }
  const clear = (k: "email" | "password" | "confirm") =>
    setErrors((prev) => {
      const { [k]: _, ...rest } = prev;
      return rest;
    });
  const type = showPassword ? "text" : "password";

  return (
    <AuthLayout title={copy.title}>
      {error && <Notice kind="error">{authErrorMessage(error)}</Notice>}
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field
          id="signup-email"
          label={authCopy.fields.email}
          icon="mail"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email && authCopy.fieldErrors[errors.email]}
          onChange={(v) => {
            setEmail(v);
            clear("email");
          }}
        />
        <Field
          id="signup-password"
          label={authCopy.fields.password}
          icon="login"
          type={type}
          autoComplete="new-password"
          value={password}
          error={errors.password && authCopy.fieldErrors[errors.password]}
          onChange={(v) => {
            setPassword(v);
            clear("password");
          }}
        />
        <Field
          id="signup-confirm"
          label={authCopy.fields.confirmPassword}
          icon="login"
          type={type}
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm && authCopy.fieldErrors[errors.confirm]}
          onChange={(v) => {
            setConfirm(v);
            clear("confirm");
          }}
        />
        <ShowPasswordToggle checked={showPassword} onChange={setShowPassword} />
        <div className="min-h-[65px]">{turnstileSlot}</div>
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>
      <a href="/sign-in" className={linkClass}>
        {copy.toSignIn}
      </a>
    </AuthLayout>
  );
}

export function ForgotPasswordView({
  status,
  error,
  sent,
  onSubmit,
  turnstileSlot,
}: {
  status: Status;
  error?: AuthError | null;
  /** The neutral answer: shown for every address, so it never names one. */
  sent?: boolean;
  onSubmit: (email: string) => void;
  turnstileSlot: ReactNode;
}) {
  const copy = authCopy.forgot;
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email">>({});
  const submitting = status === "submitting";

  if (sent) {
    return (
      <AuthLayout title={copy.title}>
        <Notice kind="info">{copy.sent}</Notice>
        <a href="/sign-in" className={linkClass}>
          {copy.toSignIn}
        </a>
      </AuthLayout>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const code = emailError(email);
    setErrors(code ? { email: code } : {});
    if (code) return;
    onSubmit(email.trim());
  }

  return (
    <AuthLayout title={copy.title}>
      <p className="text-sm">{copy.body}</p>
      {error && <Notice kind="error">{authErrorMessage(error)}</Notice>}
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field
          id="forgot-email"
          label={authCopy.fields.email}
          icon="mail"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email && authCopy.fieldErrors[errors.email]}
          onChange={(v) => {
            setEmail(v);
            setErrors({});
          }}
        />
        <div className="min-h-[65px]">{turnstileSlot}</div>
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>
      <a href="/sign-in" className={linkClass}>
        {copy.toSignIn}
      </a>
    </AuthLayout>
  );
}

export function ResetPasswordView({
  state,
  status,
  error,
  onSubmit,
}: {
  state: "ready" | "done" | "invalid";
  status: Status;
  error?: AuthError | null;
  onSubmit: (password: string) => void;
}) {
  const copy = authCopy.reset;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<"password" | "confirm">>({});
  const submitting = status === "submitting";

  if (state === "done") {
    return (
      <AuthLayout title={copy.title}>
        <Notice kind="info">{copy.done}</Notice>
        <a href="/sign-in" className={linkClass}>
          {copy.toSignIn}
        </a>
      </AuthLayout>
    );
  }
  if (state === "invalid") {
    return (
      <AuthLayout title={copy.title}>
        <Notice kind="error">{copy.invalid}</Notice>
        <a href="/forgot-password" className={linkClass}>
          {copy.newLink}
        </a>
      </AuthLayout>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const found = validateNewPassword({ password, confirm });
    setErrors(found);
    if (hasErrors(found)) return;
    onSubmit(password);
  }
  const clear = (k: "password" | "confirm") =>
    setErrors((prev) => {
      const { [k]: _, ...rest } = prev;
      return rest;
    });
  const type = showPassword ? "text" : "password";

  return (
    <AuthLayout title={copy.title}>
      {error && <Notice kind="error">{authErrorMessage(error)}</Notice>}
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field
          id="reset-password"
          label={authCopy.fields.newPassword}
          icon="login"
          type={type}
          autoComplete="new-password"
          value={password}
          error={errors.password && authCopy.fieldErrors[errors.password]}
          onChange={(v) => {
            setPassword(v);
            clear("password");
          }}
        />
        <Field
          id="reset-confirm"
          label={authCopy.fields.confirmPassword}
          icon="login"
          type={type}
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm && authCopy.fieldErrors[errors.confirm]}
          onChange={(v) => {
            setConfirm(v);
            clear("confirm");
          }}
        />
        <ShowPasswordToggle checked={showPassword} onChange={setShowPassword} />
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}

/** Verification runs only from the button: no form, nothing posts on load (mail scanners must not verify). */
export function VerifyEmailView({
  state,
  status,
  error,
  onVerify,
}: {
  state: "ready" | "verified" | "invalid";
  status: Status;
  error?: AuthError | null;
  onVerify: () => void;
}) {
  const copy = authCopy.verify;
  if (state === "verified") {
    return (
      <AuthLayout title={copy.title}>
        <Notice kind="info">{copy.verified}</Notice>
        <a href="/" className={linkClass}>
          {copy.continue}
        </a>
      </AuthLayout>
    );
  }
  if (state === "invalid") {
    return (
      <AuthLayout title={copy.title}>
        <Notice kind="error">{copy.invalid}</Notice>
        <a href="/sign-in" className={linkClass}>
          {copy.toSignIn}
        </a>
      </AuthLayout>
    );
  }
  const submitting = status === "submitting";
  return (
    <AuthLayout title={copy.title}>
      <p className="text-sm">{copy.body}</p>
      {error && <Notice kind="error">{authErrorMessage(error)}</Notice>}
      <Button size="lg" fullWidth disabled={submitting} onClick={onVerify}>
        {submitting ? copy.submitting : copy.submit}
      </Button>
    </AuthLayout>
  );
}
