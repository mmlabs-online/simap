import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VI_LOWER, VI_UPPER } from "@/lib/device-types/name";
import { DEVICE_KINDS, DEVICE_TYPE_LIMITS, SEED_DEVICE_TYPES } from "@/lib/device-types/types";
import { DRIVE_ID_RE } from "@/server/drive/config";

const sql = readFileSync(
  path.resolve(process.cwd(), "db/migrations/20261124160000_device_types.sql"),
  "utf8",
);

describe("device_types migration equals the TS constants", () => {
  it("VI map, slot list, seed list, name max and Drive id regex", () => {
    expect(sql).toContain(`'${VI_UPPER}'`);
    expect(sql).toContain(`'${VI_LOWER}'`);
    const slots = /slot in \(([^)]*)\)/.exec(sql)![1]!;
    expect([...slots.matchAll(/'(\w+)'/g)].map((m) => m[1])).toEqual([...DEVICE_KINDS]);
    const seed = [...sql.matchAll(/\(p_org, '([^']+)', '(\w+)'\)/g)].map((m) => ({
      name: m[1],
      slot: m[2],
    }));
    expect(seed).toEqual(SEED_DEVICE_TYPES);
    expect(sql).toContain(`char_length(name) <= ${DEVICE_TYPE_LIMITS.name}`);
    expect(sql).toContain(`'${DRIVE_ID_RE.source}'`);
  });
});
