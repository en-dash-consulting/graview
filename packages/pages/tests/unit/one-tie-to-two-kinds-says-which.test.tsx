import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * ONE TIE TO TWO KINDS SAYS WHICH. Todo's reasons read "Related: What this
 * is about · What this is about": one edge to a task or a list, two links
 * with the same words going to two places. Words said twice carry their far end.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const list = defineNode("list", { fields: z.object({ label: z.string() }), plural: "Lists" });
const reason = defineNode("reason", { fields: z.object({ label: z.string() }), plural: "Reasons", edges: { explains: { to: ["task", "list"], description: "what this is about" } } });
const schema = createSchema([task, list, reason]);

describe("the Related line", () => {
  it("says the far end where one tie's words would be said twice", () => {
    const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "r", kind: "reason", label: "Because" }] as never, edges: [] } });
    const html = renderToStaticMarkup(<PagesApp context={{ store }} initialPath="/reasons" />);
    const line = /data-testid="kind-relations"[\s\S]*?<\/span><\/span>(?!<span)/.exec(html)?.[0] ?? html;
    const words = [...line.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((match) => match[1]);
    expect(words).toEqual(["What this is about: tasks", "What this is about: lists"]);
  });
});
