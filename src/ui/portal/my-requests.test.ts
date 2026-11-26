import { describe, expect, it } from "vitest";
import { REQUEST_STATUSES, type MyRequestDto, type RequestStatus } from "@/lib/requests/types";
import { REQUEST_FILTERS, countLabel, filterRequests, requestStatusLook } from "./my-requests";

const item = (id: string, status: RequestStatus) => ({ id, status }) as MyRequestDto;

describe("my-requests", () => {
  it("REQUEST_FILTERS is all, pending, approved, rejected, cancelled and covers every REQUEST_STATUSES entry", () => {
    expect([...REQUEST_FILTERS]).toEqual(["all", "pending", "approved", "rejected", "cancelled"]);
    for (const s of REQUEST_STATUSES) expect(REQUEST_FILTERS).toContain(s);
  });
  it('filterRequests: "all" returns every item in the original order; each status keeps only that status; [] → []; no match → []', () => {
    const items = [
      item("1", "pending"),
      item("2", "approved"),
      item("3", "pending"),
      item("4", "cancelled"),
    ];
    expect(filterRequests(items, "all").map((i) => i.id)).toEqual(["1", "2", "3", "4"]);
    expect(filterRequests(items, "pending").map((i) => i.id)).toEqual(["1", "3"]);
    expect(filterRequests(items, "cancelled").map((i) => i.id)).toEqual(["4"]);
    expect(filterRequests([], "pending")).toEqual([]);
    expect(filterRequests(items, "rejected")).toEqual([]);
  });
  it("requestStatusLook maps approved → check/success, pending → history/warning, rejected → close/danger, cancelled → block/neutral", () => {
    expect(requestStatusLook("approved")).toEqual({ icon: "check", tone: "success" });
    expect(requestStatusLook("pending")).toEqual({ icon: "history", tone: "warning" });
    expect(requestStatusLook("rejected")).toEqual({ icon: "close", tone: "danger" });
    expect(requestStatusLook("cancelled")).toEqual({ icon: "block", tone: "neutral" });
  });
  it('countLabel(5,false) = "5"; countLabel(50,true) = "50+"; countLabel(0,false) = "0"', () => {
    expect(countLabel(5, false)).toBe("5");
    expect(countLabel(50, true)).toBe("50+");
    expect(countLabel(0, false)).toBe("0");
  });
});
