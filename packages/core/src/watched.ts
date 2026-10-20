/**
 * WHAT A WATCHING HARNESS IS TOLD.
 *
 * The browser harnesses judge every screen they reach against the rules that
 * hold everywhere (`scripts/lib/watch.mjs`). Two of those rules need what
 * only the store knows: which strings are the declaration's own names — an
 * act called `close-deal`, a role called `sales-manager`, a seat called
 * `user-lena` — so that text showing one to a person can be caught exactly
 * rather than guessed at; and which acts a press reached that the policy
 * then refused, which is an act offered to somebody who may not take it.
 *
 * A page is watched when the harness defined `globalThis.__graviewWatch`
 * before the app ran. Anywhere else this is one property read. The store
 * hands itself over and the watch works out the names, what a seat may not
 * see and who has signed what — work that was done here, and downloaded by
 * every reader of a hosted page for a harness's sake, until the ninth walk
 * needed the room (the hosted page's budget).
 */
import { InvalidArguments } from "./mutations/invalid-arguments.js";
import type { Principal, Refusal } from "./permissions/types.js";

interface Watch {
  store?(store: unknown): void;
  seat?(store: unknown, principal: Principal, from?: string): void;
  learn?(names: { readonly ids: readonly string[]; readonly words: readonly string[] }): void;
  refused?(refusal: Refusal & { readonly author?: string }): void;
  refusedInput?(refusal: { readonly mutation: string; readonly message: string; readonly author?: string }): void;
}

const theWatch = (): Watch | undefined => (globalThis as { __graviewWatch?: Watch }).__graviewWatch;

/**
 * THE STORE ITSELF, for a harness that measures whether a person got a job
 * done (`scripts/verify-journeys.mjs`). It drives the page as a person
 * would and reads the log afterwards to say whether the press did what it
 * meant — the screen saying so is the claim under test, not the evidence.
 */
export function tellTheWatchOfAStore(store: unknown): void {
  theWatch()?.store?.(store);
}

/** An author's id, once it has signed something: a seat's id is a name too. */
export function tellTheWatchOfAnAuthor(id: string | undefined): void {
  if (id === undefined) return;
  theWatch()?.learn?.({ ids: [id], words: [] });
}

/** A press reached the store and the policy refused it. */
export function tellTheWatchOfARefusal(refusal: Refusal, author: string | undefined): void {
  theWatch()?.refused?.({ ...refusal, ...(author === undefined ? {} : { author }) });
}

/**
 * A press reached the store and the act's own input refused it (the
 * twelfth walk). Whether that is a surface offering an act it could not
 * take, or a person who filled a form wrongly, is the press's origin, which
 * the watch knows and the store does not.
 */
export function tellTheWatchOfAnInputRefusal(refusal: InvalidArguments, author: string | undefined): void {
  const watch = theWatch();
  if (!watch?.refusedInput) return;
  const message = refusal.issues.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`).join("; ");
  watch.refusedInput({ mutation: refusal.mutation, message, ...(author === undefined ? {} : { author }) });
}

/**
 * A PRESS'S OWN PREVIEW, REFUSED BY THE ACT'S INPUT (carried from W-228 and
 * W-238). The scene's strip and the quick ask show what an act would do
 * before they apply it, so the act's input refused it in the preview and
 * the apply that tells the watch never ran: an act offered whole and
 * refused on press was a finding on the pages and passed on the scene. A
 * surface previewing the press it is about to apply tells the watch here;
 * a preview of what an act would do before anything is pressed tells
 * nothing.
 */
export function tellTheWatchOfAPressRefusedByItsInput(error: unknown, author: string | undefined): void {
  if (error instanceof InvalidArguments) tellTheWatchOfAnInputRefusal(error, author);
}

/**
 * WHAT THIS SEAT MAY NOT SEE, and who has signed what, for a watching
 * harness to hold every screen to ("shown-what-is-not-theirs"): the store
 * and the seat are handed over, and the watch reads them
 * (`scripts/lib/watch.mjs`), as it reads a store's names. Which surface is
 * telling (`from`): two embeds on one page may sit two different seats down.
 */
export function tellTheWatchWhatIsUnseen(store: unknown, principal: Principal, from?: string): void {
  theWatch()?.seat?.(store, principal, from);
}
