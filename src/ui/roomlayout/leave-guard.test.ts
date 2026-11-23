import { describe, expect, it } from "vitest";
import {
  attachLeaveGuard,
  leaveDecision,
  leaveHref,
  onBeforeUnload,
  type LeaveEvent,
  type PageLocation,
} from "./leave-guard";

const loc: PageLocation = {
  origin: "https://simap.test",
  pathname: "/rooms/C1/edit",
  search: "",
};

const anchor = (href: string, extra: Record<string, unknown> = {}) => ({
  href,
  target: "",
  hasAttribute: () => false,
  ...extra,
});
const ev = (a: unknown, over: Partial<LeaveEvent> = {}): LeaveEvent => ({
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  target: { closest: () => a },
  ...over,
});

describe("leave guard", () => {
  it("onBeforeUnload calls preventDefault and sets returnValue", () => {
    let prevented = false;
    const e = {
      returnValue: undefined as unknown,
      preventDefault: () => {
        prevented = true;
      },
    };
    onBeforeUnload(e);
    expect(prevented).toBe(true);
    expect(e.returnValue).toBe("");
  });

  it("leaveHref returns the href of a same-origin <a> found via closest()", () => {
    expect(leaveHref(ev(anchor("https://simap.test/rooms/C1?x=1#h")), loc)).toBe("/rooms/C1?x=1#h");
  });

  it("leaveHref ignores: non-left button, ctrl/meta/shift/alt click, defaultPrevented, target=_blank, download, other origin, same-page #hash, no anchor", () => {
    const a = anchor("https://simap.test/rooms");
    expect(leaveHref(ev(a, { button: 1 }), loc)).toBeNull();
    for (const k of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
      expect(leaveHref(ev(a, { [k]: true }), loc)).toBeNull();
    }
    expect(leaveHref(ev(a, { defaultPrevented: true }), loc)).toBeNull();
    expect(leaveHref(ev(anchor("https://simap.test/x", { target: "_blank" })), loc)).toBeNull();
    const download = anchor("https://simap.test/x", {
      hasAttribute: (n: string) => n === "download",
    });
    expect(leaveHref(ev(download), loc)).toBeNull();
    expect(leaveHref(ev(anchor("https://other.test/rooms")), loc)).toBeNull();
    expect(leaveHref(ev(anchor("https://simap.test/rooms/C1/edit#top")), loc)).toBeNull();
    expect(leaveHref(ev(null), loc)).toBeNull();
    expect(leaveHref(ev(undefined, { target: null }), loc)).toBeNull();
  });

  const fakes = () => {
    const log: string[] = [];
    const handlers: Record<string, (e: never) => void> = {};
    const target = (name: string) => ({
      addEventListener: (type: string, fn: (e: never) => void, capture?: boolean) => {
        log.push(`add ${name} ${type} ${capture === true}`);
        handlers[`${name}:${type}`] = fn;
      },
      removeEventListener: (type: string, fn: (e: never) => void, capture?: boolean) => {
        log.push(`remove ${name} ${type} ${capture === true}`);
        expect(handlers[`${name}:${type}`]).toBe(fn);
      },
    });
    return { log, handlers, win: { ...target("win"), location: loc }, doc: target("doc") };
  };

  it("attachLeaveGuard adds beforeunload on window and a capture-phase click on document; detach removes both", () => {
    const f = fakes();
    const detach = attachLeaveGuard(f.win, f.doc, () => {});
    expect(f.log).toEqual(["add win beforeunload false", "add doc click true"]);
    detach();
    expect(f.log.slice(2)).toEqual(["remove win beforeunload false", "remove doc click true"]);
  });

  it("the click listener prevents default, stops propagation and calls onLink(href) for a guarded link; leaves other clicks alone", () => {
    const f = fakes();
    const links: string[] = [];
    attachLeaveGuard(f.win, f.doc, (h) => links.push(h));
    const click = f.handlers["doc:click"] as (e: unknown) => void;
    const calls: string[] = [];
    const mk = (a: unknown) => ({
      ...ev(a),
      preventDefault: () => calls.push("prevent"),
      stopPropagation: () => calls.push("stop"),
    });
    click(mk(anchor("https://simap.test/rooms")));
    expect(links).toEqual(["/rooms"]);
    expect(calls).toEqual(["prevent", "stop"]);
    click(mk(anchor("https://other.test/")));
    click(mk(null));
    expect(links).toEqual(["/rooms"]);
    expect(calls).toHaveLength(2);
  });

  it("leaveDecision: clean goes, dirty asks", () => {
    expect(leaveDecision(false)).toBe("go");
    expect(leaveDecision(true)).toBe("ask");
  });
});
