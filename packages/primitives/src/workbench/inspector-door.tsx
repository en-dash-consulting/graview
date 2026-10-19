import { retryingImport } from "@graview/core/retry";
import type { AnySchema } from "@graview/core";
import { useMenuPrepare } from "@graview/react/drawing";
import { lazyModule, useGraview, useSelection, type MenuTarget } from "@graview/react/provider";
import { hoverChipsOn } from "@graview/tools/frame";
import { Suspense, useEffect, useRef, useState } from "react";

/* THE HOVER CHIPS, fetched only where the host asked for them (`hover-chips.tsx`). */
const chips = /* @__PURE__ */ lazyModule(/* @__PURE__ */ retryingImport(() => import("../hover-chips.js")));
const Chips = /* @__PURE__ */ chips.part((module) => <module.HoverChipDoor />, { quiet: true });

/**
 * What is selected, what is true about it, and what can legally be done —
 * as a LEFT PANE beside the focus.
 *
 * It has lived bottom-right (a 340px column over the scene), bottom-center
 * (a strip that sat on the kinds shelf), and now where the room actually
 * is: the left gutter beside a centered focus, which every state leaves
 * open, which a widened or zoomed view only makes wider, and which covers
 * neither the shelf below nor the picture you are acting on. In the
 * Graview the relation key holds the top of the same rail and this pane
 * takes the run of it below.
 */
/**
 * Where this pane is drawn.
 *
 * `float` is what it always was: a pane beside the picture, or a bar along
 * the bottom when the scene is narrow, and the same pane at the pointer
 * when a right-click opened it. `menu` is only the pointer popover — the
 * context menu, opened by a right-click or by the acts key on a card —
 * for a scene whose selection draws no strip of its own.
 */
export type InspectorPlacement = "float" | "menu";

/**
 * The key a card answers with its acts. A letter, and only on the card that
 * has the keyboard — a character key bound to focus is not one a voice
 * user's dictation sets off by accident (WCAG 2.1.4).
 */
export const ACTS_KEY = "A";

/*
 * THE PANE ARRIVES WHEN IT IS FIRST WANTED. A scene draws nothing of it
 * until something is selected or a card's acts are asked for, and the acts
 * it offers are derived by `@graview/tools` — so the pane, and the tools,
 * are fetched when the page is first idle, or at once when somebody selects
 * or right-clicks before then, and the scene draws without waiting for
 * either. Once drawn it stays drawn: it keeps the keyboard's place as acts
 * come and go, and gives it back to the picture when it closes.
 */
const pane = /* @__PURE__ */ lazyModule(/* @__PURE__ */ retryingImport(() => import("./inspector.js")));
/** Fetch the pane now; resolved, `Inspector` draws it in the commit it is first wanted in. Rejected when it did not arrive, and asked for again on the next call. */
export function fetchInspector(): Promise<void> {
  return pane.load().then(() => undefined);
}

const Pane = pane.part((module, props: { readonly placement: InspectorPlacement; readonly chosen: boolean }) => <module.InspectorPane {...props} />, { what: "This card's acts" });

