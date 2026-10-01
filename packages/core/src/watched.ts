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
 * before the app ran. Anywhere else this is one property read.
 */
import type { Policy, Refusal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";

interface Watch {
  store?(store: unknown): void;
  learn?(names: { readonly ids: readonly string[]; readonly words: readonly string[] }): void;
  refused?(refusal: Refusal & { readonly author?: string }): void;
}

const theWatch = (): Watch | undefined => (globalThis as { __graviewWatch?: Watch }).__graviewWatch;

/** The declaration's names, and the words it has for them. */
export function tellTheWatchItsNames(
  schema: AnySchema,
  mutations: Iterable<{ readonly name: string; readonly title?: string }>,
  policy: Policy | undefined,
): void {
  const watch = theWatch();
  if (!watch?.learn) return;
  const ids: string[] = [];
  const words: string[] = [];
  for (const definition of schema.definitions) {
    ids.push(definition.kind);
    words.push(definition.plural ?? "", definition.noun ?? "", definition.description ?? "");
    const shape = (definition.fields as { shape?: Record<string, unknown> }).shape ?? {};
    ids.push(...Object.keys(shape));
    for (const label of Object.values(definition.display?.labels ?? {})) words.push(label);
    for (const [name, edge] of Object.entries(definition.edges ?? {})) {
      ids.push(name);
      words.push(edge.description ?? "", edge.inverse ?? "");
    }
  }
  for (const mutation of mutations) {
    ids.push(mutation.name);
    words.push(mutation.title ?? "");
  }
  for (const grant of policy?.grants ?? []) if (grant.roles !== "*") ids.push(...grant.roles);
  ids.push(...(policy?.roles ?? []));
  watch.learn({ ids, words: words.filter(Boolean) });
}

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
