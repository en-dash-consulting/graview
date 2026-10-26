import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, MissingRecordError, nodeRef, refusalOf, seenBy, Store, z, type AnySchema, type Principal } from "../../src/index.js";
import { compileDocument } from "../../src/check.js";
import { FIXTURES } from "../../src/conformance/index.js";
import { MUTATIONS, policyOf, SCHEMA } from "../support/unseen-worlds.js";

/**
 * A REFUSAL IS NO ORACLE (FR-55).
 *
 * Ids are minted from labels, so a seat can guess one. A call naming a
 * hidden record was refused `forbidden`, "names a record you may not see",
 * and one naming a record that was never there `invalid` or `missing` in
 * the act's own words — so the refusal told the seat which guesses were
 * real. Both are now refused alike: `MissingRecordError`, one sentence that
 * names the act and not the id, reason `missing`.
 */
const viewer: Principal = { kind: "human", id: "u2", roles: ["r1"] };

function store() {
  return new Store<AnySchema>({
    schema: SCHEMA as unknown as AnySchema,
    mutations: MUTATIONS as never,
    policy: policyOf({ sights: [{ roles: ["r1"], kinds: ["a"] }] }),
    snapshot: {
      nodes: [
        { id: "a:seen", kind: "a", title: "Seen" },
        { id: "b:hidden", kind: "b", title: "Hidden" },
      ],
      edges: [],
    },
  });
}

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return { missing: error instanceof MissingRecordError, ...refusalOf(error) };
  }
  throw new Error("not refused");
};

describe("a refusal is no oracle", () => {
  it("refuses a call naming a hidden record exactly as one naming a record that is not there", () => {
    for (const call of [
      (id: string) => ({ name: "retitle", args: { id, title: "Guess" } }),
      (id: string) => ({ name: "point", args: { id, ref: "a:seen" } }),
    ]) {
      const hidden = refusal(() => store().apply(call("b:hidden"), { author: viewer }));
      const absent = refusal(() => store().apply(call("b:nothing"), { author: viewer }));
      expect(hidden).toEqual(absent);
      expect(hidden).toMatchObject({ missing: true, reason: "missing" });
      expect(hidden.sentence).not.toContain("b:hidden");
    }
    // Inside a gesture, after a call that lands: the same again, and nothing of the gesture stays.
    const s = store();
    const gesture = (id: string) => [{ name: "retitle", args: { id: "a:seen", title: "Mine" } }, { name: "retitle", args: { id, title: "Guess" } }];
    expect(refusal(() => s.applyAll(gesture("b:hidden"), { author: viewer }))).toEqual(refusal(() => s.applyAll(gesture("b:nothing"), { author: viewer })));
    expect(s.graph.getNode("a:seen")).toMatchObject({ title: "Seen" });
    // Its permission is asked as if the record were not there: the same answer for both.
    expect(s.permits({ name: "retitle", args: { id: "b:hidden", title: "x" } }, viewer)).toEqual(s.permits({ name: "retitle", args: { id: "b:nothing", title: "x" } }, viewer));
    expect(s.missingFor({ name: "retitle", args: { id: "b:hidden", title: "x" } }, viewer)?.message).toBe(s.missingFor({ name: "retitle", args: { id: "b:nothing", title: "x" } }, viewer)?.message);
    // The host sees what it keeps.
    expect(s.missingFor({ name: "retitle", args: { id: "b:hidden", title: "x" } }, { kind: "system" })).toBeUndefined();
  });

  it("refuses a call naming a record that is not there as missing, in a document's app too", () => {
    const vendors = FIXTURES.find((fixture) => fixture.id === "document:vendors")!;
    const compiled = compileDocument(vendors.document);
    if (!compiled.ok) throw new Error("the vendors fixture compiles");
    const app = compiled.app;
    const s = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: (app.mutations ?? []) as never });
    const act = (app.mutations ?? []).find((mutation) => mutation.subject && mutation.subject.kinds !== "*")!;
    const said = refusal(() => s.apply({ name: act.name, args: { [act.subject!.arg]: "vendor:nobody" } }));
    expect(said).toMatchObject({ missing: true, reason: "missing" });
  });

  /*
   * WITHHELD WHOLE IS NOT THERE EITHER. A task must name its project, and a
   * member may see tasks but no project: a task somebody else wrote is
   * withheld from the member whole. Asked by a grant drawn by kind ("a
   * member, on tasks"), its kind was read off the record all the same, so
   * the member was refused `missing` for it and `forbidden` for an id that
   * names nothing — and an id it minted stepped past it.
   */
  describe("a record withheld whole", () => {
    const project = defineNode("project", { fields: z.object({ title: z.string() }) });
    const task = defineNode("task", { fields: z.object({ title: z.string(), project: nodeRef(["project"]) }) });
    const schema = createSchema([project, task]);
    const { defineMutation } = bindSchema(schema);
    const rename = defineMutation("rename", {
      title: "Rename",
      subject: { kinds: ["task"], arg: "id" },
      writes: ["title"],
      input: z.object({ id: nodeRef(["task"]), title: z.string() }),
      apply(ctx, args) {
        ctx.patchNode(args.id, { title: args.title });
      },
    });
    const file = defineMutation("file", {
      title: "File a task",
      creates: ["task"],
      input: z.object({ title: z.string() }),
      apply(ctx, args) {
        ctx.addNode({ id: ctx.freshId(args.title, "task"), kind: "task", title: args.title, project: "project:hidden" } as never);
      },
    });
    const member: Principal = { kind: "human", id: "m1", roles: ["member"] };
    const make = () =>
      new Store<AnySchema>({
        schema: schema as unknown as AnySchema,
        mutations: [rename, file] as never,
        policy: { grants: [{ roles: ["member"], mutations: "*", kinds: ["task"] }, { roles: ["member"], mutations: ["file"] }], sees: [{ roles: ["member"], kinds: ["task"] }] },
        snapshot: {
          nodes: [
            { id: "project:hidden", kind: "project", title: "Hidden" },
            { id: "task:withheld", kind: "task", title: "Withheld", project: "project:hidden" },
          ],
          edges: [],
        } as never,
      });

    it("is refused, and permitted, exactly as an id that names nothing", () => {
      const s = make();
      expect(seenBy(s, member).graph.has("task:withheld")).toBe(false);
      const call = (id: string) => ({ name: "rename", args: { id, title: "x" } });
      expect(refusal(() => make().apply(call("task:withheld"), { author: member }))).toEqual(refusal(() => make().apply(call("task:nothing"), { author: member })));
      expect(s.permits(call("task:withheld"), member)).toEqual(s.permits(call("task:nothing"), member));
      expect(s.graph.getNode("task:withheld")).toMatchObject({ title: "Withheld" });
    });

    it("mints an id for the seat that says nothing of it", () => {
      const made = (title: string) => {
        const s = make();
        return s.apply({ name: "file", args: { title } }, { author: member }).diff.addedNodes[0]!.id;
      };
      const over = made("Withheld");
      const clear = made("Elsewhere");
      // The same shape whether or not a record the seat is not served holds the plain slug: its own, never a random suffix.
      expect(over.startsWith("task:withheld.")).toBe(true);
      expect(clear.startsWith("task:elsewhere.")).toBe(true);
      expect(over.slice("task:withheld".length)).toBe(clear.slice("task:elsewhere".length));
    });
  });
});
