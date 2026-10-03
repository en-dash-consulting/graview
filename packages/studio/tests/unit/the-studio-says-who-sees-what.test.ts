import { createSchema, defineApp, defineMutation, defineNode, nodeRef } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/**
 * THE STUDIO SAYS WHO SEES WHAT (FR-02). It carried a checkout's sights
 * through untouched and had no act for one: a sight could be kept, never
 * added, changed or taken away, where every grant could. A sight is a node
 * now, its acts are ordinary acts, and the declaration and the policy file
 * the studio writes back are read from it.
 */
const customer = defineNode("customer", { fields: z.object({ label: z.string().min(1) }), plural: "Customers" });
const car = defineNode("car", { fields: z.object({ label: z.string().min(1) }), plural: "Cars" });
const rename = defineMutation("rename-car", {
  title: "Rename the car",
  description: "Gives a car another name.",
  subject: { kinds: ["car"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["car"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({
  name: "showroom",
  schema: createSchema([customer, car]),
  mutations: [rename],
  policy: {
    roles: ["staff", "customer"],
    grants: [{ roles: ["staff"], mutations: "*" }],
    sees: [{ roles: ["staff"], kinds: ["customer"], describe: "Staff see the customers." }],
  },
});
const policyFile = (studio: ReturnType<typeof createStudio>) => studio.files().find((file) => file.path.endsWith("policy.ts"))!.contents;

describe("a sight, in the studio", () => {
  it("is added by an act, and written back into the declaration and the policy file", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-sight", args: { kind: "declared:car", describe: "The shop window." } });
    studio.store.apply({ name: "add-sight", args: { kind: "declared:customer", role: "role:customer", own: true } });
    expect(studio.declaration().policy?.sees).toEqual([
      { roles: ["staff"], kinds: ["customer"], describe: "Staff see the customers." },
      { roles: "*", kinds: ["car"], describe: "The shop window." },
      { roles: ["customer"], kinds: ["customer"], own: true },
    ]);
    const written = policyFile(studio);
    expect(written).toContain('{ roles: "*", kinds: ["car"], describe: "The shop window." },');
    expect(written).toContain('{ roles: ["customer"], kinds: ["customer"], own: true },');
  });

  it("is changed by an act", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "change-sight", args: { id: "sight:1", own: true, describe: "Staff see their own customers." } });
    expect(studio.declaration().policy?.sees).toEqual([{ roles: ["staff"], kinds: ["customer"], own: true, describe: "Staff see their own customers." }]);
    expect(policyFile(studio)).toContain('{ roles: ["staff"], kinds: ["customer"], own: true, describe: "Staff see their own customers." },');
  });

  it("is taken away by an act, and is gone from what is written back", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "remove-sight", args: { id: "sight:1" } });
    expect(studio.declaration().policy?.sees).toBeUndefined();
    expect(policyFile(studio)).not.toContain("sees:");
    // Taken back like any other change.
    studio.store.undo(studio.store.batches().at(-1)!.id);
    expect(studio.declaration().policy?.sees).toEqual([{ roles: ["staff"], kinds: ["customer"], describe: "Staff see the customers." }]);
  });

  it("is said, not written, when the checkout is changed in place", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-sight", args: { kind: "declared:car" } });
    expect(studio.sourceChanges().unwritten).toEqual([expect.stringContaining('The sight "everybody may see car" is new')]);
  });
});
