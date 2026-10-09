import { describe, expect, it } from "vitest";
import { describePlace } from "../../src/describe.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { compileDocumentWithoutCheck, type GraviewDocument } from "../../src/document/index.js";

/*
 * A RECORD DESCRIBED IS AT THE ADDRESS THE ROUTED FACE GIVES IT: under its
 * kind's plural, its id encoded — `/deliverables/a%20b`, where the
 * description said `/deliverable/a b`, an address no page answers.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Workshop",
  kinds: {
    deliverable: { fields: { name: { type: "string", required: true } } },
    person: { plural: "Team members", fields: { name: { type: "string", required: true } } },
  },
} as unknown as GraviewDocument;

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

function said(id: string) {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error("does not compile");
  const app = compiled.app;
  const store = new Store<AnySchema>({
    schema: app.schema as AnySchema,
    mutations: app.mutations ?? [],
    snapshot: { nodes: [{ id: "a b", kind: "deliverable", name: "Email" }, { id: "ada", kind: "person", name: "Ada" }], edges: [] } as never,
  });
  const described = describePlace(store, owner, id, { app, today: "2026-10-09" });
  if (!described.ok) throw new Error(described.error);
  return described.description.place.address;
}

describe("a described record", () => {
  it("is at its kind's plural, its id encoded, as the routed face links it", () => {
    expect(said("a b")).toBe("/deliverables/a%20b");
  });

  it("follows a declared plural as the routes do", () => {
    expect(said("ada")).toBe("/team-members/ada");
  });
});
