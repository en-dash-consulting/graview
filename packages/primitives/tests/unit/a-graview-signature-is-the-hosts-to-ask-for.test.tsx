import { createSchema, defineNode, graviewSymbol, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";
import { ProfilePane } from "../../src/bar-panes.js";

/**
 * A GRAVIEW SIGNATURE IS THE HOST'S TO ASK FOR.
 *
 * The kit's rule: an app leads with its own name and mark, and a Graview
 * signature, where there is one, is secondary. So the person's menu carries
 * none unless the host asks — Graview's own examples do — and then it is one
 * quiet line at the menu's foot, never on the bar: "Built with" and a link
 * named "Graview" to graview.dev.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);

const pane = (signature?: boolean) =>
  renderToStaticMarkup(
    <GraviewProvider store={new Store({ schema, mutations: [], invariants: [] })} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }}>
      <ProfilePane part="rest" name="Somebody" me={undefined} hostActions={[]} close={() => {}} {...(signature === undefined ? {} : { signature })} />
    </GraviewProvider>,
  );

describe("a Graview signature", () => {
  it("is not in the person's menu unless the host asks for it", () => {
    expect(pane()).not.toContain('data-testid="graview-signature"');
    expect(pane(false)).not.toContain('data-testid="graview-signature"');
  });

  it("is one line in the person's menu when asked for: built with, and a link named Graview to graview.dev", () => {
    const html = pane(true);
    const line = /<p[^>]*data-testid="graview-signature"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(line).toContain("Built with");
    const link = /<a([^>]*)>([\s\S]*?)<\/a>/.exec(line);
    expect(link?.[1]).toContain('href="https://graview.dev"');
    // The link's whole name is "Graview": the mark beside the word is decorative.
    expect(link?.[2]).toContain('data-testid="graview-mark"');
    expect(link?.[2]?.replace(/<[^>]+>/g, "").trim()).toBe("Graview");
    expect(link?.[2]).not.toContain("<title");
  });

  it("draws the kit's micro mark exactly as graviewSymbol does, decorative beside the word", () => {
    const mark = /data-testid="graview-mark"[^>]*>([\s\S]*?<\/svg>)/.exec(pane(true))?.[1];
    expect(mark).toBe(graviewSymbol({ size: 14 }));
  });
});
