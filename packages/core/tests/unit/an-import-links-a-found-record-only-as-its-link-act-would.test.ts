import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { refusalOf, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { importRows } from "../../src/import/index.js";

/**
 * A ROW THAT FINDS A RECORD (`match`) AND LINKS IT IS A PRESS OF THE LINK ACT
 * ON THAT RECORD. Where only an everybody grant rides the act that makes a
 * job, its derived `connect-job-<relation>` reaches only the jobs a seat
 * made ("only on what you made"); the import asked the act with the far end
 * alone and never named the job, so a sheet could link somebody else's job,
 * and take the one owner it had, when pressing the act was refused.
 */
const DOC = {
  format: "graview-document",
  formatVersion: 1,
  name: "Jobs",
  kinds: {
    job: { fields: { name: { type: "string", required: true } }, edges: { owner: { to: ["crew"], cardinality: "one" }, labels: { to: ["crew"] } } },
    crew: { fields: { name: { type: "string", required: true } } },
  },
  acts: { "add-job": { title: "Add a job", creates: "job" }, "add-crew": { title: "Add a crew", creates: "crew" } },
  policy: { grants: [{ roles: "*", mutations: ["add-job", "add-crew"] }], sees: [{ roles: "*", kinds: ["job", "crew"] }] },
};
const compiled = compileDocument(DOC);
if (!compiled.ok) throw new Error("the jobs document does not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const bob: Principal = { kind: "human", id: "u-bob", roles: ["m"] };
const eve: Principal = { kind: "human", id: "u-eve", roles: ["m"] };

const make = () => {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, policy: app.policy } as never);
  const job = store.apply({ name: "add-job", args: { name: "Alpha" } }, { author: bob }).minted![0]!;
  const red = store.apply({ name: "add-crew", args: { name: "Red" } }, { author: bob }).minted![0]!;
  const blue = store.apply({ name: "add-crew", args: { name: "Blue" } }, { author: eve }).minted![0]!;
  store.apply({ name: "connect-job-owner", args: { id: job, to: red } }, { author: bob });
  return { store, job, red, blue };
};

describe("an import links a found record only as its link act would", () => {
  it("refuses a sheet's link on a job its importer did not make, as the connect act is refused", () => {
    const { store, job, red, blue } = make();
    let direct: string | undefined;
    try {
      store.apply({ name: "connect-job-owner", args: { id: job, to: blue } }, { author: eve });
    } catch (error) {
      direct = refusalOf(error).reason;
    }
    expect(direct).toBe("forbidden");
    const before = store.log.all().length;
    const done = importRows(store, "job", [{ Name: "Alpha", Owner: "Blue", Labels: "Blue" }], { Name: "name", Owner: "owner", Labels: "labels" } as never, { by: eve, match: "label" });
    expect(done.rows[0]!.action).toBe("refuse");
    expect(store.graph.out(job, "owner" as never).map((node) => node.id)).toEqual([red]);
    expect(store.graph.out(job, "labels" as never)).toEqual([]);
    expect(store.log.all().length).toBe(before);
  });

  it("links a found job its importer made", () => {
    const { store, job, blue } = make();
    const done = importRows(store, "job", [{ Name: "Alpha", Owner: "Blue" }], { Name: "name", Owner: "owner" } as never, { by: bob, match: "label" });
    expect(done.rows[0]!.action).not.toBe("refuse");
    expect(store.graph.out(job, "owner" as never).map((node) => node.id)).toEqual([blue]);
  });

  it("links a job the row makes, which its importer made", () => {
    const { store, blue } = make();
    const done = importRows(store, "job", [{ Name: "Beta", Owner: "Blue" }], { Name: "name", Owner: "owner" } as never, { by: eve, match: "label" });
    expect(done.rows[0]!.action).not.toBe("refuse");
    const beta = (store.snapshot().nodes as { id: string; name?: string }[]).find((node) => node.name === "Beta")!;
    expect(store.graph.out(beta.id, "owner" as never).map((node) => node.id)).toEqual([blue]);
  });
});
