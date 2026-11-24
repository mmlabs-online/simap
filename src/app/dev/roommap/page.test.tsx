import { afterEach, describe, expect, it, vi } from "vitest";

const loaded = vi.hoisted(() => ({ count: 0 }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("./RoomMapDemo", () => {
  loaded.count += 1;
  return { RoomMapDemo: () => null };
});

import DevRoomMapPage from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("dev room map page", () => {
  it("production calls notFound and never loads the demo", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevRoomMapPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loaded.count).toBe(0);
  });

  it("test mode is not development either", async () => {
    vi.stubEnv("NODE_ENV", "test");
    await expect(DevRoomMapPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loaded.count).toBe(0);
  });

  it("development renders the demo", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const element = await DevRoomMapPage();
    expect(element).toBeTruthy();
    expect(loaded.count).toBe(1);
  });
});
