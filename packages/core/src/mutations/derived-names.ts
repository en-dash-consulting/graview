/**
 * THE ACTS EVERY KIND IS GIVEN, by name: what a grant, a rule's repair or a
 * rename reads to know an act it does not find declared is the framework's.
 * No imports, so the document's words and its compiler can read it without
 * bringing anything with them.
 */
export const DERIVED_ACTS = ["edit", "remove", "archive", "unarchive", "merge"] as const;

/** The acts a kind with a date that repeats is given besides (`derive-repeats.ts`): skip one, change just one, change from one on. */
export const REPEAT_ACTS = ["skip", "detach", "split"] as const;

export type DerivedActName = (typeof DERIVED_ACTS)[number] | (typeof REPEAT_ACTS)[number];

/** Every derived act a kind has, by name. */
export const derivedActsOf = (kind: string): string[] => DERIVED_ACTS.map((act) => `${act}-${kind}`);

/** The derived act a name says and its kind: `archive-task` → archive, task. */
export function derivedActOf(name: string): { readonly act: DerivedActName; readonly kind: string } | undefined {
  const found = /^(edit|remove|archive|unarchive|merge|skip|detach|split)-(.+)$/.exec(name);
  return found ? { act: found[1] as DerivedActName, kind: found[2]! } : undefined;
}

/** Whether a kind declared `archives: false` (FR-173) is still given this derived act: its edit and remove, never the three that set a record aside. */
export const givenWhenNeverArchived = (act: DerivedActName): boolean => act === "edit" || act === "remove";
