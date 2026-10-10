// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createNoticeBoard, NoticeBoardContext, Notices, registerDefaultViews, SceneWayBack, WAY_BACK_MS, type NoticeBoard } from "../../src/index.js";

/**
 * THE SCENE OFFERS THE WAY BACK (FR-152, FR-153). Graview Cloud: on the
 * Pages face a person could take a change back; Down in a district on the
 * scene there was no undo in reach but opening Activity and finding the
 * turn, and ⌘Z did nothing. The scene now says an act on the app's board
 * with Take back, for as long as the routed face's offer stands, and hears
 * ⌘Z; and a toast stands while a pointer or the keyboard is on it.
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
const nina: Principal = { kind: "human", id: "nina", roles: ["keeper"] };
const fresh = () =>
  new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }, { id: "i2", kind: "item", label: "Book the hall" }] as never, edges: [] } });

let unmounts: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const unmount of unmounts) await unmount();
  unmounts = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function scene(store: Store<typeof schema>, board: NoticeBoard) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={nina}>
        <NoticeBoardContext.Provider value={board}>
          <SceneWayBack />
          <Notices board={board} anchor={() => host} />
        </NoticeBoardContext.Provider>
      </GraviewProvider>,
    ),
  );
  // The way back's door, fetched once the scene has drawn.
  await act(async () => vi.dynamicImportSettled());
  unmounts.push(() => act(async () => root.unmount()));
  return host;
}

const renameTo = (store: Store<typeof schema>, label: string, id = "i1") => act(async () => void store.apply({ name: "rename-item", args: { id, label } }, { author: nina }));
const offered = (board: NoticeBoard) => board.list().find((one) => one.id === "way-back");
const ctrlZ = () => act(async () => void document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));

describe("the scene's way back", () => {
  it("offers an act back in its own words, for as long as the routed face does", async () => {
    const store = fresh();
    const board = createNoticeBoard();
    await scene(store, board);
    expect(offered(board)).toBeUndefined();
    await renameTo(store, "Later");
    expect(offered(board)).toMatchObject({ kind: "toast", sentence: 'Rename to "Later"', timeout: WAY_BACK_MS, action: { label: "Take back" } });
    const take = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="notice-action"]')].find((one) => one.textContent === "Take back");
    expect(take).toBeDefined();
    await act(async () => take!.click());
    expect(store.graph.getNode("i1")?.label).toBe("Pay the deposit");
    expect(store.batches().at(-1)?.author).toMatchObject({ id: "nina" });
    expect(offered(board)?.sentence).toBe('Took back “Rename to "Later"”');
  });

  it("does not offer a change made before the scene was drawn", async () => {
    const store = fresh();
    store.apply({ name: "rename-item", args: { id: "i1", label: "Earlier" } }, { author: nina });
    const board = createNoticeBoard();
    await scene(store, board);
    await act(async () => void store.apply({ name: "rename-item", args: { id: "i1", label: "Someone else's" } }, { author: { kind: "human", id: "omar" } }));
    expect(offered(board)).toBeUndefined();
  });

  it("is taken by ⌘Z or Ctrl+Z, and not from inside a text field", async () => {
    const store = fresh();
    const board = createNoticeBoard();
    await scene(store, board);
    await renameTo(store, "First", "i2");
    await renameTo(store, "Second");
    const field = document.createElement("input");
    document.body.appendChild(field);
    field.focus();
    await act(async () => void field.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true, cancelable: true })));
    expect(store.graph.getNode("i1")?.label).toBe("Second");
    // On the scene: the last change goes, then the one before it.
    field.blur();
    await ctrlZ();
    expect(store.graph.getNode("i1")?.label).toBe("Pay the deposit");
    expect(store.graph.getNode("i2")?.label).toBe("First");
    await ctrlZ();
    expect(store.graph.getNode("i2")?.label).toBe("Book the hall");
  });

  it("goes when the change is taken back some other way — from Activity", async () => {
    const store = fresh();
    const board = createNoticeBoard();
    await scene(store, board);
    await renameTo(store, "Later");
    const batch = store.batches().at(-1)!.id;
    await act(async () => void store.undo(batch, { author: nina }));
    expect(offered(board)).toBeUndefined();
  });
});

/* jsdom keeps no pointer and no keyboard of its own: what the browser would say — held or not — is said here. */
function heldWhen(held: () => boolean) {
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
    return selector === ":hover, :focus-within" ? held() : matches.call(this, selector);
  });
}

describe("a toast on the board", () => {
  it("stands its whole time again when its time comes while it is held, and goes once it is not", () => {
    vi.useFakeTimers();
    const board = createNoticeBoard();
    let held = true;
    board.hold?.(() => held);
    board.notify({ kind: "toast", sentence: "Saved", timeout: 1000 });
    vi.advanceTimersByTime(5000);
    expect(board.list()).toHaveLength(1);
    held = false;
    vi.advanceTimersByTime(1000);
    expect(board.list()).toHaveLength(0);
  });

  it("is held while a pointer or the keyboard is on the toasts drawn", async () => {
    vi.useFakeTimers();
    let held = false;
    heldWhen(() => held);
    const board = createNoticeBoard();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Notices board={board} anchor={() => host} />));
    unmounts.push(() => act(async () => root.unmount()));
    await act(async () => void board.notify({ kind: "toast", sentence: "Saved", timeout: 1000 }));
    held = true;
    await act(async () => void vi.advanceTimersByTime(5000));
    expect(board.list()).toHaveLength(1);
    held = false;
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(board.list()).toHaveLength(0);
  });
});
