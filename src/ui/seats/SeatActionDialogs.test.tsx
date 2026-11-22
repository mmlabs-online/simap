import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seatsCopy } from "../copy/seats";
import { AddSeatsDialog } from "./AddSeatsDialog";
import { ConfirmSeatDialog } from "./ConfirmSeatDialog";

const confirm = (open: boolean) =>
  renderToStaticMarkup(
    <ConfirmSeatDialog
      open={open}
      title={seatsCopy.actions.deleteTitle("Phòng-Ân-01")}
      body={seatsCopy.actions.deleteBody}
      submitLabel={seatsCopy.actions.deleteSubmit}
      submitting={false}
      onClose={() => {}}
      onConfirm={() => {}}
    />,
  );

describe("seat dialogs", () => {
  it("closed renders nothing", () => {
    expect(confirm(false)).toBe("");
    expect(
      renderToStaticMarkup(
        <AddSeatsDialog open={false} submitting={false} onClose={() => {}} onAdd={() => {}} />,
      ),
    ).toBe("");
  });
  it("confirm shows the seat code and puts Cancel before submit", () => {
    const html = confirm(true);
    expect(html).toContain("Phòng-Ân-01");
    expect(html.indexOf("Cancel")).toBeGreaterThan(-1);
    expect(html.indexOf("Cancel")).toBeLessThan(html.lastIndexOf(seatsCopy.actions.deleteSubmit));
  });
  it("confirm body clips a long name", () => {
    const html = renderToStaticMarkup(
      <ConfirmSeatDialog
        open
        title="t"
        body={"Â".repeat(500)}
        submitLabel="s"
        submitting={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(html).toMatch(/max-h-32[^"]*overflow-hidden/);
  });
  it("count field is text with numeric input mode and no browser validation", () => {
    const html = renderToStaticMarkup(
      <AddSeatsDialog open submitting={false} onClose={() => {}} onAdd={() => {}} />,
    );
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toMatch(/required|min=|max=|maxLength/);
  });
});
