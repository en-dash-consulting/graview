import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, dayAsRead, daysAsRead, defineInvariant, defineNode, isoDate, readableFields, Store } from "../../src/index.js";
import { parseTemplate, renderTemplate } from "../../src/document/index.js";

/**
 * A SENTENCE SAYS A DAY, AND A CHOICE, AS A PERSON READS THEM.
 *
 * A rule written in code said "was due 2026-08-28" on the bar, in the
 * problems and to the seat, while the task's own card said "28 Aug 2026";
 * a record's facts said its day as it is kept; and a weekday kept as "tue"
 * was shown as the code it is kept as. The framework says every day it
 * puts in a sentence the way the glance does, and every choice as it is
 * declared; the edit control alone holds the stored value.
 */
const shift = defineNode("shift", {
  fields: z.object({ label: z.string(), on: isoDate.optional(), day: z.enum(["mon", "tue"]).optional(), size: z.enum(["small", "large"]).optional() }),
  plural: "Shifts",
  display: { format: { size: (value: unknown) => (value === "large" ? "Large crew" : "Small crew") } },
});
const schema = createSchema([shift]);
const node = { id: "s1", kind: "shift", label: "Morning", on: "2026-08-28", day: "tue", size: "large" };

describe("a day in a sentence", () => {
  it("is said as the glance says it, and only where it stands alone", () => {
    expect(dayAsRead("2026-08-28")).toBe("28 Aug 2026");
    expect(daysAsRead('"Pay the deposit" was due 2026-08-28')).toBe('"Pay the deposit" was due 28 Aug 2026');
    expect(daysAsRead("from 2026-09-01 to 2026-09-05.")).toBe("from 1 Sep 2026 to 5 Sep 2026.");
    // Part of an id, or a moment, is left as it is.
    expect(daysAsRead("task-2026-08-28 at 2026-08-28T09:00")).toBe("task-2026-08-28 at 2026-08-28T09:00");
  });

  it("is said so in a rule's message, however the rule wrote it", () => {
    const late = defineInvariant<typeof schema>("nothing-late", {
      scope: "graph",
      evaluate: () => [{ invariant: "nothing-late", label: "Nothing late", message: '"Morning" was due 2026-08-28', nodeIds: ["s1"], repairs: [] }],
    });
    const store = new Store({ schema, mutations: [], invariants: [late], snapshot: { nodes: [node] as never, edges: [] } });
    expect(store.violations().map((violation) => violation.message)).toEqual(['"Morning" was due 28 Aug 2026']);
  });

  it("is said so by a template, with or without `| date`", () => {
    const kinds = new Map();
    expect(renderTemplate(parseTemplate("was due {on}"), { node: node as never, kinds, today: "2026-09-01" })).toBe("was due 28 Aug 2026");
    expect(renderTemplate(parseTemplate("was due {on | date}"), { node: node as never, kinds, today: "2026-09-01" })).toBe("was due 28 Aug 2026");
  });
});

describe("a choice on a record", () => {
  it("is said as it is declared, else spoken — never the code it is kept as", () => {
    const fields = readableFields(node, shift);
    expect(fields.find((field) => field.key === "day")?.value).toBe("Tue");
    expect(fields.find((field) => field.key === "day")?.stored).toBe("tue");
    expect(fields.find((field) => field.key === "size")?.value).toBe("Large crew");
  });
});
