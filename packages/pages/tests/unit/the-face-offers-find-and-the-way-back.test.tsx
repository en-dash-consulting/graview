// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createPageRegistry,
  PageFind,
  PagesApp,
  PageUndo,
  type PageComponent,
  type PageContext,
  type PageRegistry,
} from "../../src/index.js";

/**
 * THE ROUTED FACE OFFERS FIND AND THE WAY BACK, WHICHEVER SHELL DRAWS IT.
 *
 * The journeys harness drove every app's core jobs on both faces and found
 * two a person could not do on the pages: take the last change back, in
 * any app — nothing on a page offered it — and find a shift in rota, whose
 * own shell drew no Find box because only the derived shell did. Both are
 * the face's, so the face's root offers them: a shell that places its own
 * gets exactly one, a shell that places neither still gets both, and only a
 * shell that says so goes without.
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
const omar: Principal = { kind: "human", id: "omar", roles: ["viewer"] };

const fresh = (policy?: unknown) =>
  new Store({
    schema,
    mutations: [rename],
    invariants: [],
    ...(policy ? { policy: policy as never } : {}),
    snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }, { id: "i2", kind: "item", label: "Book the hall" }] as never, edges: [] },
  });

/** A design's shell that places nothing of the face's: a rail and the one main, like rota's. */
function BareShell({ context, children }: { context: Ctx; children: ReactNode }) {
  return (
    <div data-testid="a-design">
      <nav aria-label="The book">a rail</nav>
      {context.embedded ? <section>{children}</section> : <main>{children}</main>}
    </div>
  );
}

/** A design's shell that places the face's controls where it wants them. */
function PlacingShell({ context, children }: { context: Ctx; children: ReactNode }) {
  return (
    <div data-testid="a-design">
      <nav aria-label="The book">
        a rail <PageFind context={context} narrowsLists={false} /> <PageUndo context={context} />
      </nav>
      <main>{children}</main>
    </div>
  );
}

const Home = ({ context }: { context: Ctx }) => <h1>{context.store.graph.getNode("i1")?.label as string}</h1>;

const designed = (shell: typeof BareShell, options?: { without?: readonly ("find" | "undo")[] }) =>
  createPageRegistry<S, PageComponent<S>>(schema)
    .surface("shell", shell, options)
    .surface("home", Home as PageComponent<S>);

let unmounts: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const unmount of unmounts) await unmount();
  unmounts = [];
  document.body.innerHTML = "";
});

async function face(store: Store<S>, registry?: PageRegistry<S, PageComponent<S>>, principal: Principal = nina) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(<PagesApp context={{ store, principal }} {...(registry ? { registry } : {})} initialPath="/" />),
  );
  unmounts.push(() => act(async () => root.unmount()));
  return host;
}

const findBoxes = (host: Element) => host.querySelectorAll('input[type="search"][aria-label="Find anything"]');
const takeBack = (host: Element) => host.querySelectorAll<HTMLButtonElement>('[data-testid="page-undo"]');

describe("the routed face's Find box", () => {
  it("is on a face whose shell is the app's own and places none", async () => {
    const host = await face(fresh(), designed(BareShell));
    expect(findBoxes(host)).toHaveLength(1);
  });

  it("is there once, where the shell put it, when the shell places one", async () => {
    const host = await face(fresh(), designed(PlacingShell));
    expect(findBoxes(host)).toHaveLength(1);
    expect(host.querySelector('[data-testid="face-find-bar"]')).toBeNull();
    expect(host.querySelector('[data-testid="a-design"] nav')!.contains(findBoxes(host)[0]!)).toBe(true);
  });

  it("is there once on the derived shell", async () => {
    const host = await face(fresh());
    expect(findBoxes(host)).toHaveLength(1);
  });

  it("is gone only when the shell says it goes without", async () => {
    const host = await face(fresh(), designed(BareShell, { without: ["find"] }));
    expect(findBoxes(host)).toHaveLength(0);
  });
});

