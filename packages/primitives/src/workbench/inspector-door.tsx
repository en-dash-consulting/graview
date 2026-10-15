import { retryingImport } from "@graview/core/retry";
import type { AnySchema } from "@graview/core";
import { lazyModule, useGraview, useSelection } from "@graview/react/provider";
import { Suspense, useEffect, useState } from "react";

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

const Pane = pane.part((module, props: { readonly placement: InspectorPlacement }) => <module.InspectorPane {...props} />, { what: "This card's acts" });

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

export function Inspector({ placement = "float" }: { readonly placement?: InspectorPlacement } = {}) {
  const { menuAt, setMenuAt, registerActsDoor } = useGraview<AnySchema>();
  const { selection } = useSelection();
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
      open: (from) => {
        const box = from.getBoundingClientRect();
        const on =
          from.closest("[data-graview-pick]")?.getAttribute("data-graview-pick") ??
          from.closest("[data-graview-view]")?.getAttribute("data-graview-view") ??
          undefined;
        setMenuAt({ x: Math.round(box.left + Math.min(16, box.width / 2)), y: Math.round(Math.min(box.bottom, box.top + 36)), ...(on ? { on } : {}) });
      },
    });
    return () => registerActsDoor(null);
  }, [placement, registerActsDoor, setMenuAt]);
  // A menu's pane is drawn for a selection too: in a narrow scene it says the chosen record's acts (the tenth walk).
  const wanted = menuAt !== null || selection.length > 0;
  const [drawn, setDrawn] = useState(wanted);
  useEffect(() => {
    if (wanted) setDrawn(true);
  }, [wanted]);
  if (!drawn && !wanted) return null;
  return (
    <Suspense fallback={null}>
      <Pane placement={placement} />
    </Suspense>
  );
}
