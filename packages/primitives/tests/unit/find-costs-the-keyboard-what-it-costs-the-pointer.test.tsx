// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, createViews, useTheKeyboardLandsSomewhere } from "@graview/react";
import { act, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FindBox, registerDefaultViews } from "../../src/index.js";

/*
 * FIND COSTS THE KEYBOARD WHAT IT COSTS THE POINTER (the tenth walk,
 * carried). The gauntlet's longest title took 89 presses to reach from the
 * keyboard, every talk before it a row, and narrowing a list by a number
 * took 62 against the pointer's 6, most of them Tabs. So: PageDown walks a
 * page of records at a time; a long answer says another word narrows it;
 * Enter on a kind goes into the kind whole rather than narrowed by its own
 * name; and the keys land where Enter went — on the place's arranging line.
 */
const talk = defineNode("talk", { fields: z.object({ label: z.string(), accepted: z.boolean() }), plural: "Talks" });
const schema = createSchema([talk]);
const { defineMutation } = bindSchema(schema);
const accept = defineMutation("accept", {
  title: "Accept it",
  subject: { kinds: ["talk"], arg: "id" },
  writes: ["accepted"],
  input: z.object({ id: nodeRef(["talk"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { accepted: true }),
});

/** The Shell's root, which gives the keyboard back to what it stood on when an act leaves it nowhere. */
function Root({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement | null>(null);
  useTheKeyboardLandsSomewhere(root);
  return <div ref={root}>{children}</div>;
}

async function strip(count: number, q: string) {
  const store = new Store({
    schema,
    mutations: [accept],
    invariants: [],
    snapshot: {
      nodes: Array.from({ length: count }, (_, i) => ({ id: `t${i}`, kind: "talk", label: `Incremental talk ${String(i).padStart(2, "0")}`, accepted: false })) as never,
      edges: [],
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let view: ViewState = { ...EMPTY_VIEW, q };
  const draw = () =>
    act(() => {
      root.render(
        <GraviewProvider
          store={store}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={view}
          view={view}
          onViewChange={(next) => {
            view = next;
            void draw();
          }}
        >
          <Root>
            <FindBox />
          </Root>
        </GraviewProvider>,
      );
    });
  await draw();
  const box = host.querySelector<HTMLInputElement>('[data-testid="find-box"]')!;
  await act(async () => box.focus());
  const key = (name: string) => act(async () => void box.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })));
  const lit = () => {
    const id = box.getAttribute("aria-activedescendant");
    const row = id ? host.querySelector(`[id="${id}"]`) : null;
    return { about: row?.getAttribute("data-about") ?? null, text: row?.textContent ?? "" };
  };
  return { host, key, lit, view: () => view, done: () => act(async () => root.unmount()) };
}

describe("Find from the keyboard, at the pointer's cost", () => {
  it("walks a page of records with PageDown, past the acts unfolded under one, and back with PageUp", async () => {
    const { key, lit, done } = await strip(40, "incremental");
    await key("ArrowDown");
    expect(lit().text).toContain("Incremental talk 00");
    await key("PageDown");
    expect(lit()).toMatchObject({ about: "node" });
    expect(lit().text).toContain("Incremental talk 10");
    await key("PageDown");
    expect(lit().text).toContain("Incremental talk 20");
    await key("PageUp");
    expect(lit().text).toContain("Incremental talk 10");
    await done();
  });

  it("says a long answer narrows with another word, and a short one says nothing of it", async () => {
    const long = await strip(40, "incremental");
    expect(long.host.querySelector('[data-testid="find-more-words"]')?.textContent).toBe("40 found: another word of the name narrows them.");
    await long.done();
    const short = await strip(6, "incremental");
    expect(short.host.querySelector('[data-testid="find-more-words"]')).toBeNull();
    await short.done();
  });

  it("goes into a kind its words name whole, not narrowed by its own name, and the keys land on its arranging line", async () => {
    const { key, lit, view, done } = await strip(40, "talks");
    // The place the stop draws, as the scene draws it: its arranging line first.
    const place = document.createElement("div");
    place.setAttribute("data-graview-view", "aggregate:talk");
    place.tabIndex = 0;
    place.innerHTML = '<div role="group" aria-label="Arrange"><button type="button" data-testid="arrange-add">Filter</button></div>';
    document.body.append(place);
    expect(lit().about).toBe("kind");
    await key("Enter");
    expect(view().focusId).toBe("aggregate:talk");
    expect(view().within?.["q"]).toBeUndefined();
    await act(async () => {
      await new Promise((done) => setTimeout(done, 120));
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("arrange-add");
    place.remove();
    await done();
  });

  /*
   * ON A PHONE THE LINE FOLDS "Sort" INTO "Arrange", and the keys went to
   * the first button the line drew — the folded Sort, which cannot be
   * stood on — so the keyboard stayed in the box, and the next key typed
   * into it (the journeys' refused act on rota, on a phone: 24 keys).
   */
  it("lands on the first of the line's controls that is drawn, past one folded away", async () => {
    const { key, done } = await strip(40, "talks");
    const place = document.createElement("div");
    place.setAttribute("data-graview-view", "aggregate:talk");
    place.tabIndex = 0;
    place.innerHTML = '<div role="group" aria-label="Arrange"><button type="button" data-testid="arrange-sort">Sort</button><button type="button" data-testid="arrange-add">Filter</button></div>';
    const sort = place.querySelector<HTMLButtonElement>('[data-testid="arrange-sort"]')!;
    // Folded away, as the narrow line's CSS folds it: not drawn, so not a place for the keys.
    Object.defineProperty(sort, "checkVisibility", { value: () => false });
    document.body.append(place);
    await key("Enter");
    await act(async () => {
      await new Promise((done) => setTimeout(done, 120));
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("arrange-add");
    place.remove();
    await done();
  });

  /*
   * A PLACE WHOSE LINE IS STILL COMING TAKES THE KEYS AT ONCE. On a slow
   * machine the arranging line comes with the place's picture, a second or
   * more after Enter; the keys were let go on nothing for thirty frames, and
   * the root's rule gave them back to what Enter was pressed on — the Find
   * box — so the next key a person typed went into the words. On the
   * nightly's runner the discography's refused act cost the keyboard 24
   * presses for 4: its acts key was typed after "songs".
   */
  it("hands the keys to the place while its line is still coming, never back to the box", async () => {
    const { key, done } = await strip(40, "talks");
    const place = document.createElement("div");
    place.setAttribute("data-graview-view", "aggregate:talk");
    place.tabIndex = 0;
    document.body.append(place);
    await key("Enter");
    await act(async () => {
      await new Promise((done) => setTimeout(done, 400));
    });
    expect(document.activeElement).toBe(place);
    place.innerHTML = '<div role="group" aria-label="Arrange"><button type="button" data-testid="arrange-add">Filter</button></div>';
    await act(async () => {
      await new Promise((done) => setTimeout(done, 120));
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("arrange-add");
    place.remove();
    await done();
  });
  /*
   * NOT ONE FRAME IN THE BOX. The keys went to the place on the first frame
   * it stood, but between Enter and that frame they were on nothing, and the
   * root gave them back to the box: a key pressed in that frame was typed
   * into the words. Enter now moves the keyboard in the same press — onto a
   * holder that says where it is going — and on to the place when it stands.
   */
  it("moves the keys off the box in the press of Enter, before the place stands, and on to the place once it does", async () => {
    const { host, key, done } = await strip(40, "talks");
    const box = host.querySelector<HTMLInputElement>('[data-testid="find-box"]')!;
    await key("Enter");
    const holder = host.querySelector<HTMLElement>('[data-testid="find-landing"]')!;
    // In the press itself: no frame has passed, and the keyboard is not in the words.
    expect(document.activeElement).toBe(holder);
    expect(holder.getAttribute("aria-label")).toBe("Opening Talks…");
    // The root's rule, asked again a tenth of a second on, finds it somewhere and leaves it there.
    await act(async () => {
      await new Promise((done) => setTimeout(done, 250));
    });
    expect(document.activeElement).not.toBe(box);
    expect(document.activeElement).toBe(holder);
    const place = document.createElement("div");
    place.setAttribute("data-graview-view", "aggregate:talk");
    place.tabIndex = 0;
    document.body.append(place);
    await act(async () => {
      await new Promise((done) => setTimeout(done, 120));
    });
    expect(document.activeElement).toBe(place);
    place.remove();
    await done();
  });

  it("puts the keys on a place that already stands in the press of Enter", async () => {
    const { key, done } = await strip(40, "talks");
    const place = document.createElement("div");
    place.setAttribute("data-graview-view", "aggregate:talk");
    place.tabIndex = 0;
    document.body.append(place);
    await key("Enter");
    expect(document.activeElement).toBe(place);
    place.remove();
    await done();
  });
});
