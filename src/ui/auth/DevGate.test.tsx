import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { devTokenCopy } from "../copy/dev-token";
import DevGate, { DevTokenView, devBadge } from "./DevGate";

const html = renderToStaticMarkup;
const noop = () => {};
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("DevTokenView", () => {
  it("invalid names pnpm dev:token and the --org hint, with Check again", () => {
    const out = html(<DevTokenView reason="invalid" onCheckAgain={noop} />);
    expect(out).toContain(devTokenCopy.invalidTitle);
    expect(out).toContain("pnpm dev:token");
    expect(out).toContain("--org");
    expect(out).toContain(devTokenCopy.checkAgain);
  });
  it("needOrg names pnpm dev:token --org <uuid>, with Check again", () => {
    const out = html(<DevTokenView reason="needOrg" onCheckAgain={noop} />);
    expect(out).toContain("pnpm dev:token --org &lt;uuid&gt;");
    expect(out).toContain(devTokenCopy.checkAgain);
  });
});

describe("DevGate", () => {
  it("first render shows the checking view and not its children", () => {
    const out = html(
      <DevGate>
        <p>child-marker</p>
      </DevGate>,
    );
    expect(out).not.toContain("child-marker");
  });

  it("the dev graph never imports the Identity runtime", () => {
    for (const p of [
      "./DevGate.tsx",
      "../../lib/api/dev-fetch.ts",
      "../../lib/identity/dev-flow.ts",
    ])
      expect(src(p)).not.toMatch(/runtime|tokenStore|identityClient|@\/lib\/dev-token/);
  });

  it("badge variant per mode: amber Dev token, red Production data (text says it)", () => {
    expect(devBadge(false)).toEqual(devTokenCopy.badge);
    expect(devBadge(false).prod).toBeUndefined();
    expect(devBadge(true)).toMatchObject({ label: "Production data", prod: true });
    expect(devBadge(true).tooltip).toContain("production");
  });

  it("the production-data flag is read only under the literal development guard", () => {
    expect(src("./DevGate.tsx")).toContain(
      'process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_PROD === "1"',
    );
  });
});
