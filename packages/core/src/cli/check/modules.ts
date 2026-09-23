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
import type { CheckContext } from "./context.js";

export function checkModules<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, kinds, mutations, invariants, add } = ctx;
  /*
   * MODULE BOUNDARIES hold statically, before any workspace flips a toggle.
   *
   * The runtime is forgiving — enabling a module drags its requirements in —
   * so the strict reading lives here: a module naming things nobody
   * declared, a requirement naming a module nobody wrote, and the leak that
   * only shows the day someone turns a module off: an always-on kind whose
   * edge reaches into a module. Ownership by kind, so the reasoning is
   * checkable per edge.
   */
  const moduleEntries = Object.entries(app.modules ?? {});
  const owners = new Map<string, Set<string>>();
  for (const [name, module] of moduleEntries) {
    for (const kind of module.kinds ?? []) {
      const set = owners.get(kind) ?? new Set<string>();
      set.add(name);
      owners.set(kind, set);
    }
  }
  const reach = (name: string): Set<string> => {
    const seen = new Set<string>();
    const walk = (current: string) => {
      if (seen.has(current)) return;
      seen.add(current);
      for (const required of (app.modules ?? {})[current]?.requires ?? []) walk(required);
    };
    walk(name);
    return seen;
  };
  for (const [name, module] of moduleEntries) {
    for (const kind of module.kinds ?? []) {
      if (!kinds.has(kind)) {
        add({
          severity: "error",
          code: "module-unknown-kind",
          where: `modules["${name}"].kinds`,
          message: `Module "${name}" claims kind "${kind}", which no defineNode declares.`,
          fix: `Declare the kind, or remove it from the module.`,
        });
      }
    }
    for (const mutation of module.mutations ?? []) {
      if (!mutations.has(mutation)) {
        add({
          severity: "error",
          code: "module-unknown-mutation",
          where: `modules["${name}"].mutations`,
          message: `Module "${name}" claims mutation "${mutation}", which is not registered.`,
          fix: `Register the mutation, or remove it from the module.`,
        });
      }
    }
    for (const invariant of module.invariants ?? []) {
      if (!invariants.has(invariant)) {
        add({
          severity: "error",
          code: "module-unknown-invariant",
          where: `modules["${name}"].invariants`,
          message: `Module "${name}" claims invariant "${invariant}", which is not registered.`,
          fix: `Register the invariant, or remove it from the module.`,
        });
      }
    }
    for (const required of module.requires ?? []) {
      if (!(required in (app.modules ?? {}))) {
        add({
          severity: "error",
          code: "module-unknown-requirement",
          where: `modules["${name}"].requires`,
          message: `Module "${name}" requires "${required}", which no module declares.`,
          fix: `Declare the module, or drop the requirement.`,
        });
      }
    }
  }
  if (moduleEntries.length > 0) {
    for (const definition of app.schema.definitions) {
      const from = owners.get(definition.kind);
      const fromReach =
        from === undefined
          ? null
          : new Set([...from].flatMap((name) => [...reach(name)]));
      for (const [edgeKind, edge] of Object.entries(definition.edges)) {
        if (edge.to === "*") continue;
        for (const target of edge.to) {
          const targetOwners = owners.get(target);
          if (!targetOwners) continue; // core is always on
          /*
           * A module that declares itself required is never off, so no line
           * into it can dangle — the same reason core is skipped one line
           * up. Without this the only answers an app has are to drop the
           * module, losing the thing it is for, or to carry a permanent
           * warning per edge; and a warning that can only ever be
           * acknowledged is one people learn to scroll past, which costs
           * the checker its authority on the warnings that matter.
           */
          if ([...targetOwners].every((owner) => app.modules?.[owner]?.required === true)) continue;
          const safe =
            fromReach === null
              ? false // an always-on kind reaching into a module
              : [...targetOwners].some((owner) => fromReach.has(owner));
          if (!safe) {
            add({
              severity: "warning",
              code: "module-edge-leak",
              where: `defineNode("${definition.kind}").edges["${edgeKind}"]`,
              message: `Edge "${edgeKind}" reaches "${target}", owned by module ${[...targetOwners].map((o) => `"${o}"`).join("/")} — the line dangles wherever that module is off.`,
              fix:
                fromReach === null
                  ? `Move "${definition.kind}" into the module, or make the module require nothing this kind depends on.`
                  : `Add the target's module to modules["${[...(from ?? [])].join('"/"')}"].requires, or move the edge into the module.`,
            });
          }
        }
      }
    }
  }
}
