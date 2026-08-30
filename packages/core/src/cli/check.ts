import type { GraviewApp } from "../app.js";
import { nodeRefArgs } from "../mutations/node-ref.js";
import type { AnySchema } from "../schema/schema.js";

export type Severity = "error" | "warning";

export interface Finding {
  readonly severity: Severity;
  readonly code: string;
  /** Where the problem is, in terms an agent can act on. */
  readonly where: string;
  readonly message: string;
  /** The concrete edit that would fix it. */
  readonly fix: string;
}

export interface CheckResult {
  readonly app: string;
  readonly findings: readonly Finding[];
  readonly errors: number;
  readonly warnings: number;
  readonly ok: boolean;
}

/**
 * The build-time safety net. Most of these mistakes are already typecheck
 * failures — an edge to an undeclared kind, a view for a kind nobody
 * declared — but a schema assembled dynamically, or an app mid-rename, can
 * slip past `tsc`. Every message names the file-level thing to change,
 * because the primary reader is an agent editing the declaration.
 */
export function checkApp<S extends AnySchema>(app: GraviewApp<S>): CheckResult {
  const findings: Finding[] = [];
  const kinds = new Set<string>(app.schema.kinds as readonly string[]);
  const mutations = new Map((app.mutations ?? []).map((m) => [m.name, m]));
  const invariants = new Map((app.invariants ?? []).map((i) => [i.name, i]));

  const add = (f: Finding) => findings.push(f);

  for (const definition of app.schema.definitions) {
    for (const [edgeKind, edge] of Object.entries(definition.edges)) {
      if (edge.to === "*") continue;
      for (const target of edge.to) {
        if (!kinds.has(target)) {
          add({
            severity: "error",
            code: "edge-target-undeclared",
            where: `defineNode("${definition.kind}").edges["${edgeKind}"]`,
            message: `Edge "${edgeKind}" points at "${target}", which no defineNode declares.`,
            fix: `Declare a node kind "${target}", or change the target to one of: ${[...kinds].join(", ")}.`,
          });
        }
      }
    }

    for (const [role, field] of Object.entries(definition.fieldRoles ?? {})) {
      const shape = definition.fields.shape as Record<string, unknown>;
      if (!(field in shape)) {
        add({
          severity: "error",
          code: "field-role-missing-field",
          where: `defineNode("${definition.kind}").fieldRoles.${role}`,
          message: `Field role "${role}" maps to field "${field}", which is not in this kind's fields.`,
          fix: `Point the role at one of: ${Object.keys(shape).join(", ")}.`,
        });
      }
    }
  }

  for (const invariant of app.invariants ?? []) {
    if (invariant.scope !== "graph" && !kinds.has(invariant.scope.kind)) {
      add({
        severity: "error",
        code: "invariant-scope-undeclared",
        where: `defineInvariant("${invariant.name}").scope`,
        message: `Scoped to node kind "${invariant.scope.kind}", which no defineNode declares.`,
        fix: `Use one of: ${[...kinds].join(", ")}.`,
      });
    }
    for (const repair of invariant.repairs ?? []) {
      if (!mutations.has(repair)) {
        add({
          severity: "error",
          code: "repair-unknown-mutation",
          where: `defineInvariant("${invariant.name}").repairs`,
          message: `Names repair mutation "${repair}", which is not registered on this app.`,
          fix: `Register a mutation called "${repair}", or drop it from repairs. Registered: ${
            [...mutations.keys()].join(", ") || "(none)"
          }.`,
        });
      }
    }
  }

  for (const mutation of app.mutations ?? []) {
    const subject = mutation.subject;
    if (subject && subject.kinds !== "*") {
      for (const kind of subject.kinds) {
        if (!kinds.has(kind as string)) {
          add({
            severity: "error",
            code: "mutation-subject-undeclared",
            where: `defineMutation("${mutation.name}").subject.kinds`,
            message: `Subject kind "${String(kind)}" is not declared.`,
            fix: `Use one of: ${[...kinds].join(", ")}.`,
          });
        }
      }
      const shape = (mutation.input as { shape?: Record<string, unknown> }).shape;
      if (shape && !(subject.arg in shape)) {
        add({
          severity: "error",
          code: "mutation-subject-arg-missing",
          where: `defineMutation("${mutation.name}").subject.arg`,
          message: `Subject binds to argument "${subject.arg}", which is not in the input schema.`,
          fix: `Add "${subject.arg}" to the input, or point subject.arg at one of: ${Object.keys(shape).join(", ")}.`,
        });
      }
    }
    for (const ref of nodeRefArgs(mutation.input)) {
      for (const kind of ref.kinds) {
        if (kind !== "*" && !kinds.has(kind)) {
          add({
            severity: "error",
            code: "node-ref-undeclared",
            where: `defineMutation("${mutation.name}").input.${ref.name}`,
            message: `nodeRef accepts "${kind}", which no defineNode declares.`,
            fix: `Use one of: ${[...kinds].join(", ")}.`,
          });
        }
      }
    }
  }

  // A node kind whose declaration demands an invariant nobody wrote will
  // silently skip at runtime. That is the right default for evaluation but
  // the wrong default for a build.
  for (const definition of app.schema.definitions) {
    if (!definition.requiresInvariant) continue;
    const covered = new Set(
      (app.invariants ?? [])
        .filter((i) => i.scope !== "graph" && i.scope.kind === definition.kind)
        .map((i) => i.name),
    );
    if (covered.size === 0) {
      add({
        severity: "warning",
        code: "required-invariant-unregistered",
        where: `defineNode("${definition.kind}").requiresInvariant`,
        message: `"${definition.kind}" declares that its nodes require an invariant, but none is registered for that kind.`,
        fix: `Add a defineInvariant scoped to "${definition.kind}", or drop requiresInvariant.`,
      });
    }
  }

  if (app.views) {
    const withViews = new Set(app.views.kindsWithViews());
    for (const kind of kinds) {
      if (!withViews.has(kind)) {
        add({
          severity: "warning",
          code: "kind-without-view",
          where: `defineNode("${kind}")`,
          message: `No view is registered for "${kind}" — it will fall back to a primitive.`,
          fix: `Register a view with views.register("${kind}", { cardinality, fidelity }, Component), or accept the primitive fallback.`,
        });
      }
    }
    for (const registration of app.views.all()) {
      if (!kinds.has(registration.kind)) {
        add({
          severity: "error",
          code: "view-for-undeclared-kind",
          where: `views.register("${registration.kind}", ...)`,
          message: `A view is registered for "${registration.kind}", which no defineNode declares.`,
          fix: `Declare the kind, or remove the view registration.`,
        });
      }
    }
  }

  for (const lens of app.lenses ?? []) {
    for (const [kind, bindings] of Object.entries(lens.bindings ?? {})) {
      if (!kinds.has(kind)) {
        add({
          severity: "error",
          code: "lens-binding-undeclared-kind",
          where: `lens "${lens.name}" bindings`,
          message: `Binds roles for "${kind}", which no defineNode declares.`,
          fix: `Use one of: ${[...kinds].join(", ")}.`,
        });
        continue;
      }
      const definition = app.schema.tryDefinition(kind);
      if (!definition) continue;
      const shape = definition.fields.shape as Record<string, unknown>;
      for (const [role, field] of Object.entries(bindings)) {
        if (!(field in shape)) {
          add({
            severity: "error",
            code: "lens-binding-missing-field",
            where: `lens "${lens.name}" bindings.${kind}.${role}`,
            message: `Role "${role}" maps to field "${field}", which "${kind}" does not declare.`,
            fix: `Point it at one of: ${Object.keys(shape).join(", ")}.`,
          });
        }
      }
      for (const role of lens.requiredRoles) {
        if (!(role in bindings)) {
          add({
            severity: "error",
            code: "lens-role-unbound",
            where: `lens "${lens.name}" bindings.${kind}`,
            message: `Lens "${lens.name}" requires role "${role}", which "${kind}" does not bind.`,
            fix: `Add ${role}: "<field name>" to the bindings for "${kind}".`,
          });
        }
      }
    }
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;
  return { app: app.name, findings, errors, warnings, ok: errors === 0 };
}

export function formatFindings(result: CheckResult): string {
  if (result.findings.length === 0) {
    return `graview check: ${result.app} — no problems found.`;
  }
  const lines = result.findings.map(
    (f) =>
      `${f.severity === "error" ? "ERROR" : "warn "} [${f.code}] ${f.where}\n` +
      `        ${f.message}\n        fix: ${f.fix}`,
  );
  return [
    `graview check: ${result.app}`,
    ...lines,
    `${result.errors} error(s), ${result.warnings} warning(s)`,
  ].join("\n");
}
