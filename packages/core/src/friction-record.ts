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
 *   unanswered    a question the seat or an agent could not answer (and the place it was asked on, and what the app lacks for it, where the seat could say)
 *   refused       an act the person pressed and was refused, with the refusal's code
 *   tool-invalid  a tool call an agent made that was refused as `invalid`, and the form of the next call of it that worked
 */
export type FrictionDraft =
  | { readonly type: "search-miss"; readonly words: string; readonly kind?: string }
  | { readonly type: "unanswered"; readonly question: string; readonly place?: string; readonly kind?: string; readonly lacks?: string }
  | { readonly type: "refused"; readonly act: string; readonly code: RefusalReason; readonly kind?: string }
  | { readonly type: "tool-invalid"; readonly tool: string; readonly act?: string; readonly message: string; readonly then?: string; readonly kind?: string };

/** Where a recorded draft goes: a host's storage, a server's door. Told who, where the caller knows. */
export type FrictionSink = (draft: FrictionDraft, by: Author | undefined) => void;

/** A visitor — a person who never joined, answering a form — or an agent acting for one: never recorded. */
export const isVisitorAuthor = (author: Author | undefined): boolean => author?.kind === "visitor" || author?.onBehalfOf?.kind === "visitor";

const SINKS = new WeakMap<object, FrictionSink>();

/** The last few a page recorded, kept in the page for the person's own support thread (Graview HQ feature:f-support-chat). */
const RECENT = new WeakMap<object, FrictionDraft[]>();
const RECENT_MOST = 10;

/**
 * KEEP THE LAST FEW THINGS THIS PAGE'S PERSON COULD NOT DO, in the page,
 * for their own support thread: a message they send staff carries them, so
 * staff never have to ask what went wrong. Kept only where a host gives
 * support, never sent anywhere but with a message the person sends.
 * Answers what is kept now, newest last.
 */
export function keepRecentFriction(asked: object): readonly FrictionDraft[] {
  // The store itself, where it is handed a seat's view of it: what `recordFriction` is handed either way.
  const store = (seatOf(asked as never)?.store as object | undefined) ?? asked;
  let recent = RECENT.get(store);
  if (!recent) RECENT.set(store, (recent = []));
  return recent;
}

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
  // The last few, for the person's own support thread, where a host asked to keep them (`keepRecentFriction`).
  const recent = RECENT.get(store) ?? RECENT.get((seatOf(store as never)?.store as object | undefined) ?? {});
  if (recent) {
    recent.push(draft);
    if (recent.length > RECENT_MOST) recent.splice(0, recent.length - RECENT_MOST);
  }
  const sink = SINKS.get(store) ?? SINKS.get((seatOf(store as never)?.store as object | undefined) ?? {});
  if (!sink) return;
  try {
    sink(draft, by);
  } catch {
    // Recording is never why a page fails.
  }
}
