import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import "../../src/typing.js";
import { refusalOf, Store, TYPE_TEXT, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * TYPING RIDES AN ACT ONLY WHILE ITS RULE HOLDS.
 *
 * Typing into a field is permitted to whoever may run an act that writes
 * it — and was, whatever that act's own rule said of the record. An author
 * who may revise a post's body only while it is a draft ("allowedWhen")
 * was refused "Revise" once it was published, and typed the whole body over
 * all the same. A keystroke now rides only an act that could run on the
 * record now: its module on, its condition holding.
 */
const DOC = {
  format: "graview-document",
  formatVersion: 1,
  name: "Posts",
  roles: ["author", "editor", "reader"],
  kinds: {
    post: {
      label: "{title}",
      fields: {
        title: { type: "string", required: true },
        status: { type: "enum", options: ["draft", "published"], required: true },
        body: { type: "text" },
      },
    },
  },
  acts: {
    revise: { title: "Revise", on: "post", writes: ["body"], allowedWhen: "status == 'draft'", refusal: "{title} is published; its body is locked" },
    publish: { title: "Publish", on: "post", sets: { status: "published" } },
  },
  policy: {
    grants: [
      { roles: ["author"], mutations: ["revise"] },
      { roles: ["editor"], mutations: "*" },
    ],
  },
};
const compiled = compileDocument(DOC);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const author: Principal = { kind: "human", id: "ann", roles: ["author"] };
const editor: Principal = { kind: "human", id: "ed", roles: ["editor"] };
const make = (status: string) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    policy: app.policy,
    snapshot: { nodes: [{ id: "post:hello", kind: "post", title: "Hello", status, body: "Kept as it was" }], edges: [] } as never,
  });
const keystroke = { name: TYPE_TEXT, args: { node: "post:hello", field: "body", at: 0, remove: 14, insert: "Rewritten" } };

describe("typing into a field an act writes", () => {
  it("is refused once the act's own rule says no to the record, as the act is", () => {
    const store = make("published");
    expect(refusalOf(catching(() => store.apply({ name: "revise", args: { id: "post:hello", body: "x" } }, { author })))).toMatchObject({ reason: "refused" });
    expect(store.permits(keystroke, author).ok).toBe(false);
    expect(refusalOf(catching(() => store.apply(keystroke, { author })))).toMatchObject({ reason: "forbidden" });
    expect(store.graph.getNode("post:hello")).toMatchObject({ body: "Kept as it was" });
  });

  it("is permitted while the rule holds, and to a seat granted every act whatever it says", () => {
    const draft = make("draft");
    expect(draft.permits(keystroke, author).ok).toBe(true);
    draft.apply(keystroke, { author });
    expect(draft.graph.getNode("post:hello")).toMatchObject({ body: "Rewritten" });
    const published = make("published");
    published.apply(keystroke, { author: editor });
    expect(published.graph.getNode("post:hello")).toMatchObject({ body: "Rewritten" });
  });
});

function catching(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("not refused");
}