/** When the page is idle and online — or, where the browser cannot say when it is idle, a little after it has drawn. */
function whenIdle(then: () => void): () => void {
  const go = () => {
    if (typeof navigator === "undefined" || navigator.onLine !== false) then();
  };
  const idle = globalThis as { requestIdleCallback?: (run: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (idle.requestIdleCallback) {
    const asked = idle.requestIdleCallback(go, { timeout: 5000 });
    return () => idle.cancelIdleCallback?.(asked);
  }
  const later = setTimeout(go, 2500);
  return () => clearTimeout(later);
}

/** How long the pointer rests on a thing before its menu is got ready: a pass-over, across a list, readies nothing. */
const MENU_DWELL_MS = 150;

/** What a menu can be opened on: a record, a card, a row, a kind, an act, a value, a link. */
const READIED = "[data-graview-pick], [data-graview-view], [data-graview-record], [data-graview-act], [data-graview-field], a[href]";

/** What the scene's menu would be about at an element: the pick or the card under it, as a right-click there says it. Nothing on a routed face, or in a menu. */
function sceneAim(element: Element): MenuTarget | null {
  if (element.closest("[data-graview-face='pages'], [data-graview-popover]")) return null;
  const on = element.closest("[data-graview-pick]")?.getAttribute("data-graview-pick") ?? element.closest("[data-graview-view]")?.getAttribute("data-graview-view");
  return on ? { face: "scene", on, about: [on] } : null;
}

/*
 * THE MENU IS READY BEFORE THE CLICK (FR-186). When the pointer rests on a
 * record, a card, a row or a kind for a moment (`MENU_DWELL_MS`), when the
 * keyboard lands on one — so Shift+F10 opens at once — or when a finger goes
 * down on one (a long press opens the menu), the menu that would open there
 * is got ready: the pane and its act forms fetched, its acts derived and
 * kept (`prepareActs`), and every section's own `prepare` — the inline AI's
 * chunk, the sheet "Notify me…" opens. Nothing is fetched until then, so a
 * page's first load carries none of it; a pass-over readies nothing; and no
 * model is asked from here — save the one hover chip, where the host asked
 * for chips (`ai.hoverChips`) and the reader did not turn them off: the same
 * dwell tells it where the pointer rests (`hover-chips.tsx`).
 */
function useMenuReady(aimAt: (element: Element) => MenuTarget | null): void {
  const { store, principal, providers, ai } = useGraview<AnySchema>();
  const prepareSections = useMenuPrepare();
  const chipsOn = hoverChipsOn(ai);
  const latest = useRef({ aimAt, store, principal, providers, prepareSections, chipsOn });
  latest.current = { aimAt, store, principal, providers, prepareSections, chipsOn };
  useEffect(() => {
    if (typeof document === "undefined") return;
    let resting: { readonly element: Element; readonly timer: ReturnType<typeof setTimeout> } | null = null;
    let readied: string | null = null;
    /* Where a hover chip was told the pointer rests (`hover-chips.tsx`): only a pointer's dwell, never the keyboard or a finger. */
    let chipped: Element | null = null;
    const chipOn = (element: Element) => {
      const now = latest.current;
      const target = now.chipsOn ? now.aimAt(element) : null;
      if (!target) return;
      chipped = element;
      void chips.load().then(
        (module) => {
          if (chipped === element) module.restOn(target, element);
        },
        () => undefined,
      );
    };
    const cancel = () => {
      if (resting) clearTimeout(resting.timer);
      resting = null;
    };
    const ready = (element: Element) => {
      const now = latest.current;
      const target = now.aimAt(element);
      if (!target) return;
      // Readied once until the graph moves: resting again on the same thing does nothing more.
      const key = JSON.stringify([target.face, target.on, target.about, target.field, target.place, target.act, now.store.log.length]);
      if (key === readied) return;
      readied = key;
      now.prepareSections(target);
      void pane.load().then(
        (module) => module.prepareActs(now.store, target, { principal: now.principal, providers: now.providers }),
        () => undefined,
      );
    };
    const at = (event: Event): Element | null => (event.target instanceof Element ? event.target.closest(READIED) : null);
    const over = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const element = at(event);
      if (element !== null && element === resting?.element) return;
      cancel();
      if (element === null) return;
      resting = {
        element,
        timer: setTimeout(() => {
          resting = null;
          ready(element);
          chipOn(element);
        }, MENU_DWELL_MS),
      };
    };
    const out = (event: PointerEvent) => {
      const to = event.relatedTarget;
      if (chipped !== null && !(to instanceof Node && chipped.contains(to))) {
        chipped = null;
        chips.current?.leaveRest();
      }
      if (resting === null) return;
      if (to instanceof Node && resting.element.contains(to)) return;
      cancel();
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const element = at(event);
      if (element) ready(element);
    };
    const focused = (event: FocusEvent) => {
      const element = at(event);
      if (element) ready(element);
    };
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("pointerdown", down, { capture: true, passive: true });
    document.addEventListener("focusin", focused);
    return () => {
      cancel();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", down, { capture: true });
      document.removeEventListener("focusin", focused);
    };
  }, []);
}

export function Inspector({
  placement = "float",
  openActs,
  aimAt,
}: {
  readonly placement?: InspectorPlacement;
  /** How the acts key on a card opens the menu, where the face says what a card is about (the routed face); at the card, about its pick, when unsaid. */
  readonly openActs?: (from: HTMLElement) => void;
  /** What a menu opened at an element would be about, where the face says it (the routed face): the pointer resting there gets that menu ready. The scene's pick or card, when unsaid. */
  readonly aimAt?: (element: Element) => MenuTarget | null;
} = {}) {
  const { menuAt, setMenuAt, registerActsDoor, ai } = useGraview<AnySchema>();
  const { selection } = useSelection();
  useMenuReady(aimAt ?? sceneAim);
  /*
   * Fetched when the page is first idle — or, sooner, the moment somebody
   * first presses a pointer or a key on the page, since a selection or a
   * card's acts may follow it before the page was ever idle.
   */
  useEffect(() => {
    if (pane.current) return;
    const reach = () => {
      stop();
      pane.prefetch();
    };
    const cancelIdle = whenIdle(reach);
    const events = ["pointerdown", "keydown"] as const;
    for (const event of events) document.addEventListener(event, reach, { capture: true, passive: true });
    function stop() {
      cancelIdle();
      for (const event of events) document.removeEventListener(event, reach, { capture: true });
    }
    return stop;
  }, []);
  /*
   * THE KEYBOARD'S RIGHT-CLICK. The acts key on a card opens this menu at
   * the card, with the keyboard in it, as a right-click opens it at the
   * pointer; Escape puts the keyboard back on the card.
   */
  useEffect(() => {
    if (placement !== "menu") return;
    registerActsDoor({
      key: ACTS_KEY,
      open: openActs ?? ((from) => {
        const box = from.getBoundingClientRect();
        const on =
          from.closest("[data-graview-pick]")?.getAttribute("data-graview-pick") ??
          from.closest("[data-graview-view]")?.getAttribute("data-graview-view") ??
          undefined;
        setMenuAt({ x: Math.round(box.left + Math.min(16, box.width / 2)), y: Math.round(Math.min(box.bottom, box.top + 36)), ...(on ? { on } : {}) });
      }),
    });
    return () => registerActsDoor(null);
  }, [placement, registerActsDoor, setMenuAt, openActs]);
  // A menu's pane is drawn for a selection too: in a narrow scene it says the chosen record's acts (the tenth walk).
  const wanted = menuAt !== null || selection.length > 0;
  const [drawn, setDrawn] = useState(wanted);
  useEffect(() => {
    if (wanted) setDrawn(true);
  }, [wanted]);
  const chipDoor = hoverChipsOn(ai) ? (
    <Suspense fallback={null}>
      <Chips />
    </Suspense>
  ) : null;
  if (!drawn && !wanted) return chipDoor;
  return (
    <>
      <Suspense fallback={null}>
        {/* A face that opens the menu its own way (the routed face) has no chosen record to say "Acts…" for. */}
        <Pane placement={placement} chosen={openActs === undefined} />
      </Suspense>
      {chipDoor}
    </>
  );
}
