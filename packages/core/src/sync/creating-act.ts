import type { AnyMutationDefinition } from "../mutations/types.js";

/*
 * THE ACT A RECORD FROM ANOTHER SYSTEM IS MADE THROUGH, chosen once for the
 * connection that runs it and the checker that judges it (`graview check`
 * at `connections.<name>`), so the two never disagree.
 *
 * A page or an event is made into a record with nothing but its own fields:
 * there is no record here for it to be about, and nobody to ask for what the
 * connection does not map. So the act must create the kind, take no subject,
 * and ask for nothing (required) beyond the fields the connection maps — the
 * id it is made with aside. `add-<kind>` is preferred when it fits; else the
 * first declared act that does. North Pole's first act that made a health
 * check logged one on a reindeer, and every page from Notion was refused
 * naming a record that was not there.
 */

/** Why an act that creates the kind cannot make a record from another system's fields alone. */
export interface UnfitCreatingAct {
  readonly name: string;
  /** The kinds it acts on, when it takes a subject. */
  readonly on?: readonly string[];
  /** The arguments it requires that the connection does not map. */
  readonly asks?: readonly string[];
}

export interface CreatingActChoice {
  /** The act a record is made through, when one fits. */
  readonly act?: string;
  /** Every act that creates the kind and does not fit, and why. Empty when none creates it. */
  readonly unfit: readonly UnfitCreatingAct[];
  /** Whether any declared act creates the kind at all. */
  readonly creates: boolean;
}

/** The arguments an act's input requires, when its input is an object whose shape can be read. */
function requiredArgs(input: unknown): readonly string[] | undefined {
  const shape = (input as { _zod?: { def?: { shape?: Record<string, { _zod?: { optin?: string } }> } } } | undefined)?._zod?.def?.shape;
  if (!shape) return undefined;
  return Object.keys(shape).filter((arg) => shape[arg]?._zod?.optin !== "optional");
}

/** The act a record of `kind` from another system is made through, given the fields the connection maps. */
export function creatingActFor(mutations: readonly AnyMutationDefinition[], kind: string, mapped: readonly string[]): CreatingActChoice {
  const creating = mutations.filter((mutation) => (mutation.creates ?? []).includes(kind));
  const given = new Set([...mapped, "id"]);
  const fitting: string[] = [];
  const unfit: UnfitCreatingAct[] = [];
  for (const mutation of creating) {
    const subject = mutation.subject;
    if (subject) {
      unfit.push({ name: mutation.name, on: subject.kinds === "*" ? [] : subject.kinds });
      continue;
    }
    const asks = (requiredArgs(mutation.input) ?? []).filter((arg) => !given.has(arg));
    if (asks.length > 0) unfit.push({ name: mutation.name, asks });
    else fitting.push(mutation.name);
  }
  const act = fitting.find((name) => name === `add-${kind}`) ?? fitting[0];
  return { ...(act ? { act } : {}), unfit, creates: creating.length > 0 };
}
