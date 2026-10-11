import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, isoDate, type Violation } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { openStore } from "../../src/index.js";

/**
 * A STORE IS JUDGED ON ITS HOST'S DAY (W-186). A rule about a day — a loan
 * back by its due date — reads `today` from its context, and keeps no clock
 * of its own. The browser apps handed one; `graview mcp`, `graview apply`
 * and `graview serve` opened their stores with none, so an agent at the
 * library's door saw nothing overdue where the pages listed nine. Ship's
 * `openStore` judges on the host's clock unless the host pins a day.
 */
const loan = defineNode("loan", { fields: z.object({ label: z.string(), due: isoDate }), plural: "Loans" });
const schema = createSchema([loan]);
const { defineInvariant } = bindSchema(schema);
const backOnTime = defineInvariant("back-on-time", {
  scope: { kind: "loan" },
  evaluate({ subject, context }): Violation[] {
    const today = typeof context["today"] === "string" ? context["today"] : undefined;
    return today && subject.due < today ? [{ invariant: "back-on-time", subjectId: subject.id, label: subject.label, message: `${subject.label} is overdue`, nodeIds: [subject.id], repairs: [] }] : [];
  },
});
const app = defineApp({ name: "library", schema, mutations: [], invariants: [backOnTime] });
const seed = { nodes: [{ id: "l1", kind: "loan", label: "Loan 0001", due: "2020-01-01" }], edges: [] };

describe("a store opened by a host that says no day", () => {
  it("is judged on the host's own day", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never });
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    expect(opened.store.today()).toBe(local);
    expect(opened.store.violations().map((violation) => violation.message)).toEqual(["Loan 0001 is overdue"]);
    opened.close();
  });

  it("keeps the day a host pins", async () => {
    const opened = await openStore({ app, adapter: createMemoryAdapter(), seed: seed as never, storeOptions: { invariantOptions: { context: { today: "2019-06-01" } } } });
    expect(opened.store.today()).toBe("2019-06-01");
    expect(opened.store.violations()).toEqual([]);
    opened.close();
  });
});
