import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formFields, formComplete, isoDate, nodeRef } from "../../src/index.js";

/**
 * Forms derive from the mutation's own declaration — the whole tree, not
 * just scalars. This is what makes "New agreement" renderable on a page
 * when its spec is a discriminated union.
 */
describe("formFields", () => {
  it("describes scalars, dates, refs and optionality", () => {
    const input = z.object({
      label: z.string().min(1),
      due: isoDate.optional(),
      hours: z.number().min(0).max(80),
      plotId: nodeRef(["plot"]),
      urgent: z.boolean(),
      day: z.enum(["mon", "tue"]),
    });
    const fields = formFields(input);
    expect(fields).toEqual([
      { control: "text", name: "label", optional: false },
      { control: "date", name: "due", optional: true },
      { control: "number", name: "hours", optional: false, min: 0, max: 80 },
      { control: "node", name: "plotId", optional: false, kinds: ["plot"] },
      { control: "boolean", name: "urgent", optional: false },
      { control: "choice", name: "day", optional: false, options: ["mon", "tue"] },
    ]);
    expect(formComplete(fields)).toBe(true);
  });

  it("renders a discriminated union as a type picker then that type's fields", () => {
    // The household example's constraint spec, the canonical structured argument.
    const spec = z.union([
      z.object({ type: z.literal("weekly-hour-cap"), maxHours: z.number() }),
      z.object({ type: z.literal("protected-block") }),
    ]);
    const [field] = formFields(z.object({ spec }));
    expect(field).toEqual({
      control: "variant",
      name: "spec",
      optional: false,
      tag: "type",
      options: [
        { value: "weekly-hour-cap", fields: [{ control: "number", name: "maxHours", optional: false }] },
        { value: "protected-block", fields: [] },
      ],
    });
    expect(formComplete([field!])).toBe(true);
  });

  it("nests objects as groups and arrays as repeatable rows", () => {
    const input = z.object({
      window: z.object({ from: isoDate, until: isoDate.optional() }),
      tags: z.array(z.string()),
    });
    const [window, tags] = formFields(input);
    expect(window?.control).toBe("group");
    if (window?.control !== "group") throw new Error("window is not a group");
    expect(window.fields).toHaveLength(2);
    expect(tags).toEqual({
      control: "list",
      name: "tags",
      optional: false,
      item: { control: "text", name: "tags", optional: false },
    });
  });

  it("says opaque rather than guessing, and formComplete reports it", () => {
    const input = z.object({ blob: z.union([z.string(), z.number()]) });
    const [field] = formFields(input);
    expect(field?.control).toBe("opaque");
    expect(formComplete(formFields(input))).toBe(false);
  });
});
