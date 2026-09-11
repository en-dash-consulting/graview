import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createSchema, defineNode, bindSchema, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances, defaultProviders, graphResponder } from "../../src/index.js";

/**
 * The framework talks about a kind in the app's own words, or it does not
 * talk about it.
 *
 * W-001 made every SCAFFOLDED sentence take its article from `withArticle`,
 * and left six sentences the framework writes at runtime doing it by hand:
 * the strip's tooltip under an act ("this makes a item"), the reason an act
 * is offered on a selection ("this is a item"), the chat's one-line account
 * of a node, and three checker messages. All six also printed the kind's
 * IDENTIFIER, so a `work-order` came out hyphenated in a sentence.
 *
 * Two kinds here, both of which break a hand-written article: one begins
 * with a vowel, one is hyphenated.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string() }),
  plural: "Items",
  label: (node) => node.label,
});
const workOrder = defineNode("work-order", {
  description: "A job.",
  fields: z.object({ label: z.string() }),
  plural: "Work orders",
  label: (node) => node.label,
});
const schema = createSchema([item, workOrder]);
const { defineMutation } = bindSchema(schema);

const addItem = defineMutation("add-item", {
  title: "Add an item",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label });
  },
});
const addWorkOrder = defineMutation("add-work-order", {
  title: "Add a work order",
  creates: ["work-order"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({
      id: ctx.freshId(args.label, "work-order"),
      kind: "work-order",
      label: args.label,
    });
  },
});
const close = defineMutation("close-it", {
  title: "Close it",
  subject: { kinds: ["item", "work-order"], arg: "id" },
  input: z.object({ id: z.string() }),
  apply() {},
});

const store = () =>
  new Store({ schema, mutations: [addItem, addWorkOrder, close] });

describe("the framework says the kind the way the app spells it", () => {
  it("says what an act makes with the right article and no hyphen", () => {
    const s = store();
    const whys = deriveAffordances(s, [], {
      providers: defaultProviders(),
      kindSelection: ["item", "work-order"],
    }).affordances.map((a) => a.why);
    expect(whys).toContain("this makes an item");
    expect(whys).toContain("this makes a work order");
    expect(whys.join(" ")).not.toMatch(/\ba item\b|work-order/);
  });

  it("says what a selected node is with the right article and no hyphen", () => {
    const s = store();
    s.apply({ name: "add-item", args: { label: "First" } });
    s.apply({ name: "add-work-order", args: { label: "Pump" } });
    for (const [kind, expected] of [
      ["item", "this is an item"],
      ["work-order", "this is a work order"],
    ] as const) {
      const node = s.graph.nodesOfKind(kind as never)[0]!;
      const whys = deriveAffordances(s, [node.id], {
        providers: defaultProviders(),
      }).affordances.map((a) => a.why);
      expect(whys).toContain(expected);
    }
  });

  it("introduces a node in the chat the same way", async () => {
    const s = store();
    s.apply({ name: "add-work-order", args: { label: "Pump" } });
    const node = s.graph.nodesOfKind("work-order" as never)[0]!;
    const reply = await graphResponder()(s, "what is this?", { selection: [node.id] });
    expect(reply.say).toContain("Pump — a work order");
    expect(reply.say).not.toContain("work-order");
  });

  it("never writes an article in front of a kind by hand", () => {
    const root = resolve(import.meta.dirname, "../../../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (["node_modules", "dist", "tests"].includes(entry)) continue;
        const full = resolve(dir, entry);
        if (statFile(full)) {
          if (!/\.tsx?$/.test(entry)) continue;
          const source = readFileSync(full, "utf8");
          for (const [line] of source.matchAll(
            /(?:^|[^A-Za-z])an? \$\{[^}]*\bkind\b[^}]*\}/gm,
          )) {
            offenders.push(`${full.slice(root.length + 1)}: ${line.trim()}`);
          }
        } else walk(full);
      }
    };
    const statFile = (p: string) => statSync(p).isFile();
    for (const pkg of readdirSync(resolve(root, "packages"))) {
      const src = resolve(root, "packages", pkg, "src");
      try {
        if (statSync(src).isDirectory()) walk(src);
      } catch {
        /* no src */
      }
    }
    expect(offenders).toEqual([]);
  });
});
