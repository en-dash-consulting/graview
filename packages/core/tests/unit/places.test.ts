import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, createViewRegistry, defineNode } from "../../src/index.js";

const person = defineNode("person", { fields: z.object({ label: z.string() }) });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }) });
const schema = createSchema([person, duty]);

describe("a titled group view is a place", () => {
  it("lists each titled many-view once, in registration order, and no one-views", () => {
    const registry = createViewRegistry<typeof schema, string>(schema)
      .register("duty", { cardinality: "many", fidelity: "full" }, "board", { title: "Where the runs are" })
      .register("duty", { cardinality: "many", fidelity: "summary" }, "board", { title: "Where the runs are" })
      .register("person", { cardinality: "one", fidelity: "full" }, "card", { title: "Not a place" })
      .register("person", { cardinality: "many", fidelity: "full" }, "grid", { title: "Who does what" });
    expect(registry.places()).toEqual([
      { kind: "duty", title: "Where the runs are" },
      { kind: "person", title: "Who does what" },
    ]);
    expect(registry.all().find((entry) => entry.kind === "duty")?.title).toBe("Where the runs are");
  });

  it("has none for an untitled registry", () => {
    const registry = createViewRegistry<typeof schema, string>(schema).register(
      "person",
      { cardinality: "many", fidelity: "full" },
      "grid",
    );
    expect(registry.places()).toEqual([]);
  });
});
