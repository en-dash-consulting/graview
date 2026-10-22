import { bindSchema, createSchema, defineNode, Store, z } from "@graview/core";
import { describePlace } from "@graview/core/describe";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews, registerViewSpecs } from "@graview/primitives";
import { createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * A DECLARED ROW NAMES ITS RECORD.
 *
 * Threat Watch's row was set to `{severity} · {status}` alone, and its
 * list drew lines of facts with no threat named in any of them — a list of
 * links nobody could tell apart — while describe_place said each record's
 * title. A row whose blocks show no title, no headline and no words that
 * hold the record's name is drawn with the name first; one that names it
 * is drawn as declared. The words and the picture agree.
 */
const threat = defineNode("threat", {
  fields: z.object({ name: z.string(), severity: z.enum(["high", "low"]), status: z.enum(["open", "contained"]) }),
  plural: "Threats",
  label: (node) => node.name,
});
const schema = createSchema([threat]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-threat", {
  title: "Add a threat",
  creates: ["threat"],
  input: z.object({ name: z.string().min(1) }),
  describe: () => "Add a threat",
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId("threat", "threat"), kind: "threat", name: args.name, severity: "low", status: "open" } as never);
  },
});
const store = () => new Store({ schema, mutations: [add as never], snapshot: { nodes: [{ id: "t1", kind: "threat", name: "Log4Shell", severity: "high", status: "open" }] as never, edges: [] } });
const draw = (row: readonly object[]) =>
  renderToStaticMarkup(<PagesApp context={{ store: store(), views: registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, { threat: { row: row as never } }) }} initialPath="/threats" />);
const rowOf = (html: string) => /data-graview-spec="row"[^>]*>([\s\S]*?)<\/div><\/div>/.exec(html)?.[1] ?? "";
const said = (row: readonly object[]) => {
  const result = describePlace(store(), { kind: "human", id: "u" }, "threats", { app: { name: "Threat Watch", schema, mutations: [add as never], viewSpecs: { threat: { row } } } as never });
  if (!result.ok) throw new Error(result.error);
  return result.description.text;
};

describe("a declared row", () => {
  it("is drawn with its record's name first where its blocks name it nowhere", () => {
    const row = rowOf(draw([{ text: "{severity} · {status}" }]));
    expect(row).toMatch(/^<strong class="graview-spec-title" data-graview-row-name="">Log4Shell<\/strong>/);
    expect(row.replace(/<[^>]+>/g, " ")).toMatch(/High/);
  });

  it("is drawn as declared where a title, a headline or its words already name the record", () => {
    for (const blocks of [[{ title: "{name}" }, { badge: "{status}" }], [{ headline: "{name}" }], [{ text: "{name} · {status}" }]]) {
      const row = rowOf(draw(blocks));
      expect(row).not.toContain("data-graview-row-name");
      expect(row.match(/Log4Shell/g)).toHaveLength(1);
    }
  });

  it("is said by describe_place with the name that leads it, then what its blocks say", () => {
    expect(said([{ text: "{severity} · {status}" }])).toMatch(/- Log4Shell\n {2}High Open\n/);
    // A headline that leads the row is its name, said once.
    expect(said([{ headline: "{name}" }, { text: "{severity}" }]).match(/Log4Shell/g)).toHaveLength(1);
  });
});
