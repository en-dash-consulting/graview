// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createPageRegistry, PagesApp, type PageComponent, type PageContext } from "../../src/index.js";
import { PageTitle } from "../../src/page-shell.js";

/**
 * A DESIGN STANDS UNDER THE ONE BAR (FR-131).
 *
 * Inside an embed a design's shell was always drawn under the app bar; at
 * its own address it was the whole window, and every design drew its own
 * masthead, Find, "In the scene ↗" and "Remembered in this browser" — so
 * on a phone the todo app's pages wore an older chrome than the same app
 * in a host's page: two scene pills, a tab strip running off the side, the
 * way back to the example in the middle of the page. Now the routed face
 * draws its bar over any shell, tells the shell (`barAbove`), and puts the
 * one Find box in the bar; a design that is the whole window says so.
 */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const schema = createSchema([item]);
type S = typeof schema;
type Ctx = PageContext<S>;

const store = () => new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });

/** A design's shell: a rail of its own unless the bar is above it. */
function Shell({ context, children }: { context: Ctx; children: ReactNode }) {
  return (
    <div data-testid="a-design" data-bar-above={context.barAbove ? "yes" : "no"}>
      {context.barAbove ? null : <nav aria-label="The book">a rail with the app's name</nav>}
      <main>{children}</main>
    </div>
  );
}
const Home = ({ context }: { context: Ctx }) => <PageTitle context={context}>Today</PageTitle>;

const designed = (without?: readonly ("find" | "undo" | "bar")[]) =>
  createPageRegistry<S, PageComponent<S>>(schema)
    .surface("shell", Shell, without ? { without } : undefined)
    .surface("home", Home as PageComponent<S>);

let unmounts: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const unmount of unmounts) await unmount();
  unmounts = [];
  document.body.innerHTML = "";
});

async function face(registry: ReturnType<typeof designed>, extra: Partial<Ctx> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), ...extra }} registry={registry} initialPath="/" />));
  unmounts.push(() => act(async () => root.unmount()));
  return host;
}

describe("a design's shell at its own address", () => {
  it("stands under the app bar, told so, with the one Find box in the bar", async () => {
    const host = await face(designed());
    const bars = host.querySelectorAll("[data-graview-app-bar]");
    expect(bars).toHaveLength(1);
    expect(host.querySelector('[data-testid="a-design"]')?.getAttribute("data-bar-above")).toBe("yes");
    const finds = host.querySelectorAll('input[type="search"]');
    expect(finds).toHaveLength(1);
    expect(bars[0]!.contains(finds[0]!)).toBe(true);
    expect(host.querySelector('[data-testid="face-find-bar"]')).toBeNull();
  });

  it("says its page's title one level under the bar's name", async () => {
    const host = await face(designed());
    expect(host.querySelector("[data-graview-page-title]")?.tagName).toBe("H2");
  });

  it("says Remembered in this browser once, at the foot, where the browser remembers", async () => {
    const host = await face(designed(), { remembers: true });
    expect(host.querySelectorAll('[data-testid="remembered"]')).toHaveLength(1);
    expect(host.querySelector("footer")?.contains(host.querySelector('[data-testid="remembered"]'))).toBe(true);
  });

  it("is the whole window, with no bar above it, only when it says so", async () => {
    const host = await face(designed(["bar"]));
    expect(host.querySelectorAll("[data-graview-app-bar]")).toHaveLength(0);
    expect(host.querySelector('[data-testid="a-design"]')?.getAttribute("data-bar-above")).toBe("no");
    expect(host.querySelector("[data-graview-page-title]")?.tagName).toBe("H1");
  });
});
