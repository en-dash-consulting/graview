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
import { humaniseField, labelOf } from "./schema/define-node.js";
import type { Principal } from "./permissions/types.js";

interface Watch {
  store?(store: unknown): void;
  unseen?(said: { readonly words: readonly string[] }): void;
  learn?(names: { readonly ids: readonly string[]; readonly words: readonly string[]; readonly unsaid?: readonly string[] }): void;
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
  /*
   * THE KEY'S WORDS WHERE THE DECLARATION HAS ITS OWN. "Vin" over a field
   * the kind calls "VIN", "suv" in a picker the record says "SUV" in: a
   * single word passes for prose, so these are caught only where they are
   * the whole of what is shown.
   */
  const unsaid: string[] = [];
  for (const definition of schema.definitions) {
    ids.push(definition.kind);
    // A kind with a noun of its own is never shown by its id: "vehicle" where the declaration says "car".
    if (definition.noun && humaniseField(definition.kind).toLowerCase() !== definition.noun.toLowerCase()) unsaid.push(definition.kind);
    const fieldsOf = (definition.fields as { shape?: Record<string, { def?: { entries?: Record<string, unknown> } }> }).shape ?? {};
    for (const [key, field] of Object.entries(fieldsOf)) {
      const declared = definition.display?.labels?.[key];
      if (declared !== undefined && humaniseField(key) !== declared) unsaid.push(humaniseField(key));
      const entries = field?.def?.entries;
      const format = definition.display?.format?.[key];
      for (const value of entries && typeof entries === "object" ? Object.values(entries) : []) {
        if (typeof value !== "string") continue;
        ids.push(value);
        if (!format) continue;
        const said = format(value);
        if (said !== value) unsaid.push(value);
        if (said !== humaniseField(value)) unsaid.push(humaniseField(value));
      }
    }
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
  // A word one kind declares is never another's key: "Status" is a test drive's own label even where a car says "Availability".
  const declared = new Set<string>();
  for (const definition of schema.definitions) {
    for (const label of Object.values(definition.display?.labels ?? {})) declared.add(label);
    const fieldsOf = (definition.fields as { shape?: Record<string, { def?: { entries?: Record<string, unknown> } }> }).shape ?? {};
    for (const [key, field] of Object.entries(fieldsOf)) {
      const format = definition.display?.format?.[key];
      const entries = field?.def?.entries;
      if (!format && !definition.display?.labels?.[key]) declared.add(humaniseField(key));
      // A value is said by its format, or spoken plainly where there is none ("Given", a talk's state).
      if (entries && typeof entries === "object") for (const value of Object.values(entries)) declared.add(format ? format(value) : humaniseField(String(value)));
    }
  }
  watch.learn({ ids, words: words.filter(Boolean), unsaid: [...new Set(unsaid)].filter((word) => !declared.has(word)) });
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

/**
 * WHAT THIS SEAT MAY NOT SEE, for a watching harness to hold every screen
 * to: the names (and email addresses) of the records the policy's `sees`
 * keeps from it, less any a record it may see shares. A storefront showed
 * a stranger every customer by name; the watch says so wherever one is.
 */
export function tellTheWatchWhatIsUnseen(
  store: {
    readonly policy?: { readonly sees?: readonly unknown[] };
    readonly graph: { allNodes(): readonly ({ id: string; kind: string } & Record<string, unknown>)[] };
    readonly schema: AnySchema;
    sees(principal: Principal, id: string): boolean;
  },
  principal: Principal,
): void {
  const watch = theWatch();
  if (!watch?.unseen || !store.policy?.sees?.length) return;
  const unseen = new Set<string>();
  const seen = new Set<string>();
  for (const node of store.graph.allNodes()) {
    const definition = store.schema.tryDefinition(node.kind);
    const said = [labelOf(definition, node), ...Object.values(node).filter((value): value is string => typeof value === "string" && /^[^\s@]+@[^\s@]+$/.test(value))];
    for (const word of said) (store.sees(principal, node.id) ? seen : unseen).add(word);
  }
  watch.unseen({ words: [...unseen].filter((word) => word.length >= 5 && !seen.has(word)) });
}
