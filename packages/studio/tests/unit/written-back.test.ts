import { checkApp, createSchema, DARK, defineApp, defineMutation, defineNode, LIGHT, nodeRef, Store } from "@graview/core";
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
const app = defineApp({ name: "Field Notes", schema, mutations: [addThing, link, unlink], brand: { name: "Field Notes", schemes: { dark: DARK, light: LIGHT } } });

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("written back", () => {
  it("a checkout built from the studio's files passes graview check and runs", async () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-field", args: { kind: "kind:thing", label: "due", type: "date", required: false } });
    studio.store.apply({ name: "add-act", args: { kind: "kind:thing", label: "close-thing", title: "Close it", description: "Mark a thing closed.", writes: ["status"] } });
    studio.store.apply({ name: "add-rule", args: { kind: "kind:thing", label: "closed-in-order", description: "Nothing closed may still depend on an open thing." } });
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
    expect((checkout.app.invariants ?? []).map((i) => i.name)).toEqual(["closed-in-order"]);

    const store = new Store({ schema: checkout.app.schema, mutations: checkout.app.mutations ?? [], invariants: checkout.app.invariants ?? [] } as never);
    store.apply({ name: "add-thing", args: { label: "Water the beds" } });
    const [made] = store.graph.allNodes();
    expect(made).toMatchObject({ kind: "thing", label: "Water the beds", status: "open" });
    store.apply({ name: "close-thing", args: { id: made!.id, status: "closed" } });
    expect(store.graph.getNode(made!.id)).toMatchObject({ status: "closed" });
  });
});
