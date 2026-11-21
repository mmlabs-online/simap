import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { authCopy, authErrorMessage } from "../copy/auth";
import { orgCopy } from "../copy/org";
import { AuthLayout } from "./AuthLayout";
import { SignInScene } from "./SignInScene";
import {
  CheckingView,
  JoinView,
  NoAccessView,
  NoOrgView,
  RetryView,
  SignInView,
  UnverifiedView,
} from "./views";

const noop = () => {};
const html = renderToStaticMarkup;
const base = { status: "idle" as const, onSignIn: noop };
const accounts = [
  { accountId: "a1", email: "an@example.invalid" },
  { accountId: "a2", email: "binh@example.invalid" },
];

describe("SignInView", () => {
  it("renders the form and one Continue as button per account", () => {
    const out = html(<SignInView {...base} accounts={accounts} onContinueAs={noop} />);
    expect(out).toContain('type="email"');
    expect(out).toContain('type="password"');
    expect(out).toContain(authCopy.signIn.continueAs("an@example.invalid"));
    expect(out).toContain(authCopy.signIn.continueAs("binh@example.invalid"));
    expect(out.match(/Continue as/g)).toHaveLength(2);
  });

  it("shows sign-up and forgot links only when hrefs are given", () => {
    const without = html(<SignInView {...base} />);
    expect(without).not.toContain(authCopy.signIn.toSignUp);
    expect(without).not.toContain(authCopy.signIn.forgot);
    const withLinks = html(<SignInView {...base} signUpHref="/sign-up" forgotHref="/forgot" />);
    expect(withLinks).toContain('href="/sign-up"');
    expect(withLinks).toContain('href="/forgot"');
  });

  it("shows the Turnstile slot only when required", () => {
    const slot = <div id="ts-slot" />;
    expect(html(<SignInView {...base} turnstileSlot={slot} />)).not.toContain("ts-slot");
    expect(html(<SignInView {...base} turnstileSlot={slot} turnstileRequired />)).toContain(
      "ts-slot",
    );
    expect(
      html(<SignInView {...base} turnstileSlot={slot} error={{ code: "turnstile_failed" }} />),
    ).toContain("ts-slot");
  });

  it("invalid_credentials: the alert is the generic message and does not contain the typed email", () => {
    const email = "an@example.invalid";
    const out = html(
      <SignInView {...base} initialEmail={email} error={{ code: "invalid_credentials" }} />,
    );
    const message = authErrorMessage({ code: "invalid_credentials" });
    expect(out).toMatch(new RegExp(`role="alert"[^>]*><p[^>]*>${message}</p>`));
    expect(out.match(/role="alert"[\s\S]*?<\/div>/)![0]).not.toContain(email);
  });
});

