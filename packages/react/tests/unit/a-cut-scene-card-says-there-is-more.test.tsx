// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useContext, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageDoorContext, ViewContentHeight, type PageDoor } from "../../src/content-height.js";
import { ScenePreview } from "../../src/scene-preview.js";

/**
 * A CUT SCENE CARD SAYS THERE IS MORE (FR-231, Roadmap f-scene-preview-card-scrolls).
 *
 * A record's card on the Scene is held to its box and never scrolls — a page
 * inside a picture was what FR-141 and f-scene-record-view-card took away —
 * so a person reading a long race card scrolled, and nothing moved, and the
 * foot's fade said nothing of why. The card now says so where the eye is:
 * at the foot, on the fade's own ground, a visible More — a link to the
 * record's page where there are pages, a press that grows the card in place
 * where there are none — named for the card and reachable by the keyboard.
 * A card that holds all it draws says nothing. In a browser, at 1440 and
 * 390, that is `verify-address` (aCutSceneCardSaysMoreAtItsFoot…).
 */
const BODY_HEIGHT = 500;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  /* jsdom lays nothing out: the card's body is 500 pixels tall, and a watcher reports it once, as a browser's does. */
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => BODY_HEIGHT });
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    constructor(private readonly told: () => void) {}
    observe() {
      this.told();
    }
    disconnect() {}
  };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

/* A view as its host draws it: it says nothing of its height; the host tells the face what it measured. */
function Measured({ height }: { readonly height: number }) {
  const told = useContext(ViewContentHeight);
  useEffect(() => told?.(height), [told, height]);
  return <ol>{Array.from({ length: 3 }, (_, at) => <li key={at}>Lap {at + 1}</li>)}</ol>;
}

const draw = async (height: number, door: PageDoor | null, onCard?: () => void) => {
  await act(async () =>
    root.render(
      <PageDoorContext.Provider value={door}>
        <div onClick={onCard} onPointerDown={onCard}>
          <ScenePreview title="The race" name="r1" path="/races/r1">
            <Measured height={height} />
          </ScenePreview>
        </div>
      </PageDoorContext.Provider>,
    ),
  );
  return {
    card: host.querySelector<HTMLElement>('[data-graview-preview="r1"]'),
    body: host.querySelector<HTMLElement>("[data-graview-preview-body]"),
    fade: host.querySelector<HTMLElement>("[data-graview-preview-fade]"),
    more: () => host.querySelector<HTMLElement>("[data-graview-preview-more]"),
  };
};

describe("a record's card on the Scene, cut at its foot", () => {
  it("says More at the foot, after the view in the tab order, named for the card, with the fade reaching the card's own ground under it", async () => {
    const { body, fade, more } = await draw(1652, { open: () => {} });
    expect(body?.hasAttribute("data-graview-more")).toBe(true);
    const foot = more();
    expect(foot?.textContent).toBe("More");
    expect(foot?.getAttribute("aria-label")).toBe("More of The race");
    /* At the foot: a sibling of the fade, after the drawing, so the keyboard reaches it after what the card shows. */
    expect(foot?.parentElement).toBe(body);
    expect(fade?.nextElementSibling).toBe(foot);
    expect(foot?.compareDocumentPosition(host.querySelector("ol")!)! & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    /* A word on the fade's solid ground, not on a half-faded line: the fade ends in the card's panel color before the word. */
    expect(fade?.style.background).toContain("var(--graview-panel");
    expect(foot?.style.pointerEvents).not.toBe("none");
    /* Still never a box that scrolls. */
    expect(body?.style.overflowY).toBe("clip");
  });

  it("is a link to the record's page where there are pages, pressed without choosing the card", async () => {
    const door = { open: vi.fn(), href: (path: string) => `/apps/a4${path}` };
    const onCard = vi.fn();
    const { more } = await draw(1652, door, onCard);
    const foot = more() as HTMLAnchorElement;
    expect(foot.tagName).toBe("A");
    expect(foot.getAttribute("href")).toBe("/apps/a4/races/r1");
    await act(async () => foot.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    expect(door.open).toHaveBeenCalledWith("/races/r1");
    expect(onCard).not.toHaveBeenCalled();
  });

  it("is reachable by the keyboard where the page has no address, and Enter presses it", async () => {
    const door = { open: vi.fn() };
    const { more } = await draw(1652, door);
    const foot = more()!;
    expect(foot.getAttribute("role")).toBe("link");
    expect(foot.getAttribute("tabindex")).toBe("0");
    await act(async () => foot.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    expect(door.open).toHaveBeenCalledWith("/races/r1");
  });

  it("grows the card in place where there are no pages, and says nothing once the card holds it all", async () => {
    const onCard = vi.fn();
    const { card, more } = await draw(1652, null, onCard);
    const foot = more() as HTMLButtonElement;
    expect(foot.tagName).toBe("BUTTON");
    expect(foot.getAttribute("aria-label")).toBe("More of The race");
    await act(async () => foot.click());
    expect(onCard).not.toHaveBeenCalled();
    expect(card?.hasAttribute("data-graview-expanded")).toBe(true);
    expect(more()).toBeNull();
    expect(host.querySelector("[data-graview-preview-expand]")?.textContent).toBe("Collapse");
  });
});

describe("a record's card the Scene holds whole", () => {
  it("says nothing of more", async () => {
    const { more, fade } = await draw(BODY_HEIGHT, { open: () => {} });
    expect(more()).toBeNull();
    expect(fade).toBeNull();
  });
});
