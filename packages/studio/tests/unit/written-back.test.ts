import { checkApp, createSchema, DARK, defineApp, defineInvariant, defineMutation, defineNode, LIGHT, nodeRef, Store } from "@graview/core";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/*
 * THE FILES THE STUDIO WRITES ARE A CHECKOUT. Written to disk, imported as
 * a checkout imports them, assembled with defineApp, they pass graview
 * check and run — the same bar a scaffolded project's own verify holds it
 * to. What this cannot prove is a hand-written body the studio never saw;
 * the files say so where it matters.
 */
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../.generated", `checkout-${process.pid}-${Date.now()}`);

const thing = defineNode("thing", {
  fields: z.object({ label: z.string().min(1), status: z.enum(["open", "closed"]) }),
  edges: { "depends-on": { to: ["thing"], description: "what has to be closed first", inverse: "what is waiting on this" } },
  plural: "things",
  label: (node) => node.label,
  lifecycle: { field: "status", retired: ["closed"] },
});
const schema = createSchema([thing]);
const addThing = defineMutation("add-thing", {
  title: "Add a thing",
  description: "Bring a new thing in.",
  creates: ["thing"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "thing"), kind: "thing", label: args.label, status: "open" });
  },
});
const link = defineMutation("link-thing", {
  title: "Depends on",
  description: "Say one thing has to be closed before another.",
  subject: { kinds: ["thing"], arg: "id" },
  connects: ["depends-on"],
  input: z.object({ id: nodeRef(["thing"]), dependsOn: nodeRef(["thing"]) }),
  describe: (args) => `${args.id} depends on ${args.dependsOn}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});
const unlink = defineMutation("unlink-thing", {
  title: "No longer depends on",
  description: "Take a dependency back.",
  subject: { kinds: ["thing"], arg: "id" },
  severs: ["depends-on"],
  input: z.object({ id: nodeRef(["thing"]), dependsOn: nodeRef(["thing"]) }),
  describe: (args) => `${args.id} no longer depends on ${args.dependsOn}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});
