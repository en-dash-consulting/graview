// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createPageRegistry, PageFind, PagesApp, PageUndo, type ControlSize, type PageComponent, type PageContext } from "../../src/index.js";

/**
 * A BAR PUTS UNDO AND FIND AT ITS OWN HEIGHT.
 *
 * A product's face with its own bar (TrueNorth's) placed `<PageUndo>` and
 * `<PageFind>` in it: the way back said "Take back “…the whole act…”" at
 * whatever width that took and pushed Find to a sliver, and both carried
 * inline styles the design could only beat with `!important`, Undo's words
 * replaced by a CSS `::after`. So Undo has a compact form — the arrow and
 * "Undo", the whole sentence in its name and title — both take a
 * `className` and a `size`, and what they look like is a class a design's
 * own rule wins over, not a style attribute.
 */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename-item", {
  title: "Rename",
  subject: { kinds: ["item"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["item"]), label: z.string().min(1) }),
  describe: (args) => `Rename to "${args.label}"`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
type S = typeof schema;
type Ctx = PageContext<S>;
const nina: Principal = { kind: "human", id: "nina", roles: ["keeper"] };
const fresh = () =>
  new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });

let unmounts: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const unmount of unmounts) await unmount();
  unmounts = [];
  document.body.innerHTML = "";
});

async function face(store: Store<S>, bar: (context: Ctx) => ReactNode) {
  const Shell = ({ context, children }: { context: Ctx; children: ReactNode }) => (
    <div>
      <nav aria-label="The bar">{bar(context)}</nav>
      <main>{children}</main>
    </div>
  );
  const registry = createPageRegistry<S, PageComponent<S>>(schema)
    .surface("shell", Shell)
    .surface("home", (() => <h1>Home</h1>) as PageComponent<S>);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, principal: nina }} registry={registry} initialPath="/" />));
  unmounts.push(() => act(async () => root.unmount()));
  await act(async () => {
    store.apply({ name: "rename-item", args: { id: "i1", label: "Pay the deposit for the hall on Saturday" } }, { author: nina });
  });
  await act(async () => vi.dynamicImportSettled());
  return host;
}

const undo = (host: Element) => host.querySelector<HTMLButtonElement>('[data-testid="page-undo"]')!;
const find = (host: Element) => host.querySelector<HTMLInputElement>('[data-testid="nav-find"]')!;
const said = "Take back “Rename to \"Pay the deposit for the hall on Saturday\"”";

describe("a compact way back", () => {
  it("says Undo beside its arrow, and the whole sentence in its name and title", async () => {
    const host = await face(fresh(), (context) => <PageUndo context={context} compact />);
    const button = undo(host);
    expect(button.textContent).toBe("↶Undo");
    expect(button.getAttribute("aria-label")).toBe(said);
    expect(button.title).toContain(said);
    expect(button.hasAttribute("data-compact")).toBe(true);
  });

  it("still says the whole sentence when it is not compact", async () => {
    const host = await face(fresh(), (context) => <PageUndo context={context} />);
    expect(undo(host).textContent).toContain(said);
  });
});

describe("Undo and Find in a design's bar", () => {
  it("carry the design's class, and no style attribute it must fight", async () => {
    const host = await face(fresh(), (context) => (
      <>
        <PageFind context={context} className="bar-find" />
        <PageUndo context={context} compact className="bar-undo" />
      </>
    ));
    expect(undo(host).classList.contains("bar-undo")).toBe(true);
    expect(undo(host).classList.contains("graview-undo")).toBe(true);
    expect(undo(host).hasAttribute("style")).toBe(false);
    expect(undo(host).closest('[data-testid="page-undo-place"]')!.hasAttribute("style")).toBe(false);
    const form = find(host).closest("form")!;
    expect(form.classList.contains("bar-find")).toBe(true);
    expect(form.classList.contains("graview-find")).toBe(true);
    expect(form.hasAttribute("style")).toBe(false);
    expect(find(host).hasAttribute("style")).toBe(false);
    expect(find(host).classList.contains("graview-find-box")).toBe(true);
  });

  it("stand at a named size, or at the bar's own height", async () => {
    const sizes: [ControlSize, string | null, string][] = [
      ["sm", "sm", ""],
      ["md", "md", ""],
      [28, null, "28px"],
      ["2rem", null, "2rem"],
    ];
    for (const [size, named, height] of sizes) {
      const host = await face(fresh(), (context) => (
        <>
          <PageFind context={context} size={size} />
          <PageUndo context={context} compact size={size} />
        </>
      ));
      for (const control of [undo(host), find(host).closest("form")!]) {
        expect(control.getAttribute("data-size")).toBe(named);
        expect((control as HTMLElement).style.getPropertyValue("--graview-control-height")).toBe(height);
      }
      for (const unmount of unmounts) await unmount();
      unmounts = [];
    }
  });

  it("are drawn by rules a design's one class outweighs", async () => {
    const host = await face(fresh(), (context) => (
      <>
        <PageFind context={context} />
        <PageUndo context={context} compact />
      </>
    ));
    const rules = [...host.querySelectorAll("style")].map((style) => style.textContent ?? "").join("\n");
    for (const name of ["graview-undo", "graview-find", "graview-find-box"]) {
      expect(rules).toMatch(new RegExp(`:where\\([^)]*\\.${name}\\b`));
      // Every rule for it is behind :where, so `.bar-undo { height: 24px }` wins without !important.
      expect(rules).not.toMatch(new RegExp(`(^|[},\\s])\\.${name}\\b`));
    }
    expect(rules).toContain("--graview-control-height");
  });
});
