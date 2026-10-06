import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, createViewRegistry, defineApp, defineNode } from "../../src/index.js";
import { describeApp } from "../../src/check.js";
import { withViews } from "../../src/cli/index.js";

/**
 * F-042: NOTHING OUTSIDE A BROWSER COULD SEE WHAT IS DRAWN, AND NO APP
 * COULD FIX IT. The registry is React and the declaration is not, so
 * `defineApp({ views })` was an instruction nobody could follow. The
 * pictures are still a module: `--views` names it, and the CLI reads the
 * registry without rendering. The note, meanwhile, says it is the design.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([task, note]);
const app = defineApp({ name: "things", schema });
// `withViews` reads any app, so it takes one widened the way the CLI holds it.
const loaded = app;

describe("the pictures, from where they live", () => {
  it("says the design rather than reading as neglect, and names the flag", () => {
    const said = describeApp(app);
    expect(said).toContain("that is the design, not neglect");
    expect(said).toContain("--views ./dist/ui/views.js");
    expect(said).not.toContain("defineApp({ views })");
  });

  it("takes a module exporting views — a registry, or a function that builds one — and reads the drive-ins out", () => {
    const registry = createViewRegistry(schema).register("task", { cardinality: "many", fidelity: "full" }, () => null, { title: "The week" });
    const seen = describeApp(withViews(loaded, { views: () => registry }, "views.js"));
    expect(seen).toContain('1 named places: "The week" over the tasks');
    expect(seen).toContain("Drive-ins from altitude: task; the rest open in place.");
    expect(describeApp(withViews(loaded, { default: registry }, "views.js"))).toContain("The week");
    expect(() => withViews(loaded, { nothing: 1 }, "views.js")).toThrow(/does not export a view registry/);
  });
});
