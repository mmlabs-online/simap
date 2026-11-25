import { describe, expect, it } from "vitest";
import { spriteFieldView } from "./device-type-sprite";

describe("spriteFieldView", () => {
  it("built-in option first, previewing the slot's own frame; the families follow", () => {
    const v = spriteFieldView({ value: null, slot: "laptop", imageShown: false });
    expect(v.options[0]).toEqual({ value: null, preview: "device.laptop.s", checked: true });
    expect(v.options.slice(1).map((o) => o.value)).toEqual([
      "device.laptop",
      "device.monitor",
      "device.monitor.dual",
      "device.other",
      "device.pc",
      "device.phone",
    ]);
    expect(v.options.filter((o) => o.checked)).toHaveLength(1);
    expect(v.options.find((o) => o.value === "device.monitor")!.preview).toBe("device.monitor.s");
    expect(v.unavailable).toBeNull();
  });

  it("hiddenByImage only with a pick and an image", () => {
    expect(
      spriteFieldView({ value: "device.pc", slot: "pc", imageShown: true }).hiddenByImage,
    ).toBe(true);
    expect(spriteFieldView({ value: null, slot: "pc", imageShown: true }).hiddenByImage).toBe(
      false,
    );
    expect(
      spriteFieldView({ value: "device.pc", slot: "pc", imageShown: false }).hiddenByImage,
    ).toBe(false);
  });

  it("an unknown stored family is unavailable and checks no option", () => {
    const v = spriteFieldView({ value: "device.printer", slot: "pc", imageShown: false });
    expect(v.unavailable).toBe("device.printer");
    expect(v.options.some((o) => o.checked)).toBe(false);
  });
});
