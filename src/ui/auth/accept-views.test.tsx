import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "../copy/auth";
import { invitationsCopy } from "../copy/invitations";
import {
  AcceptDoneView,
  AcceptInvalidView,
  AcceptReadyView,
  AcceptSignInFooter,
  AcceptSignInIntro,
} from "./accept-views";
import { LinkCheckingView } from "./account-views";
import { SignInView } from "./views";

const noop = () => {};
const html = renderToStaticMarkup;
const SENTINEL = "SENTINEL-TOKEN-" + "x".repeat(30);
const ready = { status: "idle" as const, onAccept: noop, onOtherAccount: noop };

describe("accept views", () => {
  it("no view renders the token", () => {
    const outs = [
      html(<LinkCheckingView />),
      html(<AcceptInvalidView />),
      html(<AcceptDoneView />),
      html(<AcceptReadyView email="a@b.co" {...ready} />),
      html(
        <AcceptReadyView
          email="a@b.co"
          {...ready}
          error={{ code: "invitation_email_mismatch" }}
          offerOtherAccount
        />,
      ),
      html(
        <SignInView
          status="idle"
          onSignIn={noop}
          intro={<AcceptSignInIntro />}
          footer={<AcceptSignInFooter />}
        />,
      ),
    ];
    for (const out of outs) {
      expect(out).not.toContain(SENTINEL);
      expect(out).not.toContain("#token");
      expect(out).not.toContain("token=");
    }
  });

  it("create-account and forgot links open a new tab with rel noopener noreferrer", () => {
    const out = html(<AcceptSignInFooter />);
    for (const href of ["/sign-up", "/forgot-password"]) {
      expect(out).toMatch(
        new RegExp(`<a href="${href}" target="_blank" rel="noopener noreferrer"`),
      );
    }
  });

  it("mismatch shows the mismatch message and Use another account", () => {
    const out = html(
      <AcceptReadyView
        email="a@b.co"
        {...ready}
        error={{ code: "invitation_email_mismatch" }}
        offerOtherAccount
      />,
    );
    expect(out).toContain(authErrorMessage({ code: "invitation_email_mismatch" }));
    expect(out).toContain(invitationsCopy.accept.otherAccount);
  });

  it("ready shows Accept as <email> (Vietnamese diacritics kept), accepting disables both buttons", () => {
    const email = "nguyễn.văn@example.invalid";
    expect(html(<AcceptReadyView email={email} {...ready} />)).toContain(`Accept as ${email}`);
    const busy = html(<AcceptReadyView email={email} {...ready} status="accepting" />);
    expect(busy.match(/disabled=""/g)).toHaveLength(2);
  });

  it("invalid view has a link to / and the open-the-email-again text", () => {
    const out = html(<AcceptInvalidView />);
    expect(out).toContain('href="/"');
    expect(out).toContain("open the link from your email again");
  });
});
