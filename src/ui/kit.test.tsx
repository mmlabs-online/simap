import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TIERS } from "@/lib/tier";
import { EntityFormDialog } from "./EntityFormDialog";
import { Icon } from "./Icon";
import { RoleBadge } from "./RoleBadge";

describe("RoleBadge", () => {
  it("shows Vietnamese tier label", () => {
    const labels = ["Người dùng", "Quản lý", "Quản trị"];
    TIERS.forEach((t, i) => {
      expect(renderToStaticMarkup(<RoleBadge tier={t} />)).toContain(labels[i]);
    });
  });
});

describe("Icon", () => {
  it("is decorative unless labelled", () => {
    expect(renderToStaticMarkup(<Icon name="search" />)).toContain('aria-hidden="true"');
    const labelled = renderToStaticMarkup(<Icon name="search" label="Tìm" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Tìm"');
    expect(labelled).not.toContain("aria-hidden");
  });
});

describe("EntityFormDialog", () => {
  const base = { title: "Thêm phòng", submitLabel: "Lưu", onClose() {}, onSubmit() {} };
  it("is labelled by its title with Vietnamese buttons", () => {
    const html = renderToStaticMarkup(
      <EntityFormDialog open {...base}>
        <span />
      </EntityFormDialog>,
    );
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Hủy");
    expect(html).toContain("Lưu");
  });
  it("shows the saving label and an alert error", () => {
    const html = renderToStaticMarkup(
      <EntityFormDialog open {...base} submitting error="Không lưu được.">
        <span />
      </EntityFormDialog>,
    );
    expect(html).toContain("Đang lưu…");
    expect(html).toMatch(/role="alert"[^>]*>Không lưu được\./);
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