/** A rule the checkout judges — whose judgement the studio can never write. */
const labelled = defineInvariant("labelled-things", {
  label: "Things are labelled",
  description: "A thing called by a single letter has not been named.",
  scope: { kind: "thing" },
  repairs: [],
  evaluate({ subject }) {
    return subject.label.length > 1
      ? []
      : [{ invariant: "labelled-things", subjectId: subject.id, label: subject.label, message: `${subject.label} is not a name`, nodeIds: [subject.id], repairs: [] }];
  },
});
const app = defineApp({ name: "Field Notes", schema, mutations: [addThing, link, unlink], invariants: [labelled], brand: { name: "Field Notes", schemes: { dark: DARK, light: LIGHT } } });

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("written back", () => {
  it("a checkout built from the studio's files passes graview check and runs", async () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-field", args: { kind: "declared:thing", label: "due", type: "date", required: false } });
    studio.store.apply({ name: "add-act", args: { kind: "declared:thing", label: "close-thing", title: "Close it", description: "Mark a thing closed.", writes: ["status"] } });
    studio.store.apply({ name: "add-rule", args: { kind: "declared:thing", label: "closed-in-order", description: "Nothing closed may still depend on an open thing." } });
    studio.store.apply({ name: "name-repair", args: { rule: "rule:closed-in-order", act: "act:close-thing" } });
    expect(studio.check().errors).toBe(0);

    mkdirSync(resolve(out, "src/domain"), { recursive: true });
    for (const file of studio.files({ schemaVar: "fieldNotesSchema" })) writeFileSync(resolve(out, file.path), file.contents, "utf8");
    writeFileSync(
      resolve(out, "src/domain/app.ts"),
      `import { defineApp } from "@graview/core";
import { fieldNotesSchema } from "./schema.js";
import { mutations } from "./mutations.js";
import { invariants } from "./invariants.js";
export const app = defineApp({ name: "Field Notes", schema: fieldNotesSchema, mutations, invariants });
`,
      "utf8",
    );
    const checkout = (await import(pathToFileURL(resolve(out, "src/domain/app.ts")).href)) as { app: typeof app };
    const result = checkApp(checkout.app);
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(checkout.app.schema.kinds).toEqual(["thing"]);
    expect((checkout.app.mutations ?? []).map((m) => m.name)).toEqual(["add-thing", "link-thing", "unlink-thing", "close-thing"]);
    expect((checkout.app.invariants ?? []).map((i) => i.name)).toEqual(["labelled-things", "closed-in-order"]);

    /*
     * A RULE THE CHECKOUT WROTE IS NOT SILENTLY DISARMED. The studio cannot
     * write a judgement it never saw; the file used to write `return []`
     * for it — a rule that holds, under a comment saying the checkout's
     * evaluate was kept. Now the file names what the checkout must supply,
     * the written rule keeps the checkout's own words, and until a person
     * puts the judgement back it fails loudly rather than holding.
     */
    const files = studio.files({ schemaVar: "fieldNotesSchema" });
    expect(files.find((file) => file.path.endsWith("invariants.ts"))?.kept).toEqual(["labelled-things: evaluate"]);
    // And every act the checkout wrote: its body is the checkout's to put back.
    expect(files.find((file) => file.path.endsWith("mutations.ts"))?.kept).toEqual(["add-thing: apply", "link-thing: apply", "unlink-thing: apply"]);
    expect(files.find((file) => file.path.endsWith("invariants.ts"))?.contents).toContain('label: "Things are labelled"');
    {
      const disarmed = new Store({ schema: checkout.app.schema, mutations: checkout.app.mutations ?? [], invariants: checkout.app.invariants ?? [] } as never);
      expect(() => disarmed.apply({ name: "add-thing", args: { label: "x" } })).toThrow(/add-thing: the checkout's apply belongs here/);
      // With the acts back, the store judges every change, so the first act meets the rule's stub:
      // never a rule that quietly holds — one that could not be judged, saying what belongs there (FR-29).
      const halfway = new Store({ schema: checkout.app.schema, mutations: [addThing, link, unlink, ...(checkout.app.mutations ?? []).filter((m) => m.name === "close-thing")], invariants: checkout.app.invariants ?? [] } as never);
      halfway.apply({ name: "add-thing", args: { label: "x" } });
      const stub = halfway.violations().find((violation) => violation.invariant === "labelled-things");
      expect(stub?.status).toBe("could-not-judge");
      expect(stub?.message).toMatch(/labelled-things: the checkout's evaluate belongs here/);
    }
    // With the checkout's bodies put back where the files say, the checkout runs.
    const store = new Store({
      schema: checkout.app.schema,
      mutations: (checkout.app.mutations ?? []).map((act) => (act.name === "add-thing" ? addThing : act.name === "link-thing" ? link : act.name === "unlink-thing" ? unlink : act)),
      invariants: (checkout.app.invariants ?? []).map((rule) => (rule.name === "labelled-things" ? labelled : rule)),
    } as never);
    store.apply({ name: "add-thing", args: { label: "Water the beds" } });
    const [made] = store.graph.allNodes();
    expect(made).toMatchObject({ kind: "thing", label: "Water the beds", status: "open" });
    store.apply({ name: "close-thing", args: { id: made!.id, status: "closed" } });
    expect(store.graph.getNode(made!.id)).toMatchObject({ status: "closed" });

    /*
     * AN ACT THE CHECKOUT WROTE KEEPS ITS OWN ARGUMENTS. The tie act was
     * written back with an invented `to` where the checkout said
     * `dependsOn`, so every caller of it — the app's tests, its pages, its
     * seat — broke on the name. And its history named nodes by id.
     */
    store.apply({ name: "add-thing", args: { label: "Sweep the path" } });
    const [first, second] = store.graph.allNodes();
    store.apply({ name: "link-thing", args: { id: second!.id, dependsOn: first!.id } });
    expect(store.graph.out(second!.id, "depends-on").map((n) => n.id)).toEqual([first!.id]);
    store.apply({ name: "unlink-thing", args: { id: second!.id, dependsOn: first!.id } });
    expect(store.graph.out(second!.id, "depends-on")).toEqual([]);
    // The declaration the studio wrote for the tie keeps the checkout's own argument name.
    const written = files.find((file) => file.path.endsWith("mutations.ts"))!.contents;
    expect(written).toContain("dependsOn: nodeRef([\"thing\"])");
    expect(written).not.toMatch(/\bto: nodeRef/);
    // And an act the STUDIO wrote names nodes in its history, never by id.
    const closed = store.log.all().find((op) => op.mutation.name === "close-thing")!;
    expect(closed.intent).toContain("Water the beds");
    expect(closed.intent).not.toMatch(/thing:/);
  });
});
