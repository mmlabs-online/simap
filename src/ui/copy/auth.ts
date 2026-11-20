import { waitText } from "@/lib/format";
import type { AuthError, AuthErrorCode } from "@/lib/identity/types";
import type { FieldErrorCode } from "@/lib/validate/credentials";

/** English strings for the sign-in surface (D36). Strings that take values are small functions. */
export const authCopy = {
  brand: "simap",
  pageTitle: "Sign in",
  checking: "Checking your session...",
  turnstileLabel: "Security check",
  fields: {
    email: "Email",
    password: "Password",
    showPassword: "Show password",
  },
  fieldErrors: {
    required: "Enter this information.",
    invalid: "Enter a valid email address.",
    tooShort: "The password is too short.",
    tooLong: "The password is too long.",
    mismatch: "The passwords do not match.",
  } satisfies Record<FieldErrorCode, string>,
  signIn: {
    title: "Sign in",
    submit: "Sign in",
    submitting: "Signing in...",
    signedOut: "You are signed out.",
    logoutUnconfirmed:
      "You are signed out of simap in this browser, but Identity did not confirm the sign-out. On a shared computer, sign in and out again when you are online.",
    toSignUp: "Create an account",
    forgot: "Forgot password",
    accountsLabel: "Accounts signed in on this browser",
    continueAs: (email: string) => `Continue as ${email}`,
    continuing: "Signing in...",
    otherAccount: "or sign in with another account",
  },
  join: {
    title: "Join simap",
    body: "Your account has not used simap yet. Press the button below to join.",
    continue: (email: string) => `Continue as ${email}`,
    joining: "Joining...",
    pending: "Your request to join simap is waiting for approval.",
    otherAccount: "Use another account",
  },
  unverified: {
    title: "Verify your email",
    body: (email: string | null) =>
      email
        ? `${email} is not verified yet. Open the link in the email we sent you, then come back here.`
        : "Your email is not verified yet. Open the link in the email we sent you, then come back here.",
    checkAgain: "Check again",
    otherAccount: "Use another account",
  },
  noOrg: {
    title: "No organization",
    body: (email: string | null) =>
      email
        ? `Signed in as ${email}. No organization selected yet.`
        : "No organization selected yet.",
  },
  noAccess: { title: "No access" },
  retry: { title: "Cannot continue", button: "Try again" },
  actions: { signOut: "Sign out" },
  errors: {
    invalid_credentials: "Email or password is incorrect.",
    email_unverified: "Your email is not verified yet. Open the link in the email we sent you.",
    not_member: "This account is not allowed to use simap.",
    join_closed: "simap is not accepting new members right now.",
    join_rejected: "Your request to join simap was declined.",
    join_queue_full: "Too many requests are waiting. Try again later.",
    join_unavailable: "Joining simap is not possible right now. Contact the operator.",
    session_invalid: "Your session has expired. Sign in again.",
    turnstile_required: "Complete the security check below, then try again.",
    turnstile_failed: "The security check failed. Try again.",
    rate_limited: (wait: string) => `Too many attempts. Try again in ${wait}.`,
    network: "Cannot reach the server. Check your connection and try again.",
    email_taken: "This email is already in use.",
    weak_password: "The password is not strong enough.",
    validation_error: "Some of the information is not valid. Check it and try again.",
    token_invalid: "This link is not valid or has expired.",
    email_already_verified: "Your email is already verified. You can sign in.",
    no_access:
      "This account has no access to simap. Sign in with another account or try again later.",
    unknown: "Something went wrong. Try again later.",
  } satisfies Record<AuthErrorCode, string | ((wait: string) => string)>,
  weak: {
    too_short: "The password is too short.",
    too_common: "This password is too common. Choose another one.",
  },
} as const;

/** The user-facing message for an auth error. Never includes server text or the typed email. */
export function authErrorMessage(error: AuthError): string {
  const e = authCopy.errors;
  const code: AuthErrorCode =
    typeof error.code === "string" && Object.prototype.hasOwnProperty.call(e, error.code)
      ? error.code
      : "unknown";
  if (code === "rate_limited") return e.rate_limited(waitText(error.retryAfterSeconds ?? NaN));
  if (code === "weak_password") {
    const parts = (Array.isArray(error.reasons) ? error.reasons : [])
      .filter((r) => r === "too_short" || r === "too_common")
      .map((r) => authCopy.weak[r]);
    return parts.length ? parts.join(" ") : e.weak_password;
  }
  return e[code] as string;
}
