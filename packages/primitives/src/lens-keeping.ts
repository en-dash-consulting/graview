import { placeSlug, type AnySchema } from "@graview/core";
import { useGraview, type KeepLensAnswer, type SeatKept } from "@graview/react/provider";
import type { SeatMove } from "@graview/tools";
import type { AddLensEdit, SeatDraft } from "@graview/tools/draft";
import { useContext } from "react";
import { registerLensPlaces, type KeptLens } from "./declared-lens-doors.js";
import { NoticeBoardContext } from "./notices.js";
import { appKeyOf, readerLenses, readerLensesKey } from "./reader-lenses.js";
import type { ReactViewRegistry } from "@graview/react/provider";

/**
 * KEEP A DRAWN VIEW AS A LENS, AND TAKE IT BACK.
 *
 * The draft carries its `add-lens` edit, judged as a declared lens is
 * (`@graview/tools/draft`). Kept, the edit goes to the host (`onKeepLens`):
 * a host that writes the declaration — a document app's server, a dev
 * server — answers that it did, and the lens is in the places for everyone.
 * Otherwise, or with no host at all (an app declared in code), it is kept
 * as the reader's own, in this browser. Either way it joins the place list
 * now, beside the app's own, and the face goes there. The checker and the
 * edit vocabulary stay with the host (`@graview/tools/keep`): nothing here
 * writes a declaration.
 *
 * Take back is the inverse: the `remove-lens` edit to the host, or the
 * reader's own lens dropped, and the place gone. It is offered in a notice
 * (FR-133) where the app has a board, and in the conversation where not.
 */

function write(app: string, lenses: readonly KeptLens[]): void {
  try {
    if (lenses.length === 0) localStorage.removeItem(readerLensesKey(app));
    else localStorage.setItem(readerLensesKey(app), JSON.stringify(lenses));
  } catch {
    // Kept for this page only: the place stays registered until it closes.
  }
}

/** Keeps one more, replacing one of the same title. */
export function keepReaderLens(app: string, lens: KeptLens): void {
  write(app, [...readerLenses(app).filter((one) => one.title !== lens.title), lens]);
}

/** Takes one back, by its title. */
export function dropReaderLens(app: string, title: string): void {
  write(app, readerLenses(app).filter((one) => one.title !== title));
}

/** Takes a kept lens's place away again, by its title. */
function forgetLensPlace(registry: ReactViewRegistry<AnySchema>, title: string): void {
  for (const place of registry.places().filter((one) => one.title === title)) registry.forget?.(place.kind, place.as);
}

const wasKept = (answer: KeepLensAnswer): { readonly written: boolean; readonly said?: string } =>
  answer === true ? { written: true } : typeof answer === "object" && answer !== null ? { written: answer.kept === true, ...(answer.said ? { said: answer.said } : {}) } : { written: false };

const lensOf = (edit: AddLensEdit): KeptLens => ({
  title: edit.title,
  lens: edit.lens,
  on: edit.on,
  ...(edit.bindings ? { bindings: edit.bindings } : {}),
  ...(edit.options ? { options: edit.options } : {}),
});

/** A title no place has yet: "Tasks by day", else "Tasks by day 2". */
function freeTitle(title: string, taken: readonly { readonly title: string; readonly as: string }[]): string {
  const used = (one: string) => taken.some((place) => place.title === one || place.as === placeSlug(one));
  if (!used(title)) return title;
  for (let n = 2; ; n++) if (!used(`${title} ${n}`)) return `${title} ${n}`;
}

export interface LensKeeping {
  /** Keeps the draft as a lens, and goes to it. */
  keep(draft: SeatDraft): Promise<void>;
  /** Takes a kept lens back out of the places. */
  takeBack(kept: SeatKept): Promise<void>;
}

/** Keeping and taking back, moving the face through `go` (the scene's stops, the router's paths). */
export function useLensKeeping(go: (move: SeatMove) => void): LensKeeping {
  const { store, views, brand, seatTalk, onKeepLens } = useGraview<AnySchema>();
  const board = useContext(NoticeBoardContext);
  const app = appKeyOf(brand, store.schema);
  const plural = (kind: string) => (store.schema.tryDefinition(kind)?.plural as string | undefined) ?? `${kind}s`;

  const takeBack = async (kept: SeatKept): Promise<void> => {
    const { edit } = kept;
    if (kept.written && onKeepLens) {
      try {
        await onKeepLens({ op: "remove-lens", title: edit.title, on: edit.on });
      } catch {
        // The host could not take it out of the declaration: it goes from this page all the same.
      }
    }
    dropReaderLens(app, edit.title);
    forgetLensPlace(views as unknown as ReactViewRegistry<AnySchema>, edit.title);
    board?.dismiss(`kept:${edit.title}`);
    seatTalk.setTurns((turns) => [
      ...turns.map((turn) => (turn.kept && turn.kept.edit.title === edit.title && !turn.kept.taken ? { ...turn, kept: { ...turn.kept, taken: true } } : turn)),
      { role: "seat" as const, text: `Took “${edit.title}” back out of the places.` },
    ]);
    // Wherever the reader stood, the place is gone: its kind's own list is the nearest place that is not.
    const title = plural(edit.on);
    go({ to: "kind", kind: edit.on, title, address: `/${placeSlug(title)}`, said: `Went to ${title}.` });
  };

  const keep = async (draft: SeatDraft): Promise<void> => {
    const title = freeTitle(draft.edit.title, views.places());
    const edit: AddLensEdit = { ...draft.edit, title };
    let written = false;
    let said: string | undefined;
    if (onKeepLens) {
      try {
        ({ written, said } = wasKept(await onKeepLens(edit)));
      } catch {
        written = false;
      }
    }
    if (!written) keepReaderLens(app, lensOf(edit));
    registerLensPlaces(views, store.schema, [lensOf(edit)]);
    const place = views.places().find((one) => one.title === title);
    const sentence =
      said ??
      (written
        ? `Kept “${title}” as a lens: it is in the places now.`
        : onKeepLens
          ? `Kept “${title}” as your own lens. Ask the owner to keep it for everyone.`
          : `Kept “${title}” as your own lens.`);
    const kept: SeatKept = { edit, written };
    seatTalk.setDraft(null);
    seatTalk.setTurns((turns) => [...turns, { role: "seat" as const, text: sentence, kept }]);
    board?.notify({ kind: "toast", id: `kept:${title}`, sentence, action: { label: "Take back", onSelect: () => void takeBack(kept) } });
    if (place) go({ to: "picture", kind: place.kind, as: place.as, title, address: `/places/${encodeURIComponent(place.as)}`, said: `Went to ${title}.` });
  };

  return { keep, takeBack };
}
