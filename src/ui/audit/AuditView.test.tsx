import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AuditEntryDto } from "@/lib/audit/types";
import { apiCopy } from "../copy/api";
import { auditCopy } from "../copy/audit";
import { shellCopy } from "../copy/shell";
import { AuditView, type AuditViewProps } from "./AuditView";
import { EMPTY_FILTERS } from "./audit-state";

const noop = () => {};
const entry = (over: Partial<AuditEntryDto> & { id: string }): AuditEntryDto => ({
  actor: { sub: "11111111-aaaa", displayName: "Ann" },
  action: "room.update",
  entity: "room",
  entityId: "r1",
  meta: { code: "C1" },
  at: "2026-03-05T10:00:00.000000Z",
  ...over,
});
const render = (p: Partial<AuditViewProps> = {}) =>
  renderToStaticMarkup(
    <AuditView
      status="ready"
      items={[entry({ id: "1" })]}
      facets={{ actors: [{ sub: "11111111-aaaa", displayName: "Ann" }], entities: ["room"] }}
      filters={EMPTY_FILTERS}
      rangeInvalid={false}
      hasMore={false}
      loadingMore={false}
      errorCode={null}
      onFilters={noop}
      onReset={noop}
      onRetry={noop}
      onLoadMore={noop}
      {...p}
    />,
  );

describe("AuditView", () => {
  it("forbidden status shows no-access and no filters/table", () => {
    const html = render({ status: "forbidden" });
    expect(html).toContain(auditCopy.noAccess);
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<table");
  });
  it("loading shows aria-busy and no rows", () => {
    const html = render({ status: "loading", items: [] });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<table");
  });
  it("empty (no filters) vs empty with filters show different text", () => {
    expect(render({ items: [] })).toContain(shellCopy.pages.audit.empty);
    const f = render({ items: [], filters: { ...EMPTY_FILTERS, entity: "room" } });
    expect(f).toContain(auditCopy.emptyFiltered);
    expect(f).not.toContain(shellCopy.pages.audit.empty);
  });
  it("error shows apiErrorMessage text and a retry button", () => {
    const html = render({ status: "error", items: [], errorCode: "unavailable" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).toContain(auditCopy.retry);
  });
  it("ready renders rows in the given order with actor names and localized times", () => {
    const html = render({
      items: [
        entry({ id: "1", at: "2026-03-05T17:30:00.123456Z", action: "room.create" }),
        entry({ id: "2", actor: { sub: "x", displayName: "Bob" } }),
      ],
    });
    expect(html.indexOf("Ann")).toBeLessThan(html.indexOf("Bob"));
    expect(html).toContain("06 Mar 2026, 00:30");
    expect(html).toContain(auditCopy.actions["room.create"]);
    expect(html).not.toContain("font-pixel");
    for (const th of html.match(/<th [^>]*>/g) ?? []) expect(th).toContain("text-caption");
    expect(html).toContain("min-w-160");
    expect(html).not.toContain("text-[");
  });
  it("Vietnamese display name renders intact", () => {
    const html = render({
      items: [entry({ id: "1", actor: { sub: "s", displayName: "Nguyễn Văn Á" } })],
    });
    expect(html).toContain("Nguyễn Văn Á");
  });
  it("null displayName shows Unknown member plus first 8 chars of sub", () => {
    const html = render({
      items: [entry({ id: "1", actor: { sub: "abcdef123456", displayName: null } })],
      facets: { actors: [], entities: [] },
    });
    expect(html).toContain("Unknown member abcdef12");
  });
  it("null entityId and null meta render without 'null' or 'undefined' text", () => {
    const html = render({ items: [entry({ id: "1", entityId: null, meta: null })] });
    expect(html).not.toContain("null");
    expect(html).not.toContain("undefined");
  });
  it("meta containing <script> is escaped", () => {
    const html = render({
      items: [entry({ id: "1", meta: { note: "<script>alert(1)</script>" } })],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("Load more button only when hasMore; disabled while loadingMore", () => {
    expect(render()).not.toContain(auditCopy.loadMore);
    expect(render({ hasMore: true })).toContain(auditCopy.loadMore);
    const busy = render({ hasMore: true, loadingMore: true });
    expect(busy).toContain(auditCopy.loadingMore);
    expect(busy).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Loading/);
  });
  it("filter selects list facet options; selected values reflect state", () => {
    const html = render({ filters: { ...EMPTY_FILTERS, entity: "room", fromDay: "2026-03-05" } });
    expect(html).toContain('<option value="11111111-aaaa">Ann</option>');
    expect(html).toContain('<option value="room" selected="">room</option>');
    expect(html).toContain('value="2026-03-05"');
  });
});
