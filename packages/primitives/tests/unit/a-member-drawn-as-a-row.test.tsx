import { createSchema, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { PagesApp } from "@graview/pages";
import { DefaultView, registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * FR-37: a record shown as one line among many is a cell a view can claim
 * — one × glyph — and the framework draws it there: a focused group's
 * members and a list page's rows. FR-36: a view of one's own can draw the
 * framework's default for its cell inside itself.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string(), status: z.enum(["researching", "booked"]) }), plural: "Vendors" });
const schema = createSchema([vendor]);
type S = typeof schema;
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "bloom", kind: "vendor", label: "Bloom & Co", status: "booked" },
        { id: "petal", kind: "vendor", label: "Petal", status: "researching" },
      ] as never,
      edges: [],
    },
  });
const Row = (props: ViewProps<S>) => <span data-testid="own-row">{(props.node as { label: string }).label} · {(props.node as { status: string }).status}</span>;
const withRow = () => registerDefaultViews(schema, createViews(schema)).register("vendor", { cardinality: "one", fidelity: "glyph" }, Row);

function group(views: ReturnType<typeof withRow>) {
  const s = store();
  const Group = views.lookup("vendor", { cardinality: "many", fidelity: "full" }) as ComponentType<ViewProps<S>>;
  return renderToStaticMarkup(
    <GraviewProvider store={s} views={views} initialView={EMPTY_VIEW}>
      <Group nodes={s.graph.nodesOfKind("vendor") as never} label="Vendors" cardinality="many" fidelity="full" mode="scene" selected={false} focused />
    </GraviewProvider>,
  );
}

describe("a member drawn as a row", () => {
  it("draws a registered row view for each member of a focused group, each a target for its record", () => {
    const html = group(withRow());
    expect(html.match(/data-testid="own-row"/g)).toHaveLength(2);
    expect(html).toMatch(/data-graview-pick="bloom"[^>]*>.*?data-testid="own-row"/);
    expect(html).toContain("Petal · researching");
  });

  it("keeps the label chips where the kind has no row of its own", () => {
    const html = group(registerDefaultViews(schema, createViews(schema)));
    expect(html).not.toContain("data-graview-rows");
    expect(html).toContain('data-graview-primitive="roster"');
  });

  it("draws a registered row view on the list page, the whole line the way to the record", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store(), views: withRow() }} initialPath="/vendors" />);
    expect(html.match(/data-testid="record-row"/g)).toHaveLength(2);
    expect(html).toContain("Bloom &amp; Co · booked");
    expect(html).toMatch(/<a[^>]*aria-label="Bloom &amp; Co"[^>]*href="\/vendors\/bloom"|<a[^>]*href="\/vendors\/bloom"[^>]*aria-label="Bloom &amp; Co"/);
  });

  it("lets a view draw the default for its cell inside itself", () => {
    const Page = (props: ViewProps<S>) => (
      <section data-testid="own-page">
        <p>Above the record</p>
        <DefaultView<S> {...props} />
      </section>
    );
    const views = registerDefaultViews(schema, createViews(schema)).register("vendor", { cardinality: "one", fidelity: "full" }, Page);
    const s = store();
    const View = views.lookup("vendor", { cardinality: "one", fidelity: "full" }) as ComponentType<ViewProps<S>>;
    const html = renderToStaticMarkup(
      <GraviewProvider store={s} views={views} initialView={EMPTY_VIEW}>
        <View node={s.graph.getNode("bloom") as never} cardinality="one" fidelity="full" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    expect(html).toMatch(/data-testid="own-page".*Above the record.*data-graview-primitive="panel"/);
  });
});
