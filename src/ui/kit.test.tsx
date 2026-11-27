import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TIERS } from "@/lib/tier";
import { kitCopy } from "./copy/kit";
import { shellCopy } from "./copy/shell";
import { Button, IconButton } from "./Button";
import { Card } from "./Card";
import { Chip, FilterChips, Pill } from "./Chip";
import { DialogField, DialogSelect, EntityFormDialog } from "./EntityFormDialog";
import { FilledInput } from "./FilledInput";
import { FormFooterBar } from "./FormFooterBar";
import { PageHeader } from "./PageHeader";
import { PageSkeleton } from "./PageSkeleton";
import { SectionCard } from "./SectionCard";
import { SegmentedFilter } from "./SegmentedFilter";
import { TabBar } from "./TabBar";
import { Field, Notice, ShowPasswordToggle } from "./auth/fields";
import { StatTile } from "./dashboard/StatTile";
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

const r = (el: React.ReactElement) => renderToStaticMarkup(el);
/** Class tokens of the first element matching `tag` (optionally containing `needle`). */
const classes = (html: string, tag = "[a-z0-9]+") =>
  (new RegExp(`<${tag}[^>]*class="([^"]*)"`).exec(html)?.[1] ?? "").split(/\s+/);
const LEGACY =
  /^(?:[\w-]+:)*(?:bg|text|border|outline|shadow)-(?:primary|on-primary|on-surface(?:-variant)?|surface-(?:high|highest|low|lowest|container)|outline(?:-variant)?|error|secondary[\w-]*|tertiary[\w-]*|accent-orange[\w-]*|[\w-]*-container)(?:\/\d+)?$|^rounded-md3/;

describe("Button", () => {
  const html = (variant: Parameters<typeof Button>[0]["variant"]) =>
    r(<Button variant={variant}>x</Button>);
  it("variants map to brief tokens and keep data-variant", () => {
    const f = html("filled");
    expect(f).toContain("bg-workspace-action text-on-action");
    expect(f).toContain("enabled:hover:bg-workspace-action-hover");
    const p = html("pixel");
    for (const c of ["bg-pixel-primary", "shadow-pixel", "enabled:hover:bg-pixel-hover"])
      expect(p).toContain(c);
    for (const v of ["tonal", "outlined"] as const)
      for (const c of ["bg-surface", "border-border", "text-text-primary"])
        expect(html(v)).toContain(c);
    expect(html("danger")).toContain("bg-danger-tint text-danger");
    for (const v of ["filled", "pixel", "tonal", "outlined", "text", "danger"] as const)
      expect(html(v)).toContain(`data-variant="${v}"`);
  });
  it("every size is 44 px, rounded-lg, label type; no heavy weights", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const h = r(<Button size={size}>x</Button>);
      for (const c of ["min-h-control", "rounded-lg", "text-label"]) expect(h).toContain(c);
      for (const c of ["rounded-full", "font-bold", "font-extrabold", "text-["])
        expect(h).not.toContain(c);
    }
    expect(r(<Button size="lg">x</Button>)).toContain("min-h-12");
  });
  it("disabled has no hover or pointer-events block", () => {
    const h = r(<Button disabled>x</Button>);
    for (const c of ["disabled:opacity-50", "disabled:cursor-not-allowed", "disabled:shadow-none"])
      expect(h).toContain(c);
    expect(h).not.toContain("pointer-events-none");
    for (const v of ["filled", "pixel", "tonal", "text"] as const)
      for (const c of classes(html(v), "button").filter((c) => c.includes("hover:")))
        expect(c.startsWith("enabled:") || c.startsWith("hover:")).toBe(true);
    expect(classes(html("filled"), "button").some((c) => /^hover:/.test(c))).toBe(false);
  });
});

