import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, createViewRegistry, defineNode } from "../../src/index.js";

/**
 * A PLACE BESIDE THE KIND'S OWN PICTURES — a lens a reader kept from the
 * seat — is reached by its name and is never what the kind draws by
 * default; taken back, it leaves the kind's own picture where it was.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const cell = { cardinality: "many", fidelity: "full" } as const;

describe("a place registered beside", () => {
  it("is a place by its name, and takes no kind's default picture", () => {
    const registry = createViewRegistry<typeof schema, string>(schema);
    registry.register("task", cell, "the week", { title: "The week" });
    registry.register("task", cell, "kept", { title: "Tasks by day", beside: true });
    expect(registry.places().map((place) => place.title)).toEqual(["The week", "Tasks by day"]);
    expect(registry.resolve("task", cell)?.view).toBe("the week");
    expect(registry.resolve("task", cell, "tasks-by-day")?.view).toBe("kept");
  });

  it("is forgotten by its name, and the kind's own picture stays", () => {
    const registry = createViewRegistry<typeof schema, string>(schema);
    registry.register("task", cell, "the week", { title: "The week" });
    registry.register("task", cell, "kept", { title: "Tasks by day", beside: true });
    registry.forget?.("task", "tasks-by-day");
    expect(registry.places().map((place) => place.title)).toEqual(["The week"]);
    expect(registry.resolve("task", cell, "tasks-by-day")?.view).toBe("the week");
    expect(registry.resolve("task", cell)?.view).toBe("the week");
  });
});
