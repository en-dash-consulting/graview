import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Store as AnyStore } from "@graview/core";
import { editableFields } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { createStore as discography } from "../apps/discography/src/domain/app.js";
import discographySeed from "../apps/discography/src/data/seed.json";
import { createStore as gauntlet } from "../apps/gauntlet/src/domain/app.js";
import gauntletSeed from "../apps/gauntlet/src/data/seed.json";
import { createRotaStore } from "../apps/rota/src/domain/app.js";
import rotaExample from "../apps/rota/src/data/example.json";

/**
 * AN EDIT IN PLACE MAKES NOTHING (W-180).
 *
 * A field pressed and changed where it is shown runs the act that writes
 * it — read from `writes`, or guessed from an argument named like the
 * field. "Report a fault" on a tool takes the fault's `label`, so the guess
 * made it the act that renames a tool: the tool's name, changed in place,
 * reported a fault by that name and left the tool as it was. And a member,
 * allowed to report a fault, rode the tool's derived edit through the same
 * guess to set any tool's deposit to nothing (the eighth walk).
 *
 * Held over every example, on a record of every kind: no field is edited
 * in place by an act that makes something. The gauntlet's "Spin off a
 * workshop" makes a workshop from a talk and is told its `title`.
 */
const apps: { name: string; store: AnyStore<never> }[] = [
  { name: "gauntlet", store: gauntlet({ snapshot: gauntletSeed as never }) as never },
  { name: "discography", store: discography({ snapshot: discographySeed as never }) as never },
  { name: "rota", store: createRotaStore({ snapshot: rotaExample as never }) as never },
];

describe("a field edited where it is shown", () => {
  for (const { name, store } of apps) {
    it(`in ${name}, is never changed by an act that makes something and never said it writes it`, () => {
      const making = new Set(store.allMutations().filter((mutation) => (mutation.creates ?? []).length > 0 && !mutation.writes).map((mutation) => mutation.name));
      const sample = (store.schema.kinds as readonly string[]).flatMap((kind) => store.graph.nodesOfKind(kind as never).slice(0, 1));
      expect(sample.length).toBeGreaterThan(0);
      const wrong = sample.flatMap((node) => editableFields(store, node.id).filter((field) => making.has(field.mutation)).map((field) => `${node.id}.${field.field} ← ${field.mutation}`));
      expect(wrong).toEqual([]);
    });
  }

  it("is changed, and only by those who may change it, when the only act told its name makes something else", () => {
    const tool = defineNode("tool", { fields: z.object({ label: z.string().min(1), deposit: z.number().int() }), plural: "Tools" });
    const repair = defineNode("repair", { fields: z.object({ label: z.string().min(1) }), plural: "Repairs", edges: { "fault-in": { to: ["tool"], description: "the tool at fault", inverse: "its repairs" } } });
    const schema = createSchema([tool, repair]);
    const { defineMutation } = bindSchema(schema);
    const addTool = defineMutation("add-tool", {
      creates: ["tool"],
      input: z.object({ label: z.string().min(1), deposit: z.number().int() }),
      apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "tool"), kind: "tool", ...args }),
    });
    const reportFault = defineMutation("report-fault", {
      title: "Report a fault",
      creates: ["repair"],
      subject: { kinds: ["tool"], arg: "toolId" },
      input: z.object({ toolId: nodeRef(["tool"]), label: z.string().min(1) }),
      apply(ctx, args) {
        const id = ctx.freshId(args.label, "repair");
        ctx.addNode({ id, kind: "repair", label: args.label });
        ctx.addEdge({ kind: "fault-in", from: id, to: args.toolId });
      },
    });
    const store = new Store({
      schema,
      mutations: [addTool, reportFault],
      policy: { roles: ["librarian", "member"], grants: [{ roles: ["librarian"], mutations: "*" }, { roles: ["member"], mutations: ["report-fault"] }] },
    });
    const librarian = { kind: "human" as const, id: "lib", roles: ["librarian"] };
    store.apply({ name: "add-tool", args: { label: "Hammer drill", deposit: 30 } }, { author: librarian });
    const id = store.graph.nodesOfKind("tool")[0]!.id;
    expect(editableFields(store, id).find((field) => field.field === "label")?.mutation).toBe("edit-tool");
    const member = { kind: "human" as const, id: "ana", roles: ["member"] };
    expect(store.permits({ name: "edit-tool", args: { id, deposit: 0 } }, member).ok).toBe(false);
    expect(store.permits({ name: "report-fault", args: { toolId: id, label: "Chuck slips" } }, member).ok).toBe(true);
  });
});
