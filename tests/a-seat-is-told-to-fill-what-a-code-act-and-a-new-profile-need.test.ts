// mayRun on part of a call to a code act, and for a seat whose profile has no person yet, says what applying the filled call says.
import { readFileSync } from "node:fs";
import { ActRefusal, bindSchema, createSchema, defineNode, nodeRef, profilePersonId, refusalOf, Store, z, type AnySchema, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { mayRun } from "@graview/core/seat";
import { describe, expect, it } from "vitest";

const tryApply = (store: Store<AnySchema>, call: { name: string; args: Record<string, unknown> }, author: Principal) => {
  try {
    store.apply(call, { author });
    return "ran";
  } catch (e) {
    return `refused ${refusalOf(e).reason}`;
  }
};

describe("what mayRun says of part of a call, and of a seat whose person is not made yet", () => {
  it("record-only call: a code act's ActRefusal about an argument not given yet, or a zod default not applied", () => {
    const idea = defineNode("idea", { fields: z.object({ title: z.string(), note: z.string().optional(), size: z.number().optional() }), plural: "Ideas" });
    const schema = createSchema([idea]);
    const { defineMutation } = bindSchema(schema);
    const note = defineMutation("note-idea", {
      title: "Note",
      subject: { kinds: ["idea"], arg: "id" },
      writes: ["note"],
      input: z.object({ id: nodeRef(["idea"]), note: z.string() }),
      apply(ctx, args) {
        if (!args.note) throw new ActRefusal("Say what the note is.");
        ctx.patchNode(args.id, { note: args.note });
      },
    });
    const size = defineMutation("size-idea", {
      title: "Size",
      subject: { kinds: ["idea"], arg: "id" },
      writes: ["size"],
      input: z.object({ id: nodeRef(["idea"]), size: z.number().default(3), reason: z.string() }),
      apply(ctx, args) {
        if (args.size === undefined) throw new ActRefusal("No size.");
        ctx.patchNode(args.id, { size: args.size });
      },
    });
    const store = new Store({ schema, mutations: [note, size], snapshot: { nodes: [{ id: "idea:1", kind: "idea", title: "One" }] as never, edges: [] } }) as unknown as Store<AnySchema>;
    const me: Principal = { kind: "human", id: "me", roles: [] };
    // Told to fill what is missing...
    expect(mayRun(store, me, { act: "note-idea", record: "idea:1" })).toMatchObject({ answer: "fill" });
    expect(mayRun(store, me, { act: "size-idea", record: "idea:1" })).toMatchObject({ answer: "fill" });
    // ...and the filled call runs.
    expect(tryApply(store, { name: "note-idea", args: { id: "idea:1", note: "hello" } }, me)).toBe("ran");
    expect(tryApply(store, { name: "size-idea", args: { id: "idea:1", reason: "r" } }, me)).toBe("ran");
  });

  it("a profile seat whose person is not made yet: an act naming its own person record", () => {
    const board = JSON.parse(readFileSync("packages/core/tests/document/fixtures/idea-board.gdd.json", "utf8"));
    board.kinds.idea.edges.ledBy = { to: ["member"], cardinality: "one", description: "who leads it", inverse: "what they lead" };
    board.acts.lead = { title: "Lead it", fromTheOtherEnd: "Lead this idea", on: "idea", effects: [{ connect: "ledBy", from: "$subject", to: "$leader" }] };
    board.policy.grants.push({ roles: "*", mutations: ["lead"], ownEnd: true });
    const compiled = compileDocument(board);
    if (!compiled.ok) throw new Error("fixture");
    const store = new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations as never, policy: compiled.app.policy!, snapshot: { nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, { id: "idea:picnic", kind: "idea", title: "A picnic" }], edges: [] } as never });
    const mia: Principal = { kind: "human", id: "p_ann", name: "Ann", roles: ["member"], profile: { id: "prf_mia", name: "Mia" } } as never;
    const person = profilePersonId("p_ann", { id: "prf_mia" });
    expect(mayRun(store, mia, { act: "lead", record: "idea:picnic", args: { leader: person } })).toMatchObject({ answer: "allowed" });
    expect(tryApply(store, { name: "lead", args: { id: "idea:picnic", leader: person } }, mia)).toBe("ran");
  });
});
