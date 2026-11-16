import type { GraviewApp } from "../../app.js";
import { deriveEditMutations, deriveMutations, deriveRemoveMutations } from "../../mutations/derive-edits.js";
import type { AnySchema } from "../../schema/schema.js";
import type { HostView } from "../../views/types.js";
import type { CheckContext, Finding } from "./context.js";

/**
 * WHAT EVERY CHECK IS HANDED, made from an app: what it declares by name,
 * declared and derived, and the one way a finding is said. `checkApp` asks
 * every family of checks over it; a page's composer asks the few it needs
 * (`composer-check.ts`, Roadmap f-light-composer).
 */
export function checkContextOf<S extends AnySchema>(app: GraviewApp<S>, add: (finding: Finding) => void, views?: readonly HostView[]): CheckContext<S> {
  const kinds = new Set<string>(app.schema.kinds as readonly string[]);
  const declaredMutations = app.mutations ?? [];
  const derivedEdits = deriveEditMutations(app.schema, declaredMutations);
  const derivedRemoves = deriveRemoveMutations(app.schema, declaredMutations);
  /*
   * Declared and derived, as the store derives them: its own list
   * (`deriveMutations`), so a grant or a repair may name any act the store
   * registers — `edit-`, `remove-`, `archive-`, `unarchive-`, `merge-`,
   * `leave-alone-` and `allow-tidying-<kind>`, a repeat's `skip-`, `detach-`
   * and `split-<kind>`, a relation's `connect-` and `disconnect-<kind>-<relation>`
   * — and a list kept here by hand cannot fall behind it again.
   */
  const mutations = new Map([...declaredMutations, ...deriveMutations(app.schema, declaredMutations)].map((m) => [m.name, m]));
  const invariants = new Map((app.invariants ?? []).map((i) => [i.name, i]));
  return { app, kinds, declaredMutations, derivedEdits, derivedRemoves, mutations, invariants, add, ...(views ? { views } : {}) };
}
