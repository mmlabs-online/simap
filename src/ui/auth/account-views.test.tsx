import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { authCopy } from "../copy/auth";
import {
  ForgotPasswordView,
  LinkCheckingView,
  ResetPasswordView,
  SignUpView,
  VerifyEmailView,
} from "./account-views";

const noop = () => {};
const html = renderToStaticMarkup;
const slot = <div id="ts-slot" />;
const idle = "idle" as const;

describe("SignUpView", () => {
  it("form: email, password, confirm, Turnstile slot, sign-in link", () => {
    const out = html(<SignUpView status={idle} onSubmit={noop} turnstileSlot={slot} />);
    for (const id of ["signup-email", "signup-password", "signup-confirm"]) {
      expect(out).toContain(`id="${id}"`);
    }
    expect(out).toContain('id="ts-slot"');
    expect(out).toContain('min-h-16.25"><div id="ts-slot"');
    expect(out).toContain('href="/sign-in"');
  });

  it("sent state shows the address and a sign-in link, no form", () => {
    const out = html(
      <SignUpView status={idle} sentTo="a@example.invalid" onSubmit={noop} turnstileSlot={slot} />,
    );
    expect(out).toContain("Check your inbox at a@example.invalid");
    expect(out).toContain('href="/sign-in"');
    expect(out).not.toContain("<form");
  });

  it("email_taken shows its own message in an alert", () => {
    const out = html(
      <SignUpView
        status={idle}
        error={{ code: "email_taken" }}
        onSubmit={noop}
        turnstileSlot={slot}
      />,
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain(authCopy.errors.email_taken);
  });
});

describe("ForgotPasswordView", () => {
  it("form: email, Turnstile slot, sign-in link", () => {
    const out = html(<ForgotPasswordView status={idle} onSubmit={noop} turnstileSlot={slot} />);
    expect(out).toContain('id="forgot-email"');
    expect(out).toContain('id="ts-slot"');
    expect(out).toContain('min-h-16.25"><div id="ts-slot"');
    expect(out).toContain('href="/sign-in"');
  });

  it("sent state shows exactly the neutral text", () => {
    const out = html(
      <ForgotPasswordView status={idle} sent onSubmit={noop} turnstileSlot={slot} />,
    );
    expect(out).toContain(authCopy.forgot.sent);
    expect(out).not.toContain("<form");
    expect(out).not.toContain("@");
  });
});

describe("ResetPasswordView", () => {
  it("ready: new password and confirm, show toggle, no email field", () => {
    const out = html(<ResetPasswordView state="ready" status={idle} onSubmit={noop} />);
    expect(out).toContain('id="reset-password"');
    expect(out).toContain('id="reset-confirm"');
    expect(out).toContain(authCopy.fields.showPassword);
    expect(out).not.toContain('type="email"');
  });

  it("weak_password lists the reasons and keeps the form", () => {
    const out = html(
      <ResetPasswordView
        state="ready"
        status={idle}
        error={{ code: "weak_password", reasons: ["too_short", "too_common"] }}
        onSubmit={noop}
      />,
    );
    expect(out).toContain(authCopy.weak.too_short);
    expect(out).toContain(authCopy.weak.too_common);
    expect(out).toContain("<form");
  });

  it("done links to /sign-in; invalid links to /forgot-password", () => {
    expect(html(<ResetPasswordView state="done" status={idle} onSubmit={noop} />)).toContain(
      'href="/sign-in"',
    );
    const invalid = html(<ResetPasswordView state="invalid" status={idle} onSubmit={noop} />);
    expect(invalid).toContain('href="/forgot-password"');
    expect(invalid).toContain(authCopy.reset.newLink);
  });
});

describe("VerifyEmailView", () => {
  it("ready has one Verify button and no form", () => {
    const out = html(<VerifyEmailView state="ready" status={idle} onVerify={noop} />);
    expect(out.match(/<button/g)).toHaveLength(1);
    expect(out).toContain(authCopy.verify.submit);
    expect(out).not.toContain("<form");
  });

  it("verified links to /", () => {
    expect(html(<VerifyEmailView state="verified" status={idle} onVerify={noop} />)).toContain(
      'href="/"',
    );
  });

  it("invalid links to /sign-in only, no resend", () => {
    const out = html(<VerifyEmailView state="invalid" status={idle} onVerify={noop} />);
    expect(out).toContain('href="/sign-in"');
    expect(out).not.toContain("<button");
    expect(out).not.toContain(authCopy.unverified.resend);
  });
});

describe("LinkCheckingView", () => {
  it("is a busy status", () => {
    const out = html(<LinkCheckingView />);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain(authCopy.linkChecking);
  });
});
