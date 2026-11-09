import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, KEEP_LINK, nodeRef, Store, z, type AnySchema } from "../../src/index.js";

/**
 * AN EDGE REMOVAL ON A RECORD THAT LACKS THE EDGE IS REFUSED IN WORDS. The
 * graph refused it with its own key for the link — the relation and both
 * ids, joined by NUL — and that key reached a person beside a button and an
 * agent as a tool's answer. A declared act that severs says what it found
 * missing by the records' names; a code act, a kept link and a host's own
 * removal are refused in one sentence, with the key kept on the error's id.
 */
const inWords = (message: string) => {
  expect(message).not.toMatch(/\0/);
  expect(message).not.toMatch(/rock:q|user:nick|foundBy/);
};
const refusal = (act: () => unknown): string => {
  try {
    act();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("it was not refused");
};

describe("an edge removal on a record that lacks the edge", () => {
  it("by a declared act that severs, is refused by the records' names", () => {
    const made = compileDocument({
      format: "graview-document",
      formatVersion: 1,
      name: "Rocks",
      kinds: {
        explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
        rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who", inverse: "what" } } },
      },
      acts: { lose: { title: "Not mine after all", on: "rock", severs: "foundBy" } },
    } as never);
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations as never, snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:q", kind: "rock", title: "Quartz" }], edges: [] } as never });
    const far = Object.keys((store.allMutations().find((one) => one.name === "lose")!.input as unknown as { shape: object }).shape).find((key) => key !== "id")!;
    const said = refusal(() => store.apply({ name: "lose", args: { id: "rock:q", [far]: "user:nick" } }));
    inWords(said);
    expect(said).toBe('"Not mine after all" has nothing to take away: Quartz is not linked to Nick that way');
  });

  it("by a code act, a kept link and a host's own removal, is refused in one sentence", () => {
    const explorer = defineNode("explorer", { fields: z.object({ name: z.string() }) } as never);
    const rock = defineNode("rock", { fields: z.object({ title: z.string() }), edges: { foundBy: { to: ["explorer"] } } } as never);
    const schema = createSchema([explorer, rock]);
    const { defineMutation } = bindSchema(schema);
    const lose = defineMutation("lose", { title: "Lose it", input: z.object({ id: nodeRef(["rock"]) }), apply: (ctx: any, args: any) => ctx.removeEdge({ kind: "foundBy", from: args.id, to: "user:nick" }) } as never);
    const store = new Store({ schema, mutations: [lose] as never, snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:q", kind: "rock", title: "Quartz" }], edges: [] } as never }) as unknown as Store<AnySchema>;
    for (const said of [
      refusal(() => store.apply({ name: "lose", args: { id: "rock:q" } })),
      refusal(() => store.apply({ name: KEEP_LINK, args: { kind: "foundBy", from: "rock:q", to: "user:gone" } })),
      refusal(() => store.applyPrimitives([{ op: "remove-edge", edge: { kind: "foundBy", from: "rock:q", to: "user:nick" } } as never])),
    ]) {
      inWords(said.replace("user:gone", ""));
      expect(said).toBe("That link is not there to take away.");
    }
  });
});
