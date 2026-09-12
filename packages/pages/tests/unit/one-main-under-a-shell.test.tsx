import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPageRegistry, PageMain, PagesApp, type PageComponent, type PageContext } from "../../src/index.js";
import type { ReactNode } from "react";

/**
 * ONE MAIN, UNDER A SHELL OF THE APP'S OWN.
 *
 * `graview-pages` tells a design's shell to own the landmark — "one `main`
 * (a `section` when `context.embedded`)" — and the framework's own pages
 * went on wrapping themselves in `PageMain` underneath it. Any route the
 * design did not replace then had a `main` inside a `main`: every kind left
 * derived, and the not-found page, which is reachable in EVERY design
 * because a design can only register the kinds it knows about.
 *
 * The shell is the fact the framework needs and already has — the registry
 * knows whether one was registered — so the pages under it render regions,
 * exactly as they do inside an embed.
 */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const schema = createSchema([item, person]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-item", {
  title: "Add an item",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label });
  },
});

const store = () => {
  const made = new Store({ schema, mutations: [add], invariants: [] });
  made.apply({ name: "add-item", args: { label: "Pay the deposit" } });
  return made;
};

type S = typeof schema;
type Ctx = PageContext<S>;

/** A design's shell: it owns the document's landmark, as the skill says. */
function Shell({ context, children }: { context: Ctx; children: ReactNode }) {
  return (
    <div data-testid="a-design">
      <nav aria-label="The book">a rail</nav>
      {context.embedded ? <section aria-label="The book">{children}</section> : <main>{children}</main>}
    </div>
  );
}

/** One kind replaced, one left derived — the ordinary half-way house. */
function Items({ context }: { context: Ctx }) {
  return <h1>Items, in the design's own words{context.embedded ? "" : ""}</h1>;
}

const design = () =>
  createPageRegistry<S, PageComponent<S>>(schema)
    .surface("shell", Shell as unknown as PageComponent<S>)
    .register("item", "list", Items as unknown as PageComponent<S>);

const mains = (html: string) => (html.match(/<main[\s>]/g) ?? []).length;

const at = (path: string, registry = design()) =>
  renderToStaticMarkup(
    <PagesApp<S> basename="" context={{ store: store() }} registry={registry} initialPath={path} />,
  );

describe("one main under a shell of the app's own", () => {
  it("leaves the landmark to the design on every route", () => {
    for (const path of [
      "/",
      "/items",
      "/items/item%3Apay-the-deposit",
      "/people",
      "/problems",
      // The route no design can register: there is no kind to register it on.
      "/nowhere",
    ]) {
      expect(mains(at(path)), path).toBe(1);
    }
  });

  it("still gives the derived face its own main when no shell is registered", () => {
    const plain = createPageRegistry<S, PageComponent<S>>(schema);
    for (const path of ["/", "/items", "/people", "/problems", "/nowhere"]) {
      expect(mains(at(path, plain)), path).toBe(1);
    }
  });

  it("gives an embedded face no main at all, shell or no shell", () => {
    const embedded = renderToStaticMarkup(
      <PagesApp<S>
        basename=""
        context={{ store: store(), embedded: true }}
        registry={design()}
        initialPath="/people"
      />,
    );
    expect(mains(embedded)).toBe(0);
  });

  it("renders a section rather than a main when a shell is above it", () => {
    /*
     * Read from the component rather than through the router, so the rule is
     * pinned where it is decided: a page under a shell is a region of it.
     */
    const framed = renderToStaticMarkup(
      <PageMain context={{ store: store(), framed: true } as Ctx}>
        <p>under a design</p>
      </PageMain>,
    );
    expect(mains(framed)).toBe(0);
    expect(framed).toContain("<section");
  });
});
