import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TIERS } from "@/lib/tier";
import { kitCopy } from "./copy/kit";
import { shellCopy } from "./copy/shell";
import { EntityFormDialog } from "./EntityFormDialog";
import { Icon } from "./Icon";
import { RoleBadge } from "./RoleBadge";

describe("RoleBadge", () => {
  it("shows tier label", () => {
    for (const t of TIERS) {
      expect(renderToStaticMarkup(<RoleBadge tier={t} />)).toContain(shellCopy.tiers[t]);
    }
  });
});

describe("Icon", () => {
  it("is decorative unless labelled", () => {
    expect(renderToStaticMarkup(<Icon name="search" />)).toContain('aria-hidden="true"');
    const labelled = renderToStaticMarkup(<Icon name="search" label="Search" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Search"');
    expect(labelled).not.toContain("aria-hidden");
  });
});

describe("EntityFormDialog", () => {
  const base = { title: "Add room", submitLabel: kitCopy.save, onClose() {}, onSubmit() {} };
  it("is labelled by its title with kit buttons", () => {
    const html = renderToStaticMarkup(
      <EntityFormDialog open {...base}>
        <span />
      </EntityFormDialog>,
    );
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain(kitCopy.cancel);
    expect(html).toContain(kitCopy.save);
  });
  it("shows the saving label and an alert error", () => {
    const html = renderToStaticMarkup(
      <EntityFormDialog open {...base} submitting error="Could not save.">
        <span />
      </EntityFormDialog>,
    );
    expect(html).toContain(kitCopy.saving);
    expect(html).toMatch(/role="alert"[^>]*>Could not save\./);
  });
  it("renders nothing when closed", () => {
    expect(
      renderToStaticMarkup(
        <EntityFormDialog open={false} {...base}>
          <span />
        </EntityFormDialog>,
      ),
    ).toBe("");
  });
});
