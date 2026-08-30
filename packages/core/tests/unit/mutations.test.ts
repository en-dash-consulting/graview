import { describe, expect, it } from "vitest";
import { z } from "zod";
import { argShape } from "../../src/index.js";

describe("an argument says what sort of answer it wants", () => {
  /*
   * The affordance layer could offer candidate ids for a node reference and
   * nothing at all for anything else, so every action needing a name, a
   * date or a time was a dead end that looked live. The declaration always
   * knew; nobody had asked it.
   */
  const input = z.object({
    label: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
    at: z.number().int().min(0).max(1439),
    day: z.enum(["mon", "tue"]),
    note: z.string().optional(),
  });

  it("reads a plain string as free text", () => {
    expect(argShape(input, "label")).toEqual({ type: "text" });
  });

  it("recognises a date by its pattern, so the UI can offer a picker", () => {
    expect(argShape(input, "date")).toEqual({ type: "date" });
  });

  it("carries a number's declared bounds", () => {
    expect(argShape(input, "at")).toEqual({ type: "number", min: 0, max: 1439 });
  });

  it("turns an enum into the choices themselves", () => {
    expect(argShape(input, "day")).toEqual({ type: "choice", options: ["mon", "tue"] });
  });

  it("sees through optional, so a wrapped field still describes itself", () => {
    expect(argShape(input, "note")).toEqual({ type: "text" });
  });

  it("says so plainly when it cannot tell", () => {
    expect(argShape(input, "nope")).toEqual({ type: "unknown" });
  });
});
