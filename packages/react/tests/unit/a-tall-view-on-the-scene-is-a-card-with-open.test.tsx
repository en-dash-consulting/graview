// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useContext, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageDoorContext, ViewContentHeight, type PageDoor } from "../../src/content-height.js";
import { ScenePreview } from "../../src/scene-preview.js";

/**
 * A TALL VIEW ON THE SCENE IS A CARD WITH OPEN (Roadmap f-view-content-height).
 *
 * A worker view of a kind's members is as tall as it draws. On the Scene it
 * stood as the whole of itself, three screens tall, over everything around
 * it. It is drawn as a card: its title, as much of it as the card holds —
 * the content height its host measured tells the card whether there is
 * more — the foot faded where there is, and Open to its place. Nothing in
 * it scrolls. In a browser, at 1440 and 390, that is `verify-address`
 * (aTallViewOnTheSceneIsDrawnBoundedWithOpenAndOpenLandsOnItsPlace).
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
  return <ol>{Array.from({ length: 3 }, (_, at) => <li key={at}>Entry {at + 1}</li>)}</ol>;
}

const draw = async (height: number, door: PageDoor | null, maxHeight?: number, onCard?: () => void) => {
  await act(async () =>
    root.render(
      <PageDoorContext.Provider value={door}>
        <div onClick={onCard} onPointerDown={onCard}>
          <ScenePreview title="The log" as="the-log" maxHeight={maxHeight}>
            <Measured height={height} />
          </ScenePreview>
        </div>
      </PageDoorContext.Provider>,
    ),
  );
  return {
    card: host.querySelector<HTMLElement>('[data-graview-preview="the-log"]'),
    body: host.querySelector<HTMLElement>("[data-graview-preview-body]"),
    open: host.querySelector<HTMLAnchorElement>("[data-graview-preview-open]"),
    fade: host.querySelector("[data-graview-preview-fade]"),
  };
};

describe("a view taller than its card, on the Scene", () => {
  it("is drawn held to the card at the height its host measured, faded at its foot, and nothing in it scrolls", async () => {
    const { card, body, fade } = await draw(1652, { open: () => {} });
    expect(card?.getAttribute("aria-label")).toBe("The log");
    expect(card?.style.maxHeight).toBe("100%");
    expect(body?.getAttribute("data-graview-content-height")).toBe("1652");
    expect(body?.hasAttribute("data-graview-more")).toBe(true);
    expect(fade?.getAttribute("aria-hidden")).toBe("true");
    for (const one of [card!, ...card!.querySelectorAll<HTMLElement>("*")]) expect(["auto", "scroll"]).not.toContain(one.style.overflowY || one.style.overflow);
    expect(body?.style.overflow).toBe("clip");
  });

  it("is held lower where its manifest says scene.maxHeight", async () => {
    const { body } = await draw(1652, null, 320);
    expect(body?.style.maxHeight).toBe("320px");
  });

  it("offers Open, which goes to its place on Pages and is not also a press on the card", async () => {
    const door = { open: vi.fn(), href: (path: string) => `/apps/a4${path}` };
    const onCard = vi.fn();
    const { open } = await draw(1652, door, undefined, onCard);
    expect(open?.textContent).toBe("Open");
    expect(open?.getAttribute("aria-label")).toBe("Open The log");
    expect(open?.getAttribute("href")).toBe("/apps/a4/places/the-log");
    await act(async () => open!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    expect(door.open).toHaveBeenCalledWith("/places/the-log");
    expect(onCard).not.toHaveBeenCalled();
  });

  it("offers no Open where the host has no pages to send a reader to", async () => {
    const { open } = await draw(1652, null);
    expect(open).toBeNull();
  });
});

describe("a view the card holds whole", () => {
  it("is drawn with no fade", async () => {
    const { body, fade } = await draw(BODY_HEIGHT, { open: () => {} });
    expect(body?.hasAttribute("data-graview-more")).toBe(false);
    expect(fade).toBeNull();
  });
});
