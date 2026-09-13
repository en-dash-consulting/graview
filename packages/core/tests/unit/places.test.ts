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
      { kind: "duty", title: "Where the runs are", as: "where-the-runs-are" },
      { kind: "person", title: "Who does what", as: "who-does-what" },
    ]);
    expect(registry.all().find((entry) => entry.kind === "duty")?.title).toBe("Where the runs are");
  });

  /*
   * A KIND MAY HAVE SEVERAL PICTURES. The week and the month are two
   * questions about one pile of tasks, and until a place could be addressed
   * a kind could only ever have one answer: the second registration simply
   * replaced the first and the first became unreachable.
   */
  it("lists every picture of one kind, and resolves each by name", () => {
    const registry = createViewRegistry<typeof schema, string>(schema)
      .register("duty", { cardinality: "many", fidelity: "full" }, "month", { title: "The month" })
      .register("duty", { cardinality: "many", fidelity: "full" }, "week", { title: "The week" });
    expect(registry.places().map((place) => place.as)).toEqual(["the-month", "the-week"]);
    const cell = { cardinality: "many", fidelity: "full" } as const;
    expect(registry.resolve("duty", cell, "the-month")?.view).toBe("month");
    expect(registry.resolve("duty", cell, "the-week")?.view).toBe("week");
    // The last registration is what the cell itself draws, as it always was.
    expect(registry.resolve("duty", cell)?.view).toBe("week");
    // And an address naming a picture that has since been renamed lands
    // somewhere rather than drawing nothing.
    expect(registry.resolve("duty", cell, "the-fortnight")?.view).toBe("week");
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
