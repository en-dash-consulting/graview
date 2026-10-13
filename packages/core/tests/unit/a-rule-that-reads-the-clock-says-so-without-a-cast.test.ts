import { describe, expect, it } from "vitest";
import { clockReaders } from "../../src/check.js";
import { bindSchema, createSchema, defineInvariant, defineNode, isoDate, Store, z } from "../../src/index.js";

/**
 * A RULE THAT READS THE CLOCK SAYS SO WITHOUT A CAST (the ninth walk, W-190).
 *
 * The graview-invariant skill says a rule that is a function "reads its
 * `today` argument and says `readsTheClock: true`". Written that way through
 * `bindSchema(schema).defineInvariant` — the way every scaffolded app writes
 * its rules — it did not compile: neither `defineInvariant` took the key, and
 * the framework's own test reached it only through `as never`. This file is
 * the criterion as much as its assertions are: `pnpm typecheck` compiles it.
 */
const hive = defineNode("hive", {
  fields: z.object({ label: z.string(), installed: isoDate }),
  label: (node) => node.label,
});
const schema = createSchema([hive]);
const { defineInvariant: defineBound, defineGraphInvariant } = bindSchema(schema);

const opened = defineBound("opened-lately", {
  scope: { kind: "hive" },
  readsTheClock: true,
  evaluate: ({ subject, today }) =>
    today && subject.installed < today ? [{ invariant: "opened-lately", subjectId: subject.id, label: subject.label, message: `${subject.label} wants opening`, nodeIds: [subject.id], repairs: [] }] : [],
});
const weekday = defineGraphInvariant("on-a-weekday", { readsTheClock: true, evaluate: () => [] });
const unbound = defineInvariant<typeof schema, "hive">("unbound", { scope: { kind: "hive" }, readsTheClock: true, evaluate: () => [] });

describe("a rule that reads the clock says so without a cast", () => {
  it("is named a clock reader, and judged on the day the store is ticked to", () => {
    expect(clockReaders(schema as never, [opened, weekday, unbound] as never).rules).toEqual(["opened-lately", "on-a-weekday", "unbound"]);
    const store = new Store({ schema, invariants: [opened], snapshot: { nodes: [{ id: "h1", kind: "hive", label: "Hive 1", installed: "2026-10-12" }], edges: [] } as never, invariantOptions: {} });
    store.tick("2026-10-12");
    expect(store.tick("2026-10-13").appeared.map((one) => one.message)).toEqual(["Hive 1 wants opening"]);
  });
});
