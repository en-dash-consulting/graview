import type { Author } from "./ops/types.js";
import type { RefusalReason } from "./refused.js";
import { seatOf } from "./seat-of.js";

/*
 * THE ONE DOOR FRICTION GOES THROUGH (Roadmap f-friction-log), in a module
 * of its own: a page's Find box, a refused act and the seat call
 * `recordFriction`, and this is all they carry — a weak map and a check.
 * What an event is kept as, counted and said (`@graview/core/friction`)
 * is the host's, fetched where it is read.
 */

/**
 * WHAT A PERSON LOOKED FOR AND COULD NOT DO, in the graph's own words —
 * never a click or a selector:
 *
 *   search-miss   words searched for that found nothing (and the kind's list they were typed into)
 *   unanswered    a question the seat or an agent could not answer (and the place it was asked on)
 *   refused       an act the person pressed and was refused, with the refusal's code
 *   tool-invalid  a tool call an agent made that was refused as `invalid`, and the form of the next call of it that worked
 */
export type FrictionDraft =
  | { readonly type: "search-miss"; readonly words: string; readonly kind?: string }
  | { readonly type: "unanswered"; readonly question: string; readonly place?: string; readonly kind?: string }
  | { readonly type: "refused"; readonly act: string; readonly code: RefusalReason; readonly kind?: string }
  | { readonly type: "tool-invalid"; readonly tool: string; readonly act?: string; readonly message: string; readonly then?: string; readonly kind?: string };

/** Where a recorded draft goes: a host's storage, a server's door. Told who, where the caller knows. */
export type FrictionSink = (draft: FrictionDraft, by: Author | undefined) => void;

/** A visitor — a person who never joined, answering a form — or an agent acting for one: never recorded. */
export const isVisitorAuthor = (author: Author | undefined): boolean => author?.kind === "visitor" || author?.onBehalfOf?.kind === "visitor";

const SINKS = new WeakMap<object, FrictionSink>();

/**
 * WHERE A STORE'S FRICTION GOES, OR NOWHERE: `openRemote` attaches the
 * server's door, a host that keeps its own attaches its storage, and
 * `false` turns recording off for that store. A store nobody attached a
 * sink to records nothing.
 */
export function attachFriction(store: object, sink: FrictionSink | false | undefined): void {
  if (sink) SINKS.set(store, sink);
  else SINKS.delete(store);
}

/**
 * RECORD WHAT SOMEBODY COULD NOT DO, as the store's host keeps it. A seat's
 * view records to its store's sink. Nothing is recorded for a visitor, nor
 * where no sink is attached, and a sink that throws is the host's problem,
 * never the page's.
 */
export function recordFriction(store: object | undefined, draft: FrictionDraft, by?: Author): void {
  if (!store || isVisitorAuthor(by)) return;
  const sink = SINKS.get(store) ?? SINKS.get((seatOf(store as never)?.store as object | undefined) ?? {});
  if (!sink) return;
  try {
    sink(draft, by);
  } catch {
    // Recording is never why a page fails.
  }
}
