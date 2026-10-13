import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineNode, isoDate } from "../../src/index.js";
import { readableFields } from "../../src/words.js";

/**
 * A GLANCE SAYS A DAY AS IT IS READ. A board drawn by asking ("Show tasks
 * as a board by day") printed every card's date as the record stores it —
 * "DUE 2026-08-28" — on a card a person reads at a glance. The glance says
 * "Aug 28, 2026". So do a record's facts now: the day as it is written is
 * kept for the edit control alone (`stored`), which writes it back.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), due: isoDate.optional() }), plural: "Tasks" });
const node = { id: "t1", kind: "task", label: "Pay the deposit", due: "2026-08-28" };

describe("a day on a glance", () => {
  it("is said as a person reads it", () => {
    expect(readableFields(node, task, { glance: true }).find((field) => field.key === "due")?.value).toBe("Aug 28, 2026");
  });

  it("is said so in a record's facts too, and kept as it is written for the edit control", () => {
    const due = readableFields(node, task).find((field) => field.key === "due");
    expect(due?.value).toBe("Aug 28, 2026");
    expect(due?.stored).toBe("2026-08-28");
  });

  it("is said in the app's locale, the day first in en-GB, and a moment with its time (FR-178)", () => {
    expect(readableFields(node, task, { glance: true, locale: "en-GB" }).find((field) => field.key === "due")?.value).toMatch(/^28 Aug 2026$/);
    const at = defineNode("visit", { fields: z.object({ label: z.string(), at: z.string() }), plural: "Visits" });
    expect(readableFields({ id: "v1", kind: "visit", label: "Vet", at: "2026-08-28T15:30" }, at).find((field) => field.key === "at")?.value).toBe("Aug 28, 2026, 3:30 PM");
  });
});
