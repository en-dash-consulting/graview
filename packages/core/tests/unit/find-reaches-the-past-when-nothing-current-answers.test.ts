import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, Store } from "../../src/index.js";
import { search } from "../../src/search.js";

/**
 * FIND REACHES THE PAST WHEN NOTHING CURRENT ANSWERS (the tenth walk).
 *
 * A rescue team has one callout under way and hundreds behind it. "Find
 * anything" for last March's callout by its number found nothing and said
 * "add is:any for the past" — the query language, to somebody who typed a
 * name. Where the words find no current record, the past ones they find
 * are the answer, each marked past, and the search says it looked there.
 * Where a current record answers, or the search says which horizon, it
 * keeps to what it was asked.
 */
const callout = defineNode("callout", {
  fields: z.object({ label: z.string(), status: z.enum(["open", "closed"]) }),
  lifecycle: { field: "status", retired: ["closed"] },
});
const schema = createSchema([callout]);
const team = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "now", kind: "callout", label: "2026/105 · Lost walker, Crib Ddu", status: "open" },
        { id: "march", kind: "callout", label: "2025/031 · Fallen climber, Crib Ddu", status: "closed" },
        { id: "june", kind: "callout", label: "2025/077 · Overdue party, Hollow Tor", status: "closed" },
      ] as never,
      edges: [],
    },
  });
const records = (found: ReturnType<typeof search>) => found.hits.filter((hit) => hit.about === "node").map((hit) => hit.id);

describe("Find and the horizon", () => {
  it("answers with the past records the words find when no current one answers, said as past", () => {
    const found = search(team(), "hollow tor");
    expect(records(found)).toEqual(["june"]);
    expect(found.hits.find((hit) => hit.about === "node")).toMatchObject({ current: false });
    expect(found.searched.past).toBe(true);
  });

  it("keeps to the current where one answers, and to what an is: condition asks", () => {
    const some = search(team(), "crib ddu");
    expect(records(some)).toEqual(["now"]);
    expect(some.searched.past).toBe(false);
    expect(records(search(team(), "hollow tor is:current"))).toEqual([]);
    expect(records(search(team(), "crib ddu is:any")).sort()).toEqual(["march", "now"]);
  });
});