describe("the routed face's way back", () => {
  it("offers nothing before anything has changed", async () => {
    const host = await face(fresh(), designed(BareShell));
    expect(takeBack(host)).toHaveLength(0);
  });

  it("says what it takes back, takes it back as the person, and lands the keyboard on the page", async () => {
    const store = fresh();
    const host = await face(store, designed(BareShell));
    await act(async () => {
      store.apply({ name: "rename-item", args: { id: "i1", label: "Pay the deposit for now" } }, { author: nina });
    });
    // The way back is fetched with the first change (FR-152).
    await act(async () => vi.dynamicImportSettled());
    const [button] = takeBack(host);
    expect(button?.textContent).toContain("Take back “Rename to \"Pay the deposit for now\"”");
    button!.focus();
    await act(async () => button!.click());
    await act(async () => new Promise<void>((done) => requestAnimationFrame(() => done())));
    expect(store.graph.getNode("i1")?.label).toBe("Pay the deposit");
    expect(store.batches().at(-1)?.author).toMatchObject({ id: "nina" });
    // Nothing left to take back: the control is gone, and the keyboard is on the page's heading, not <body>.
    expect(takeBack(host)).toHaveLength(0);
    expect(document.activeElement?.tagName).toBe("H1");
  });

  it("is drawn once when the shell places it, and once when the derived shell is used", async () => {
    for (const registry of [designed(PlacingShell), undefined]) {
      const store = fresh();
      const host = await face(store, registry);
      await act(async () => {
        store.apply({ name: "rename-item", args: { id: "i1", label: "Later" } }, { author: nina });
      });
      await act(async () => vi.dynamicImportSettled());
      expect(takeBack(host)).toHaveLength(1);
      if (registry) expect(host.querySelector('[data-testid="a-design"] nav')!.contains(takeBack(host)[0]!)).toBe(true);
    }
  });

  it("does not offer somebody else's change, nor one the policy would refuse to take back", async () => {
    const policy = { roles: ["keeper", "viewer"], grants: [{ roles: ["keeper"], mutations: "*" }] };
    const store = fresh(policy);
    await act(async () => {
      store.apply({ name: "rename-item", args: { id: "i1", label: "Nina's" } }, { author: nina });
    });
    // Omar sits at this face: Nina's change is not his, and he may not rename besides.
    const host = await face(store, designed(BareShell), omar);
    expect(takeBack(host)).toHaveLength(0);
  });

  it("is taken by ⌘Z or Ctrl+Z on the page, and not from inside a text field", async () => {
    const store = fresh();
    const host = await face(store, designed(BareShell));
    await act(async () => {
      store.apply({ name: "rename-item", args: { id: "i2", label: "First" } }, { author: nina });
      store.apply({ name: "rename-item", args: { id: "i1", label: "Second" } }, { author: nina });
    });
    // Typing in the Find box: ⌘Z is the field's own, and the change stays.
    const box = findBoxes(host)[0] as HTMLInputElement;
    box.focus();
    await act(async () => {
      box.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true, cancelable: true }));
    });
    expect(store.graph.getNode("i1")?.label).toBe("Second");
    // On the page: the last change goes, then the one before it.
    box.blur();
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true, cancelable: true }));
    });
    expect(store.graph.getNode("i1")?.label).toBe("Pay the deposit");
    expect(store.graph.getNode("i2")?.label).toBe("First");
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    });
    expect(store.graph.getNode("i2")?.label).toBe("Book the hall");
  });

  it("is gone only when the shell says it goes without", async () => {
    const store = fresh();
    const host = await face(store, designed(BareShell, { without: ["undo"] }));
    await act(async () => {
      store.apply({ name: "rename-item", args: { id: "i1", label: "Later" } }, { author: nina });
    });
    expect(takeBack(host)).toHaveLength(0);
  });
});
