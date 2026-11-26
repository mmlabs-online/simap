import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CREDITS } from "@/lib/credits";
import { creditsCopy } from "../copy/credits";
import { CreditsPage } from "./CreditsPage";

describe("CreditsPage", () => {
  it("renders title, one card per entry, author, licence, verbatim attribution, link with target _blank and rel noopener noreferrer", () => {
    const html = renderToStaticMarkup(<CreditsPage />);
    expect(html).toContain(`<h1`);
    expect(html).toContain(creditsCopy.title);
    expect(html.match(/<section/g)).toHaveLength(CREDITS.length);
    for (const c of CREDITS) {
      expect(html).toContain(c.pack);
      expect(html).toContain(c.author);
      expect(html).toContain(c.licence);
      expect(html).toContain(c.attribution);
      expect(html).toContain(`href="${c.url}"`);
    }
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain(creditsCopy.empty);
  });

  it("empty list shows the empty text", () => {
    const html = renderToStaticMarkup(<CreditsPage credits={[]} />);
    expect(html).toContain(creditsCopy.empty);
    expect(html).not.toContain("<section");
  });
});
