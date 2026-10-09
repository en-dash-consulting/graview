import { createSchema, defineNode, pluralLabel, pluralOf, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { kindMap } from "../../src/facts.js";
import { pluralOf as pagesPluralOf } from "../../src/page-typography.js";

/*
 * A KIND WITH NO DECLARED PLURAL IS CALLED ONE WAY: its name and an "s", as
 * the routed face addresses its list — "tasks" inside a sentence, "Tasks"
 * standing alone as a label. The relation key, the module switch's
 * sentence and the road map said the bare kind ("task").
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }) });
const crew = defineNode("crew", { plural: "Crews", fields: z.object({ label: z.string() }) });
const schema = createSchema([task, crew]);
const store = new Store<AnySchema>({ schema: schema as AnySchema, mutations: [] as never, modules: { work: { kinds: ["task"] } } as never });

describe("a kind without a declared plural", () => {
  it("is called its name and an s by the one rule, and by the routed face", () => {
    expect(pluralOf(schema, "task")).toBe("tasks");
    expect(pluralOf(schema, "crew")).toBe("Crews");
    expect(pluralLabel(schema, "task")).toBe("Tasks");
    expect(pluralLabel(schema, "crew")).toBe("Crews");
    expect(pagesPluralOf(store, "task")).toBe("Tasks");
  });

  it("stands as a label on the routed face's map of kinds", () => {
    expect(kindMap(store).kinds.find((one) => one.kind === "task")?.plural).toBe("Tasks");
  });

  it("is said inside a sentence when a module that holds it is turned off", () => {
    const op = store.setEnabledModules([]);
    expect(JSON.stringify(op)).toContain("Turn off tasks");
  });
});
