import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { authCopy } from "../copy/auth";
import { profileCopy } from "../copy/profile";
import { ProfileView } from "./ProfileView";

const noop = () => {};
const base = {
  initialName: "ann <b>",
  email: "ann@b.co",
  status: "idle",
  onSubmit: noop,
  onSignOut: noop,
} as const;
const html = renderToStaticMarkup;

describe("ProfileView", () => {
  it("prefilled value, label, autocomplete nickname, maxlength 80, required", () => {
    const out = html(<ProfileView {...base} />);
    expect(out).toContain('value="ann &lt;b&gt;"');
    expect(out).toContain(profileCopy.label);
    expect(out).toContain('autoComplete="nickname"');
    expect(out).toContain('maxLength="80"');
    expect(out).toContain('required=""');
    expect(out).not.toContain("aria-invalid");
  });

  it("shows error text with role alert and aria-invalid; submitting state disables the button", () => {
    const err = html(<ProfileView {...base} error="invalid" />);
    expect(err).toContain(profileCopy.errors.invalid);
    expect(err).toContain('role="alert"');
    expect(err).toContain('aria-invalid="true"');
    const retry = html(<ProfileView {...base} error="retry" />);
    expect(retry).toContain(profileCopy.errors.retry);
    expect(retry).toContain('role="alert"');
    const busy = html(<ProfileView {...base} status="submitting" />);
    expect(busy).toContain(profileCopy.saving);
    expect(busy).toContain('disabled=""');
  });

  it("shows the email so the user knows which account; sign-out button present", () => {
    const out = html(<ProfileView {...base} />);
    expect(out).toContain("ann@b.co");
    expect(out).toContain(authCopy.actions.signOut);
  });
});
