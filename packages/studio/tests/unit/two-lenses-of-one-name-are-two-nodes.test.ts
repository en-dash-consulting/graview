import { createSchema, defineApp, defineNode, type GraviewApp } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { declarationToGraph, graphToDeclaration } from "../../src/index.js";

/*
 * TWO LENSES OF ONE NAME ON DIFFERENT KINDS ARE TWO NODES. A lens's id was
 * its name and its title, so a board over tasks and a board over bugs —
 * both titled "Board", which the checker allows, a title being an address
 * per kind — were one node: the studio drew one, and handed the app back
 * with the second lens wearing the first one's bindings.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), stage: z.enum(["todo", "done"]) }), label: (node) => node.label });
const bug = defineNode("bug", { fields: z.object({ label: z.string(), state: z.enum(["open", "fixed"]) }), label: (node) => node.label });
const app = defineApp({
  name: "Tracker",
  schema: createSchema([task, bug]),
  lenses: [
    { name: "columns", title: "Board", on: "task", bindings: { task: { column: "stage" } } },
    { name: "columns", title: "Board", on: "bug", bindings: { bug: { column: "state" } } },
    { name: "calendar", bindings: { task: { start: "stage" } } },
    { name: "calendar", bindings: { bug: { start: "state" } } },
  ],
});
const base = app as unknown as GraviewApp;
const lensIds = (graph: ReturnType<typeof declarationToGraph>) => graph.nodes.filter((node) => node.kind === "lens").map((node) => node.id);

describe("two lenses of one name on different kinds", () => {
  it("are two nodes, each with its own id", () => {
    const ids = lensIds(declarationToGraph(app));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(["lens:columns:board@task", "lens:columns:board@bug", "lens:calendar@task", "lens:calendar@bug"]);
  });

  it("come back as themselves, each with its own bindings, and read the same ids again", () => {
    const back = graphToDeclaration(declarationToGraph(app), { base });
    expect(back.lenses?.map((lens) => [lens.name, lens.on, lens.bindings])).toEqual([
      ["columns", "task", { task: { column: "stage" } }],
      ["columns", "bug", { bug: { column: "state" } }],
      ["calendar", undefined, { task: { start: "stage" } }],
      ["calendar", undefined, { bug: { start: "state" } }],
    ]);
    expect(lensIds(declarationToGraph(back))).toEqual(lensIds(declarationToGraph(app)));
  });
});
