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
  it("renders intro and footer when given", () => {
    const out = html(
      <SignInView {...base} intro={<p id="the-intro" />} footer={<p id="the-footer" />} />,
    );
    expect(out).toContain('id="the-intro"');
    expect(out).toContain('id="the-footer"');
    expect(html(<SignInView {...base} />)).not.toContain("the-intro");
  });

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

const w = authCopy.world;
const landing = (props: Record<string, unknown> = {}) =>
  html(<SignInView {...base} landing {...props} />);
const plain = (props: Record<string, unknown> = {}) => html(<SignInView {...base} {...props} />);
const count = (out: string, re: RegExp) => out.match(re)?.length ?? 0;
const text = (out: string) => out.replace(/<[^>]*>/g, " ");

describe("frame", () => {
  it("AuthLayout has header, stage, frame, strip, card and footer", () => {
    const out = html(<AuthLayout title="T">x</AuthLayout>);
    for (const t of ["<header", "<main", "<footer"]) expect(out).toContain(t);
    for (const c of ["aw-stage", "aw-frame", "aw-strip", "aw-card"]) expect(out).toContain(c);
    expect(out.match(/<div class="aw-strip">.*?<\/div>/)?.[0]).toContain(w.portalTitle);
    const header = out.slice(out.indexOf("<header"), out.indexOf("</header>"));
    expect(header).toContain(authCopy.brand);
    expect(header).toContain(w.tagline);
    const footer = out.slice(out.indexOf("<footer"));
    for (const t of w.footer) expect(footer).toContain(t);
    expect(out).toContain("px-scene");
    expect(
      html(
        <AuthLayout title="T" scene={false}>
          x
        </AuthLayout>,
      ),
    ).not.toContain("px-scene");
  });

  it("plain screens keep the card title as the only h1", () => {
    const outs = [html(<AuthLayout title="T">x</AuthLayout>), plain(), html(<CheckingView />)];
    for (const out of outs) {
      expect(count(out, /<h1/g)).toBe(1);
      expect(out).not.toContain(w.eyebrow);
      expect(out).not.toContain(w.headlineLead);
    }
    expect(outs[0]).toMatch(/<h1[^>]*>T<\/h1>/);
  });

  it("header logo is decorative and the header has no control", () => {
    const out = html(<AuthLayout title="T">x</AuthLayout>);
    expect(out).toMatch(/<div class="aw-logo" aria-hidden="true"/);
    const header = out.slice(out.indexOf("<header"), out.indexOf("</header>"));
    expect(header).not.toMatch(/<a |<button|<input|tabindex/);
  });
});

describe("landing", () => {
  it("renders header, hero, card intro and footer", () => {
    const out = landing();
    expect(out).toContain(w.eyebrow);
    expect(out).toMatch(
      new RegExp(
        `<h1[^>]*>${w.headlineLead} <em class="[^"]*aw-serif[^"]*">${w.headlineEm}</em></h1>`,
      ),
    );
    for (const t of [w.subline, w.portalTitle, w.introEyebrow, w.tagline, ...w.footer])
      expect(out).toContain(t);
    expect(out).toMatch(new RegExp(`<h2[^>]*>${w.introHeading}</h2>`));
  });

  it("exactly one h1, the headline", () => {
    const out = landing();
    expect(count(out, /<h1/g)).toBe(1);
    expect(out.match(/<h1.*?<\/h1>/)?.[0]).toContain(w.headlineLead);
    expect(out.match(/<h1.*?<\/h1>/)?.[0]).not.toContain(authCopy.signIn.title);
  });

  it("DOM order is header, hero, card, footer", () => {
    const out = landing();
    const at = (s: string) => out.indexOf(s);
    expect(at("<header")).toBeLessThan(at(w.eyebrow));
    expect(at(w.eyebrow)).toBeLessThan(at('id="signin-email"'));
    expect(at('id="signin-email"')).toBeLessThan(at("<footer"));
  });

  it("has exactly the controls of the plain sign-in view", () => {
    const slot = <div id="ts-slot" />;
    const variants = [
      { forgotHref: "/f", signUpHref: "/s" },
      { forgotHref: "/f", signUpHref: "/s", accounts, onContinueAs: noop },
      { turnstileRequired: true, turnstileSlot: slot },
    ];
    for (const v of variants) {
      const l = landing(v);
      const p = plain(v);
      for (const re of [/<button/g, /<a /g, /<input/g, /<select/g, /<textarea/g, /tabindex=/g])
        expect(count(l, re)).toBe(count(p, re));
    }
  });

  it("ships no demo or out-of-scope strings", () => {
    const t = text(landing());
    for (const re of [
      /demo/i,
      /Explore/,
      /no real authentication/,
      /Need a hand/,
      /Remember my email/,
      /Find your vibe/,
      /\[ 01 \]/,
      /Work email/,
    ])
      expect(t).not.toMatch(re);
    expect(landing()).toMatch(new RegExp(`<label[^>]*>${authCopy.fields.password}`));
  });

  it("the accept-invitation style sign-in stays plain", () => {
    const out = plain({ intro: <p id="the-intro" />, footer: <p id="the-footer" /> });
    expect(out).not.toContain(w.eyebrow);
    expect(out).toContain("the-intro");
    expect(out).toContain("the-footer");
  });
});

describe("pixel surface (D52)", () => {
  it("SignInScene is aria-hidden with no text and no img", () => {
    const out = html(<SignInScene />);
    expect(out).toContain('aria-hidden="true"');
    expect(out.replace(/<[^>]*>/g, "")).toBe("");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<canvas");
  });

  it("pixel classes stay off form text", () => {
    const page = html(<SignInView {...base} accounts={accounts} onContinueAs={noop} />);
    expect(page).not.toContain("font-pixel");
    for (const tag of page.match(/<(input|label|a)\b[^>]*>/g) ?? [])
      expect(tag).not.toMatch(/aw-strip-title|aw-heading|font-pixel/);
    for (const tag of page.match(/<[a-z0-9]+\b[^>]*role="status"[^>]*>/g) ?? [])
      expect(tag).not.toMatch(/aw-strip-title|aw-heading/);
    expect(page).toMatch(/<p class="aw-strip-title"/);
    expect(page).toMatch(/<h1 class="[^"]*aw-heading/);
    expect(page.match(/aw-heading/g)).toHaveLength(1);
  });

  it("the submit button carries data-variant=filled inside the aw-card", () => {
    const page = html(<SignInView {...base} />);
    const card = page.slice(page.indexOf("aw-card"));
    expect(card).toMatch(/<button[^>]*data-variant="filled"/);
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
