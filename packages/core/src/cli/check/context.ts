import type { GraviewApp } from "../../app.js";
import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { Finding } from "../check.js";
import type { AnyMutationDefinition } from "../../mutations/types.js";

/**
 * WHAT EVERY CHECK IS HANDED: the app, what it declares by name, and the
 * one way a finding is said. The checks are families of questions a
 * declaration is asked — its routes, its lenses, its way in, its city, its
 * intelligence, its settings, its migrations, its brand, its modules, its
 * relations, its fields, its policy — each a file of its own, asked in the
 * order `checkApp` asks them, so a report reads the same as it always has.
 */
export interface CheckContext<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  readonly kinds: ReadonlySet<string>;
  readonly declaredMutations: readonly AnyMutationDefinition<S>[];
  readonly derivedEdits: readonly AnyMutationDefinition<S>[];
  readonly derivedRemoves: readonly AnyMutationDefinition<S>[];
  readonly mutations: ReadonlyMap<string, AnyMutationDefinition<S>>;
  readonly invariants: ReadonlyMap<string, NonNullable<GraviewApp<S>["invariants"]>[number]>;
  add(finding: Finding): void;
}

/**
 * Whether a string schema has been given a ceiling.
 *
 * Asked by parsing one string past any name: a schema that refuses it for
 * any reason — a max, a regex, an enum — is bounded in the way that matters
 * here, and asking is the only way to find that out without knowing what
 * every check means.
 */
export function bounded(field: unknown): boolean {
  const schema = field as { safeParse?: (value: unknown) => { success: boolean } };
  if (typeof schema?.safeParse !== "function") return true;
  /*
   * WHETHER A CEILING WAS CHOSEN, not whether it is sixty. The note asks
   * that the call was made; a catalogue's real titles run to 78 characters
   * and a bound of 100 is a call. Ten thousand characters is past any
   * ceiling somebody chose for a name.
   */
  return !schema.safeParse("x".repeat(10_000)).success;
}

/**
 * The field a role is bound to, whichever of the two shapes was written: a
 * bare field name, or `{ field, is }` — a field and the values that make the
 * role true, the same shape `lifecycle` takes. Undefined when it is neither.
 */
export function fieldOf(bound: unknown): string | undefined {
  if (typeof bound === "string") return bound;
  if (bound !== null && typeof bound === "object") {
    const field = (bound as { field?: unknown }).field;
    const is = (bound as { is?: unknown }).is;
    if (typeof field === "string" && Array.isArray(is) && is.length > 0) return field;
  }
  return undefined;
}