describe("IconButton", () => {
  it("is a 44 px square with label, no inline style", () => {
    const h = r(<IconButton icon="search" label="Search" />);
    expect(h).toContain("size-control");
    expect(h).toContain("rounded-lg");
    expect(h).toContain('aria-label="Search"');
    expect(h).toContain('title="Search"');
    expect(h.match(/<button[^>]*>/)![0]).not.toContain("style=");
    expect(r(<IconButton icon="search" label="Search" active />)).toContain("border-border");
  });
});

describe("FilterChips and Chip", () => {
  it("radios are 44 px; the checked one is filled with the action colour", () => {
    const h = r(
      <FilterChips
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
        value="a"
        onChange={() => {}}
        ariaLabel="F"
      />,
    );
    expect(h).toContain('role="radiogroup"');
    const radios = h.match(/<button[^>]*role="radio"[^>]*>/g)!;
    expect(radios).toHaveLength(2);
    for (const c of ["min-h-control", "rounded-md", "text-label"])
      for (const b of radios) expect(b).toContain(c);
    expect(radios[0]).toContain("bg-workspace-action text-on-action");
    expect(radios[1]).not.toContain("bg-workspace-action");
  });
  it("Chip is a 6 px tag with token defaults; given colours pass through", () => {
    const h = r(<Chip label="G" />);
    for (const c of ["rounded-md", "text-caption", "border-divider"]) expect(h).toContain(c);
    expect(h).toContain("var(--color-canvas)");
    expect(h).toContain("var(--color-text-primary)");
    expect(r(<Chip label="G" color="#123456" onColor="#fff" />)).toContain("#123456");
  });
});

describe("Card", () => {
  it("uses card tokens; interactive darkens the border", () => {
    const h = r(<Card>x</Card>);
    for (const c of ["rounded-xl", "border-divider", "bg-surface", "shadow-card"])
      expect(h).toContain(c);
    expect(h).not.toContain("hover:border-border-strong");
    expect(r(<Card interactive>x</Card>)).toContain("hover:border-border-strong");
  });
});

describe("RoleBadge classes", () => {
  it("each tier has its token classes and no inline style", () => {
    const want = {
      user: "border-border bg-canvas text-text-secondary",
      manager: "border-info/40 bg-info-tint text-info",
      admin: "border-transparent bg-text-primary text-surface",
    } as const;
    for (const t of TIERS) {
      const h = r(<RoleBadge tier={t} />);
      expect(h).toContain(want[t]);
      for (const c of ["rounded-sm", "text-caption", "uppercase"]) expect(h).toContain(c);
      expect(h).not.toContain("style=");
    }
  });
});

