import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formFields, nodeRef, nodeRefKinds } from "../../src/index.js";

/**
 * A DESCRIBED NODE REFERENCE IS STILL A NODE REFERENCE.
 *
 * `.describe()` clones the schema, and the registry that made a string a
 * node reference was keyed on the instance — so the natural thing to
 * write, `nodeRef(["concern"]).describe("The concern it contends with.")`,
 * came back as a plain string: no picker, no Choice over the live nodes,
 * no candidates for an agent. The description is the question a decision
 * provider is asked; losing the kind for saying it would be absurd.
 */
describe("a node reference that says what it is for", () => {
  it("keeps its kinds through describe, meta and optional", () => {
    const plain = nodeRef(["concern"]);
    expect(nodeRefKinds(plain.describe("The concern."))).toEqual(["concern"]);
    expect(nodeRefKinds(plain.meta({ description: "The concern." }))).toEqual(["concern"]);
    expect(nodeRefKinds(plain.describe("The concern.").optional())).toEqual(["concern"]);
    const [field] = formFields(z.object({ concernId: nodeRef(["concern"]).describe("The concern.") }));
    expect(field).toMatchObject({ control: "node", kinds: ["concern"] });
  });
});
