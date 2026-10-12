import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { appFrom, serializeCompiled } from "../../src/document/index.js";
import { mutationToolSchema } from "../../src/json-schema.js";
import { ActRefusal, refusalOf, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A DOCUMENT ACT CAN SAY $me, SO "VOTE FOR IT" ALWAYS VOTES AS YOU
 * (Roadmap f-act-as-me). An act that linked the acting person took them as
 * an argument, so anyone could vote as anyone (q-vote-as-yourself). `$me`
 * is the acting principal's own record of the people kind — the person,
 * for an agent acting for one — and the act's tool no longer asks for it.
 */
const board = JSON.parse(readFileSync(new URL("./fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));

const nodes = [
  { id: "p_ann", kind: "member", name: "Ann" },
  { id: "p_bo", kind: "member", name: "Bo" },
  { id: "idea:picnic", kind: "idea", title: "A picnic" },
];
const storeOf = (app: GraviewApp) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: nodes as never, edges: [] } });
const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
const act = (app: GraviewApp, name: string) => app.mutations!.find((mutation) => mutation.name === name)!;

describe("an act that says $me", () => {
  it("is not asked who: its tool schema takes the idea and nothing else", () => {
    const tool = mutationToolSchema(act(compiled.app, "vote-for"));
    expect(Object.keys((tool.inputSchema["properties"] ?? {}) as object)).toEqual(["id"]);
    expect(tool.nodeRefs.map((ref) => ref.name)).toEqual(["id"]);
    expect(Object.keys((mutationToolSchema(act(compiled.app, "champion")).inputSchema["properties"] ?? {}) as object)).toEqual(["id"]);
  });

  it("links the acting principal's own record, whoever presses it", () => {
    const store = storeOf(compiled.app);
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: ann });
    expect(store.graph.out("idea:picnic", "votedBy").map((node) => node.id)).toEqual(["p_ann"]);
    store.apply({ name: "champion", args: { id: "idea:picnic" } }, { author: ann });
    expect(store.graph.getNode("idea:picnic")).toMatchObject({ champion: "p_ann" });
  });

  it("is the person an agent acts for, not the agent", () => {
    const store = storeOf(compiled.app);
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: { kind: "agent", id: "assistant", onBehalfOf: { kind: "human", id: "p_bo", roles: ["member"] } } as Principal });
    expect(store.graph.out("idea:picnic", "votedBy").map((node) => node.id)).toEqual(["p_bo"]);
  });

  it("is refused, with a sentence, for a principal with no record of the people kind", () => {
    const store = storeOf(compiled.app);
    let refused: unknown;
    try {
      store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: { kind: "human", id: "p_stranger", roles: ["member"] } });
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(ActRefusal);
    expect((refused as ActRefusal).reason).toBe("refused");
    expect((refused as ActRefusal).sentence).toBe('"Vote for it" is done as you, and you have no record here');
    expect(refusalOf(refused)?.reason).toBe("refused");
    // Nor is a record of another kind with that id a person.
    expect(() => store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: { kind: "human", id: "idea:picnic", roles: ["member"] } })).toThrow(/you have no record here/);
    expect(store.graph.out("idea:picnic", "votedBy")).toEqual([]);
  });

  it("is the same app handed compiled to a page", () => {
    const built = appFrom(JSON.parse(JSON.stringify(serializeCompiled(compiled))));
    if (!built.ok) throw new Error("the compiled app is read back");
    const store = storeOf(built.app);
    store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: ann });
    expect(store.graph.out("idea:picnic", "votedBy").map((node) => node.id)).toEqual(["p_ann"]);
  });

  it("needs the document to say which kind is its people", () => {
    const { people: _, ...member } = board.kinds.member;
    const without = compileDocument({ ...board, kinds: { ...board.kinds, member } });
    expect(without.ok).toBe(false);
    const finding = without.findings.find((one) => one.code === "people-unsaid");
    expect(finding).toMatchObject({ severity: "error", path: "acts.vote-for" });
    expect(finding?.message).toMatch(/"\$me" is the acting person's own record, and no kind says it is the people/);
  });
});
