/*
 * A REFUSED PRESS SAYS WHY, BESIDE IT (Roadmap f-views-work-end-to-end):
 * fetched the first time a press or a save a view drew is refused.
 *
 * A view hears what became of each act a press asked for as `acted`, and a
 * view written by a chat seldom listens: "Save" was pressed, the act was
 * refused — a number field sent empty, a seat that may not — and nothing on
 * the page changed. So by default the HOST says it: a note in the host's own
 * words beside the control, under it where there is room and over it where
 * there is not, said to a screen reader as it appears, and gone when the
 * control is pressed again, the press lands, or the control goes. A view
 * that listens for `acted` on the control — `graview.on("acted", "button",
 * …)` — takes it over, and the host says nothing there.
 *
 * The note is the host's: drawn in the region's shadow beside the view's
 * root, never inside what the view drew, so the view's drawing is not
 * changed by it and cannot read it.
 */

import { LOCAL_LAYERS } from "@graview/core";

export interface RefusalNotes {
  /** Say why a press on `control` was refused, beside it. */
  say(control: Element, message: string): void;
  /** The control was pressed again, or its press landed: what was said beside it goes. */
  clear(control: Element): void;
  /** After each batch the view draws: notes beside controls that went are taken away, the rest placed again. */
  refresh(): void;
}

const NOTE = "data-graview-refused-note";
/* Over what the view drew, by the region's own ladder (it paints contained, so nothing of the page's is reached). */
const STYLE =
  `position:absolute;z-index:${LOCAL_LAYERS.over};` +
  "box-sizing:border-box;margin:0;padding:4px 8px;max-width:min(40ch,calc(100% - 8px));border-radius:6px;" +
  "font:inherit;font-size:0.8125rem;line-height:1.35;color:var(--graview-ink,CanvasText);background:var(--graview-panel,Canvas);" +
  "border:1px solid var(--graview-danger,#b42318);box-shadow:0 2px 8px rgb(0 0 0 / 0.12);pointer-events:none;overflow-wrap:anywhere";

export function createRefusalNotes(shadow: ShadowRoot): RefusalNotes {
  const notes = new Map<Element, HTMLElement>();
  let next = 0;
  const place = (control: Element, note: HTMLElement) => {
    const host = (shadow.host as HTMLElement).getBoundingClientRect();
    const at = control.getBoundingClientRect();
    const width = note.offsetWidth;
    const height = note.offsetHeight;
    const left = Math.max(4, Math.min(at.left - host.left, host.width - width - 4));
    /* Under the control where the region has room for it; over it where it does not, since the region clips what passes its edge. */
    const below = at.bottom - host.top + 4;
    const top = below + height <= host.height || at.top - host.top - height - 4 < 0 ? below : at.top - host.top - height - 4;
    note.style.left = `${Math.round(left)}px`;
    note.style.top = `${Math.round(top)}px`;
  };
  const api = {
    say(control: Element, message: string) {
      api.clear(control);
      const note = shadow.ownerDocument!.createElement("p");
      note.setAttribute(NOTE, "");
      note.setAttribute("role", "status");
      note.id = `graview-refused-${(next += 1)}`;
      note.setAttribute("style", STYLE);
      note.textContent = message;
      shadow.appendChild(note);
      notes.set(control, note);
      place(control, note);
    },
    clear(control: Element) {
      const note = notes.get(control);
      if (!note) return;
      note.remove();
      notes.delete(control);
    },
    refresh() {
      for (const [control, note] of notes) {
        if (!control.isConnected) {
          note.remove();
          notes.delete(control);
        } else place(control, note);
      }
    },
  };
  return api;
}
