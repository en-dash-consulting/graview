import { createSchema, defineNode, Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jevDecide, jevKeyFromEnvironment, JEV_MODEL } from "../../src/providers/jev.js";
import { dream } from "../../src/tidy.js";

/*
 * THE DREAM, ASKED OF JEV ITSELF. Opt-in: it runs only where
 * TYPESAFE_API_KEY is set, and asserts only what a live model's answers
 * must be — typed, in range, said in words — never which way it judged.
 */
const key = jevKeyFromEnvironment();

const vendor = defineNode("vendor", {
  description: "A business the wedding buys from.",
  fields: z.object({ label: z.string(), email: z.string().optional(), tier: z.enum(["preferred", "backup"]).optional() }),
});
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]), notes: z.string().optional(), closedOn: z.string().optional() }),
  edges: { vendor: { to: ["vendor"], cardinality: "one", description: "who supplies it" } },
  fieldRoles: { end: "closedOn" },
});

describe.skipIf(!key)("a dream judged by Jev, live", () => {
  it("answers every request with typed judgments in range, each said in words with the model named", async () => {
    const store = new Store<AnySchema>({
      schema: createSchema([vendor, task]),
      snapshot: {
        nodes: [
          { id: "vendor:acme", kind: "vendor", label: "Acme Corp", email: "sales@acme.example" },
          { id: "vendor:acme-2", kind: "vendor", label: "ACME Corporation", email: "SALES@acme.example" },
          { id: "vendor:harbor", kind: "vendor", label: "Harbor Catering", tier: "preferred" },
          { id: "task:order", kind: "task", label: "Order the chairs", status: "todo", notes: "Harbor Catering said they can bring them" },
          { id: "task:old", kind: "task", label: "Book the hall", status: "done", closedOn: "2026-01-10" },
        ] as never,
        edges: [],
      },
    });
    const report = await dream(store, { now: "2026-10-22T09:00:00.000Z", model: { model: JEV_MODEL, decide: jevDecide({ apiKey: key! }) }, cache: false, budget: { requests: 6 } });
    expect(report.model).toMatchObject({ name: JEV_MODEL, answered: true });
    expect(report.model!.error).toBeUndefined();
    expect(report.usage!.requests).toBeGreaterThan(0);
    expect(report.usage!.requests).toBeLessThanOrEqual(6);
    const judged = report.outcomes.filter((one) => one.model === JEV_MODEL);
    expect(judged.length).toBeGreaterThan(0);
    for (const one of judged) {
      expect(one.confidence).toBeGreaterThanOrEqual(0);
      expect(one.confidence).toBeLessThanOrEqual(1);
      expect(one.basis).toMatch(/^Jev: /);
      expect(["suggested", "applied", "dropped", "waiting", "declined", "refused"]).toContain(one.outcome);
    }
  }, 120_000);
});
