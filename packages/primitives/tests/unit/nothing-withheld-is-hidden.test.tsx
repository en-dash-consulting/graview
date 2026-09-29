import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Inspector, registerDefaultViews } from "../../src/index.js";

/**
 * NOTHING WITHHELD IS HIDDEN. A producer standing on a song may credit
 * production and nothing else; the strip struck through three of the other
 * acts and dropped the rest without a word.
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs", label: (node) => node.label, edges: { tie: { to: ["song"] } } });
const schema = createSchema([song]);
const { defineMutation } = bindSchema(schema);
const act = (name: string) =>
  defineMutation(name, {
    title: `Do ${name}`,
    subject: { kinds: ["song"], arg: "id" },
    writes: ["label"],
    input: z.object({ id: nodeRef(["song"]) }),
    apply: (ctx, args) => ctx.patchNode(args.id, { label: name }),
  });
const acts = ["one", "two", "three", "four", "five", "six"].map(act);
const producer: Principal = { kind: "human", id: "june", roles: ["producer"] };
const store = new Store({
  schema,
  mutations: acts as never,
  invariants: [],
  policy: { roles: ["label", "producer"], grants: [{ roles: ["label"], mutations: "*" }, { roles: ["producer"], mutations: ["one"] }] } as never,
  snapshot: { nodes: [{ id: "s", kind: "song", label: "Cobalt" }] as never, edges: [] },
});

describe("the strip under a policy", () => {
  it("strikes through the first three withheld acts and offers the rest, rather than dropping them", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} initialSelection={["s"]} principal={producer}>
        <Inspector />
      </GraviewProvider>,
    );
    // Five acts and the derived remove are the label's: six withheld, three shown, three offered.
    const struck = [...html.matchAll(/<s>([^<]+)<\/s>/g)].map((match) => match[1]);
    expect(struck).toHaveLength(3);
    expect(html).toContain('data-testid="withheld-more"');
    expect(html).toMatch(/Show \d+ more withheld/);
  });
});
