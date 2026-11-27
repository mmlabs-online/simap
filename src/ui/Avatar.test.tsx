import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("src renders an img with alt='' inside the aria-hidden span and no initials; null or missing src renders the initials", () => {
    const withSrc = renderToStaticMarkup(<Avatar name="Nguyễn Thị Ánh" src="blob:x" size={40} />);
    expect(withSrc).toContain('src="blob:x"');
    expect(withSrc).toContain('alt=""');
    expect(withSrc).toContain("aria-hidden");
    expect(withSrc).not.toContain("NÁ");
    for (const src of [null, undefined]) {
      const html = renderToStaticMarkup(<Avatar name="Nguyễn Thị Ánh" src={src} />);
      expect(html).toContain("NÁ");
      expect(html).not.toContain("<img");
    }
  });
  it("given color uses the on-action token for initials, no hex colour", () => {
    const html = renderToStaticMarkup(
      <Avatar name="Lê Bình" color="var(--color-workspace-primary)" />,
    );
    expect(html).toContain("color:var(--color-on-action)");
    expect(html).not.toContain("#");
  });
});