describe("other views", () => {
  it("JoinView button text names the account; pending hides the button", () => {
    const out = html(
      <JoinView email="an@example.invalid" status="idle" onJoin={noop} onUseOtherAccount={noop} />,
    );
    expect(out).toContain(authCopy.join.continue("an@example.invalid"));
    const pending = html(
      <JoinView
        email="an@example.invalid"
        status="idle"
        pending
        onJoin={noop}
        onUseOtherAccount={noop}
      />,
    );
    expect(pending).toContain(authCopy.join.pending);
    expect(pending).not.toContain(authCopy.join.continue("an@example.invalid"));
  });

  it("NoOrgView shows the AUT-06 text, how to get access, the email, sign-out and a notice", () => {
    const out = html(<NoOrgView email="an@example.invalid" onSignOut={noop} />);
    expect(out).toContain(orgCopy.none.title);
    expect(out).toContain("You are not in any organization yet");
    expect(out).toContain(orgCopy.none.howTo);
    expect(out).toContain(authCopy.actions.signOut);
    expect(out).toContain("an@example.invalid");
    expect(out).not.toContain(orgCopy.notices.org_denied);
    expect(html(<NoOrgView email={null} notice="org_denied" onSignOut={noop} />)).toContain(
      orgCopy.notices.org_denied,
    );
  });

  it("NoAccessView shows 'You don't have permission'", () => {
    const out = html(<NoAccessView code="forbidden" onSignOut={noop} />);
    expect(out).toContain("You don&#x27;t have permission");
    expect(out).toContain(authCopy.actions.signOut);
  });

  it("NoAccessView without onSignOut has the message and no button", () => {
    const out = html(<NoAccessView code="forbidden" />);
    expect(out).toContain("You don&#x27;t have permission");
    expect(out).not.toContain("<button");
  });

  it("UnverifiedView has Check again and Use another account", () => {
    const out = html(<UnverifiedView email={null} onCheckAgain={noop} onUseOtherAccount={noop} />);
    expect(out).toContain(authCopy.unverified.checkAgain);
    expect(out).toContain(authCopy.unverified.otherAccount);
  });

  it("UnverifiedView shows Resend, Check again, Use another account", () => {
    const out = html(
      <UnverifiedView email={null} onCheckAgain={noop} onUseOtherAccount={noop} onResend={noop} />,
    );
    expect(out).toContain(authCopy.unverified.resend);
    expect(out).toContain(authCopy.unverified.checkAgain);
    expect(out).toContain(authCopy.unverified.otherAccount);
  });

  it("UnverifiedView sent / rate-limited / sending states", () => {
    const props = { email: null, onCheckAgain: noop, onUseOtherAccount: noop, onResend: noop };
    expect(html(<UnverifiedView {...props} resend="sent" />)).toContain(authCopy.unverified.resent);
    const limited = html(
      <UnverifiedView {...props} resendError={{ code: "rate_limited", retryAfterSeconds: 30 }} />,
    );
    expect(limited).toContain('role="alert"');
    expect(limited).toContain(authErrorMessage({ code: "rate_limited", retryAfterSeconds: 30 }));
    const sending = html(<UnverifiedView {...props} resend="sending" />);
    expect(sending).toMatch(/<button[^>]*disabled[^>]*>\s*(<[^>]+>)*Sending/);
  });

  it("UnverifiedView without onResend shows no Resend", () => {
    const out = html(<UnverifiedView email={null} onCheckAgain={noop} onUseOtherAccount={noop} />);
    expect(out).not.toContain(authCopy.unverified.resend);
  });

  it("RetryView has a Try again button and no sign-out", () => {
    const out = html(<RetryView error={{ code: "network" }} onRetry={noop} />);
    expect(out.match(/<button/g)).toHaveLength(1);
    expect(out).toContain(authCopy.retry.button);
    expect(out).not.toContain(authCopy.actions.signOut);
  });

  it("CheckingView is a busy status", () => {
    expect(html(<CheckingView />)).toContain('aria-busy="true"');
  });
});

describe("pixel surface (D52)", () => {
  it("AuthLayout has the px-frame, px-strip and the scene slot; scene={false} drops the slot", () => {
    const out = html(<AuthLayout title="T">x</AuthLayout>);
    expect(out).toContain("px-frame");
    expect(out).toContain("px-strip");
    expect(out).toContain("px-scene");
    expect(
      html(
        <AuthLayout title="T" scene={false}>
          x
        </AuthLayout>,
      ),
    ).not.toContain("px-scene");
  });

  it("SignInScene is aria-hidden with no text and no img", () => {
    const out = html(<SignInScene />);
    expect(out).toContain('aria-hidden="true"');
    expect(out.replace(/<[^>]*>/g, "")).toBe("");
    expect(out).not.toContain("<img");
  });

  it("every img in any view has an alt", () => {
    const all = [
      html(<CheckingView />),
      html(<SignInView {...base} accounts={accounts} onContinueAs={noop} />),
      html(<RetryView error={{ code: "unknown" }} onRetry={noop} />),
    ].join("");
    for (const img of all.match(/<img\b[^>]*>/g) ?? []) expect(img).toContain("alt=");
  });
});
