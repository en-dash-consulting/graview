import type { GraviewApp } from "../../app.js";
import { deriveArchiveMutations, deriveEditMutations, deriveRemoveMutations } from "../../mutations/derive-edits.js";
import { deriveRepeatMutations } from "../../mutations/derive-repeats.js";
import { deriveRelationMutations } from "../../mutations/derive-relations.js";
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
  // Declared and derived: a grant may name `edit-<kind>`, `remove-<kind>`, `archive-<kind>`, `unarchive-<kind>`, `merge-<kind>` or a relation's `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`, and a repair may too.
  const mutations = new Map([...declaredMutations, ...derivedEdits, ...derivedRemoves, ...deriveArchiveMutations(app.schema, declaredMutations), ...deriveRepeatMutations(app.schema, declaredMutations), ...deriveRelationMutations(app.schema, declaredMutations)].map((m) => [m.name, m]));
  const invariants = new Map((app.invariants ?? []).map((i) => [i.name, i]));
  return { app, kinds, declaredMutations, derivedEdits, derivedRemoves, mutations, invariants, add, ...(views ? { views } : {}) };
}
