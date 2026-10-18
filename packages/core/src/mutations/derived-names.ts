/**
 * THE ACTS EVERY KIND IS GIVEN, by name: what a grant, a rule's repair or a
 * rename reads to know an act it does not find declared is the framework's.
 * No imports, so the document's words and its compiler can read it without
 * bringing anything with them.
 */
export const DERIVED_ACTS = ["edit", "remove", "archive", "unarchive", "merge", "leave-alone", "allow-tidying"] as const;

/** The acts a kind with a date that repeats is given besides (`derive-repeats.ts`): skip one, change just one, change from one on. */
export const REPEAT_ACTS = ["skip", "detach", "split"] as const;

export type DerivedActName = (typeof DERIVED_ACTS)[number] | (typeof REPEAT_ACTS)[number];

/** Every derived act a kind has, by name. */
export const derivedActsOf = (kind: string): string[] => DERIVED_ACTS.map((act) => `${act}-${kind}`);

/** The derived act a name says and its kind: `archive-task` → archive, task. */
export function derivedActOf(name: string): { readonly act: DerivedActName; readonly kind: string } | undefined {
  const found = /^(edit|remove|archive|unarchive|merge|leave-alone|allow-tidying|skip|detach|split)-(.+)$/.exec(name);
  return found ? { act: found[1] as DerivedActName, kind: found[2]! } : undefined;
}

/** Whether a kind declared `archives: false` (FR-173) is still given this derived act: its edit and remove, never the three that set a record aside. */
export const givenWhenNeverArchived = (act: DerivedActName): boolean => act === "edit" || act === "remove" || act === "leave-alone" || act === "allow-tidying";

/** Whether a kind the declaration says is never tidied is still given this derived act: all but the two that leave one record alone, which it already is. */
export const givenWhenNeverTidied = (act: DerivedActName): boolean => act !== "leave-alone" && act !== "allow-tidying";

/**
 * THE ACTS EVERY RELATION IS GIVEN (Roadmap f-relation-acts-derived):
 * `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`, the
 * relation in kebab-case as an act's name is (`takenOn` → `taken-on`), per
 * kind that declares it, since who may link is read from that kind.
 */
export const RELATION_ACTS = ["connect", "disconnect"] as const;

export type RelationActName = (typeof RELATION_ACTS)[number];

/** A relation's name as an act's name spells it: `takenOn` → `taken-on`. */
export const relationInActName = (relation: string): string => relation.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The derived act that makes or breaks a kind's links of a relation: `connect-moment-taken-on`. */
export const relationActName = (act: RelationActName, kind: string, relation: string): string => `${act}-${kind}-${relationInActName(relation)}`;

/**
 * The relation act a name says, read against the kinds and the relations
 * each declares — the name alone cannot say where a kebab-case kind ends.
 * `relations` is the kinds that may give one: a relation to another app's
 * kind is a field (FR-171), given no such act.
 */
export function relationActOf(name: string, relations: Iterable<readonly [kind: string, relations: Iterable<string>]>): { readonly act: RelationActName; readonly kind: string; readonly relation: string } | undefined {
  const found = /^(connect|disconnect)-(.+)$/.exec(name);
  if (!found) return undefined;
  for (const [kind, held] of relations) {
    if (!found[2]!.startsWith(`${kind}-`)) continue;
    for (const relation of held) if (found[2] === `${kind}-${relationInActName(relation)}`) return { act: found[1] as RelationActName, kind, relation };
  }
  return undefined;
}

/** Every relation act a declaration gives, by name, before any declared act replaces one. */
export const relationActsOf = (relations: Iterable<readonly [kind: string, relations: Iterable<string>]>): string[] =>
  [...relations].flatMap(([kind, held]) => [...held].flatMap((relation) => RELATION_ACTS.map((act) => relationActName(act, kind, relation))));

const withA = (noun: string): string => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

/**
 * How a relation act's button reads, from the relation: a cardinality-one
 * relation is set and cleared ("Set the day", "Clear the day"), a many one
 * linked and unlinked ("Link a traveler"); from the other end, the kind it
 * leaves ("Link a moment"). `also` is the relation's own words, for when
 * another relation of the kind reaches the same kinds: "Set the person
 * (reviewer)". Shared by the derived act and a policy said in words.
 */
export function relationActTitles(act: RelationActName, ends: { readonly to: string; readonly from: string; readonly one: boolean; readonly also?: string | undefined }): { readonly title: string; readonly fromTheOtherEnd: string } {
  const tail = ends.also ? ` (${ends.also})` : "";
  const near = ends.one ? `${act === "connect" ? "Set" : "Clear"} the ${ends.to}` : `${act === "connect" ? "Link" : "Unlink"} ${withA(ends.to)}`;
  return { title: `${near}${tail}`, fromTheOtherEnd: `${act === "connect" ? "Link" : "Unlink"} ${withA(ends.from)}${tail}` };
}
