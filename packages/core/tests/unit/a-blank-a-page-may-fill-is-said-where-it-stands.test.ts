import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineNode } from "../../src/index.js";
import { readableFields } from "../../src/words.js";

/**
 * A BLANK A PAGE MAY FILL IS SAID WHERE IT STANDS (Roadmap
 * request:record-pages-draw-writable-but-blank-facts-as-empty-editable-slots):
 * asked for by `blanks`, a field with no value reads as an empty slot — its
 * label, no value — in the order the kind's page declares, never on a glance,
 * and a blank nobody asked for is still not said.
 */
const placement = defineNode("placement", {
  fields: z.object({ label: z.string(), allocation: z.number().optional(), role: z.enum(["lead", "support"]).optional(), source: z.string().optional(), notes: z.string().optional() }),
  label: (node) => node.label,
  display: { page: { fields: ["role", "notes", "allocation"] } },
});
const node = { id: "p4", kind: "placement", label: "Placement 4", notes: "Starts Monday", source: "" };

describe("a blank a page may fill", () => {
  it("is said as an empty slot in the page's declared order", () => {
    const fields = readableFields(node, placement as never, { blanks: ["allocation", "role"] });
    expect(fields.map((field) => [field.key, field.blank ?? false, field.value])).toEqual([
      ["role", true, ""],
      ["notes", false, "Starts Monday"],
      ["allocation", true, ""],
      ["source", false, ""],
    ]);
    expect(fields.find((field) => field.key === "allocation")?.label).toBe("Allocation");
  });

  it("is not said when nobody asked for it, nor on a glance", () => {
    expect(readableFields(node, placement as never).some((field) => field.blank)).toBe(false);
    expect(readableFields(node, placement as never, { blanks: ["allocation"], glance: true }).some((field) => field.blank)).toBe(false);
  });
});