describe("EntityFormDialog tokens", () => {
  const base = { title: "T", submitLabel: kitCopy.save, onClose() {}, onSubmit() {} };
  it("dialog and footer buttons follow the brief", () => {
    const h = r(
      <EntityFormDialog open {...base}>
        <span />
      </EntityFormDialog>,
    );
    for (const c of ["rounded-2xl", "shadow-dialog", "bg-surface", "max-w-md"])
      expect(h).toContain(c);
    expect(h).toMatch(/<button[^>]*type="submit"[^>]*data-variant="filled"/);
    expect(h).toMatch(/<button[^>]*data-variant="tonal"/);
    const busy = r(
      <EntityFormDialog open {...base} submitting>
        <span />
      </EntityFormDialog>,
    );
    expect(busy).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
  it("fields: strong border, ring on the box, label captions", () => {
    const boxes = [
      r(<DialogField label="L" icon="search" />),
      r(
        <DialogSelect label="L" icon="search">
          <option>a</option>
        </DialogSelect>,
      ),
      r(<FilledInput aria-label="x" />),
    ];
    boxes.forEach((h, i) => {
      for (const c of [
        "field-box",
        "border-border-strong",
        "rounded-lg",
        i < 2 ? "min-h-control" : "h-12",
      ])
        expect(h).toContain(c);
      expect(h).not.toContain("focus-within:");
    });
    expect(boxes[0]).toContain("text-label text-text-primary");
  });
});

describe("StatTile and auth fields", () => {
  it("StatTile uses label and title type", () => {
    const h = r(<StatTile icon="search" label="L" value="1" />);
    expect(h).toContain("text-label");
    expect(h).toContain("text-title");
    expect(h).not.toContain("text-h2");
  });
  it("Field, toggle and Notice use label/caption type and 44 px rows", () => {
    const f = r(
      <Field
        id="a"
        label="L"
        icon="mail"
        error="Bad"
        type="text"
        autoComplete="off"
        value=""
        onChange={() => {}}
      />,
    );
    expect(f).toMatch(/<label[^>]*class="text-label[^"]*"/);
    expect(f).toMatch(/<small[^>]*class="text-caption text-danger"/);
    expect(r(<ShowPasswordToggle checked={false} onChange={() => {}} />)).toContain(
      "min-h-control",
    );
    const n = r(<Notice kind="error">x</Notice>);
    expect(n).toContain("bg-danger-tint");
    expect(n).toContain('role="alert"');
  });
});

describe("no legacy alias or weight in the kit", () => {
  it("renders every kit component without legacy classes", () => {
    const noop = () => {};
    const els: React.ReactElement[] = [
      ...(["filled", "pixel", "tonal", "outlined", "text", "danger"] as const).map((v) => (
        <Button key={v} variant={v}>
          x
        </Button>
      )),
      <IconButton key="ib" icon="search" label="s" active />,
      <FilterChips
        key="fc"
        options={[{ value: "a", label: "A" }]}
        value="a"
        onChange={noop}
        ariaLabel="f"
      />,
      <Chip key="c" label="c" />,
      ...(["accent", "neutral", "success", "warning", "danger", "info"] as const).map((t) => (
        <Pill key={t} label="p" tone={t} />
      )),
      <Card key="card" interactive>
        x
      </Card>,
      <SectionCard key="sc" headingId="h" title="t" subtitle="s" icon="search" footer="f">
        x
      </SectionCard>,
      <FilledInput key="fi" aria-label="x" trailingIcon="search" />,
      <EntityFormDialog
        key="d"
        open
        title="T"
        submitLabel="S"
        onClose={noop}
        onSubmit={noop}
        error="e"
      >
        <DialogField label="L" icon="search" />
        <DialogSelect label="L" icon="search">
          <option>a</option>
        </DialogSelect>
      </EntityFormDialog>,
      ...TIERS.map((t) => <RoleBadge key={t} tier={t} />),
      <SegmentedFilter
        key="sf"
        options={[{ value: "a", label: "A" }]}
        value="a"
        onChange={noop}
        ariaLabel="s"
      />,
      <TabBar
        key="tb"
        tabs={[{ id: "a", label: "A" }]}
        active="a"
        onSelect={noop}
        ariaLabel="t"
        tabIdOf={(i) => i}
        panelIdOf={(i) => i}
      />,
      <FormFooterBar
        key="ff"
        status={{ tone: "saved", text: "t", detail: "d" }}
        cancelLabel="c"
        saveLabel="s"
        busyLabel="b"
        canCancel
        canSave
        busy={false}
        onCancel={noop}
      />,
      <PageHeader key="ph" title="t" subtitle="s" />,
      <PageSkeleton key="ps" title="t" emptyText="e" icon="search" />,
      <StatTile key="st" icon="search" label="l" value="1" />,
      <Field
        key="f"
        id="a"
        label="L"
        icon="mail"
        error="e"
        type="text"
        autoComplete="off"
        value=""
        onChange={noop}
      />,
      <Notice key="n1" kind="error">
        x
      </Notice>,
      <Notice key="n2" kind="info">
        x
      </Notice>,
    ];
    for (const el of els) {
      const html = r(el);
      for (const [, list] of html.matchAll(/class="([^"]*)"/g))
        for (const c of list.split(/\s+/)) {
          expect(c, c).not.toMatch(LEGACY);
          expect(["font-bold", "font-extrabold"]).not.toContain(c);
        }
    }
  });
});
