import { describe, expect, it } from "vitest";
import { escapeLike } from "./search";

describe("escapeLike", () => {
  it("escapes \\ % _ and leaves other text (incl. diacritics) unchanged", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    expect(escapeLike("Nguyễn Văn")).toBe("Nguyễn Văn");
    expect(escapeLike("")).toBe("");
  });
});
