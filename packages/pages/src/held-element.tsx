import { useCallback, useLayoutEffect, useRef } from "react";

/*
 * ONE ELEMENT, MOVED RATHER THAN DRAWN AGAIN. What a face draws once and
 * then stands somewhere else — the routed page into the one face's sheet
 * when its part arrives, the bar into the one face's slot — is drawn into
 * an element of its own (a portal's host), and that element is what moves.
 * Nothing in it is drawn again: the keyboard stays where it was, a word
 * typed is kept, and a press on its way lands on what it was meant for.
 * Where the browser can move a node without taking it out of the page
 * (`moveBefore`) it does; elsewhere the keyboard is put back.
 */

/** An element of no box of its own, for a portal to draw into. */
export function heldHost(name: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.setAttribute(name, "");
  host.style.display = "contents";
  return host;
}

/** `host` to the end of `to`, the keyboard kept on what had it inside, and where a field's caret was. */
export function moveInto(to: HTMLElement, host: HTMLElement): void {
  if (host.parentNode === to) return;
  const active = document.activeElement;
  const held = active instanceof HTMLElement && host.contains(active) ? active : null;
  const field = held instanceof HTMLInputElement || held instanceof HTMLTextAreaElement ? held : null;
  let caret: readonly [number | null, number | null] | null = null;
  try {
    caret = field ? [field.selectionStart, field.selectionEnd] : null;
  } catch {
    caret = null;
  }
  const keeping = to as HTMLElement & { moveBefore?: (node: Node, child: Node | null) => void };
  if (typeof keeping.moveBefore === "function" && host.isConnected && to.isConnected) {
    try {
      keeping.moveBefore(host, null);
    } catch {
      to.appendChild(host);
    }
  } else to.appendChild(host);
  if (held && held.isConnected && document.activeElement !== held) {
    held.focus({ preventScroll: true });
    if (field && caret && caret[0] !== null && caret[1] !== null) {
      try {
        field.setSelectionRange(caret[0], caret[1]);
      } catch {
        // A field that keeps no caret (a number's) keeps its value all the same.
      }
    }
  }
}

/**
 * WHERE A HELD ELEMENT STANDS: a mark of no box, in the flow it belongs to,
 * that takes `host` in as it is drawn and keeps it while it stands.
 */
export function HeldHere({ host }: { readonly host: HTMLElement }) {
  const at = useRef<HTMLDivElement | null>(null);
  const place = useCallback(
    (el: HTMLDivElement | null) => {
      // Kept once let go of, for the cleanup below to see where `host` stood.
      if (!el) return;
      at.current = el;
      moveInto(el, host);
    },
    [host],
  );
  useLayoutEffect(() => {
    if (at.current) moveInto(at.current, host);
  });
  /*
   * GOING, IT LETS GO FIRST. Its own element is taken out of the page after
   * this runs, and whatever is inside would go with it: the keyboard lost
   * before the next place could keep it. So `host` is set down at the
   * page's end, still in the page, and the next place takes it from there
   * in the same frame.
   */
  useLayoutEffect(
    () => () => {
      const el = at.current;
      if (el && host.parentNode === el && document.body) moveInto(document.body, host);
    },
    [host],
  );
  return <div ref={place} data-graview-held-place="" style={{ display: "contents" }} />;
}
