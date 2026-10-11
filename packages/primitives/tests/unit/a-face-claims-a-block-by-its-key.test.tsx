import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { BlockSlots, declaredViews, type BlockSlotProps, type ClaimedSlots } from "@graview/primitives";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import { lazy, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { homeView } from "../../src/home-view.js";

/**
 * A FACE CLAIMS A BLOCK BY ITS KEY, AND THE FRAMEWORK DRAWS EVERY OTHER.
 *
 * A product that draws a few of a view's blocks its own way names them by
 * key, view by view (`BlockSlots`); the framework draws the rest as
 * declared. And a record's page is drawn under a page's budget: a change
 * with 98 tasks lists them, where a card's allowance drew "—".
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const changes = JSON.parse(readFileSync(new URL("changes.gdd.json", fixtures), "utf8"));
const compiled = compileDocument(changes, { today: () => "2026-10-10" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const seed = {
  nodes: [
    { id: "c1", kind: "change", label: "Move the blocks" },
    ...Array.from({ length: 98 }, (_, i) => ({ id: `t${i + 1}`, kind: "task", label: `Task ${String(i + 1).padStart(2, "0")}`, status: i < 60 ? "open" : "done" })),
  ],
  edges: Array.from({ length: 98 }, (_, i) => ({ id: `e${i + 1}`, kind: "has", from: "c1", to: `t${i + 1}` })),
};
const storeOf = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });

function draw(children: ReactNode, slots: ClaimedSlots | null = null) {
  const store = storeOf();
  return renderToStaticMarkup(
    <BlockSlots.Provider value={slots}>
      <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={owner}>
        {children}
      </GraviewProvider>
    </BlockSlots.Provider>,
  );
}
const page = (slots: ClaimedSlots | null = null) => {
  const store = storeOf();
  const View = declaredViews(app).lookup("change" as never, { cardinality: "one", fidelity: "full" }) as ViewComponent<AnySchema>;
  return draw(<View node={store.graph.getNode("c1") as never} cardinality="one" fidelity="full" mode="fullscreen" selected={false} />, slots);
};
const Home = homeView(app.home!);
const home = (slots: ClaimedSlots | null = null) => draw(<Home cardinality="many" fidelity="full" mode="fullscreen" selected={false} />, slots);
const listed = (html: string) => [...html.matchAll(/data-graview-listed="([^"]+)"/g)].map((m) => m[1]);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** A timeline of the open tasks, in the face's own hand: it says how many it was handed. */
function OpenTasks({ block }: BlockSlotProps) {
  return <ol data-face="open-tasks">{block.t === "list" ? `${block.members.length} open, drawn by the face` : null}</ol>;
}

describe("a face claims a block by its key", () => {
  it("draws a record's page under a page's budget: all 98 tasks of a change are listed, none said as '—'", () => {
    const html = page();
    expect(listed(html)).toHaveLength(98);
    expect(text(html)).not.toContain(" — ");
  });

  it("draws the blocks it claims, by key, and the framework draws every other one as declared", () => {
    const html = page({ "change.page": { open: OpenTasks, "open-heading": () => null } });
    expect(html).toContain('data-face="open-tasks"');
    expect(text(html)).toContain("60 open, drawn by the face");
    // The heading it claimed and drew as nothing is gone; the rest is the framework's.
    expect(text(html)).not.toContain("Still open");
    expect(text(html)).toContain("38 of 98 done");
    expect(text(html)).toContain("Done");
    expect(listed(html)).toHaveLength(38);
  });

  it("claims the same block when its title is said differently: a key is not its words", () => {
    const renamed = structuredClone(changes);
    renamed.views.change.page[2].title = "Not yet done";
    const again = compileDocument(renamed, { today: () => "2026-10-10" });
    if (!again.ok) throw new Error("did not compile");
    const View = declaredViews(again.app as GraviewApp<AnySchema>).lookup("change" as never, { cardinality: "one", fidelity: "full" }) as ViewComponent<AnySchema>;
    const html = draw(<View node={storeOf().graph.getNode("c1") as never} cardinality="one" fidelity="full" mode="fullscreen" selected={false} />, { "change.page": { "open-heading": () => <h3 data-face="heading">Open</h3> } });
    expect(html).toContain('data-face="heading"');
    expect(text(html)).not.toContain("Not yet done");
  });

  it("hands the claim the framework's own drawing, to wrap", () => {
    const html = page({ "change.page": { progress: ({ drawn }: BlockSlotProps) => <aside data-face="wrapped">{drawn}</aside> } });
    expect(html).toMatch(/<aside data-face="wrapped"><p class="graview-spec-text">38 of 98 done<\/p><\/aside>/);
  });

  it("claims in the view it names: the home's claims leave a card the home lists to its own view", () => {
    const html = home({ home: { "headline.1": () => <h1 data-face="home">Our changes</h1> }, "change.card": { count: () => <b data-face="count">many</b> } });
    expect(html).toContain('data-face="home"');
    expect(html).not.toMatch(/>Changes</);
    expect(home()).toMatch(/>Changes</);
    // The card a list draws inside the home answers to the card's claims, not the home's.
    expect(html).toContain('data-face="count"');
    const page = home({ "change.page": { count: () => <b data-face="count">many</b> } });
    expect(page).not.toContain('data-face="count"');
  });

  it("draws the framework's drawing while a claimed part is still on its way", () => {
    const Later = lazy(() => new Promise<{ default: (props: BlockSlotProps) => ReactNode }>(() => undefined));
    const html = page({ "change.page": { progress: Later } });
    expect(text(html)).toContain("38 of 98 done");
  });
});
