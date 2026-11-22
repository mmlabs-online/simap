import { describe, expect, it } from "vitest";
import * as accept from "./accept-invitation/page";
import * as forgot from "./forgot-password/page";
import * as reset from "./reset-password/page";
import * as signUp from "./sign-up/page";
import * as verify from "./verify-email/page";

describe("account pages", () => {
  it.each([
    ["sign-up", signUp],
    ["forgot-password", forgot],
    ["verify-email", verify],
    ["reset-password", reset],
    ["accept-invitation", accept],
  ])("%s exports metadata.referrer no-referrer and a title; takes no props", (_n, page) => {
    expect(page.metadata.referrer).toBe("no-referrer");
    expect(String(page.metadata.title).length).toBeGreaterThan(0);
    expect(page.default.length).toBe(0);
  });
});
