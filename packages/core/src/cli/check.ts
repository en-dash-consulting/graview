import type { GraviewApp } from "../app.js";
import { deriveEditMutations, deriveRemoveMutations } from "../mutations/derive-edits.js";
import type { AnySchema } from "../schema/schema.js";

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
import {
  checkAccents,
  checkActsFromEnds,
  checkBlankInstallation,
  checkEditableFields,
  checkFigures,
  checkLensBindings,
  checkMigrations,
  checkModelWritten,
  checkModules,
  checkPalette,
  checkPlots,
  checkPolicy,
  checkProviders,
  checkReadings,
  checkEdgeNamesAgree,
  checkRoutes,
  checkSettings,
  checkShippedLenses,
  checkUnmakeable,
  checkArrangement,
} from "./check/index.js";
import type { CheckContext } from "./check/context.js";

export type Severity = "error" | "warning" | "note";

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
  /** Questions asked out loud: never a failure, always worth one read. */
  readonly notes: number;
  readonly ok: boolean;
}

/**
 * The build-time safety net. Most of these mistakes are already typecheck
 * failures — an edge to an undeclared kind, a view for a kind nobody
 * declared — but a schema assembled dynamically, or an app mid-rename, can
 * slip past `tsc`. Every message names the file-level thing to change,
 * because the primary reader is an agent editing the declaration.
 */

/**
 * EVERY QUESTION A DECLARATION IS ASKED, in the order it is asked. Each
 * family of checks lives in `check/` and is handed the same context; the
 * order is the report's order, which is the order a person reads it in.
 */
export function checkApp<S extends AnySchema>(app: GraviewApp<S>): CheckResult {
  const findings: Finding[] = [];
  const kinds = new Set<string>(app.schema.kinds as readonly string[]);
  const declaredMutations = app.mutations ?? [];
  const derivedEdits = deriveEditMutations(app.schema, declaredMutations);
  const derivedRemoves = deriveRemoveMutations(app.schema, declaredMutations);
  // Declared and derived: a grant may name `edit-<kind>` or `remove-<kind>`, and a repair may too.
  const mutations = new Map([...declaredMutations, ...derivedEdits, ...derivedRemoves].map((m) => [m.name, m]));
  const invariants = new Map((app.invariants ?? []).map((i) => [i.name, i]));

  const add = (f: Finding) => findings.push(f);
  const ctx: CheckContext<S> = { app, kinds, declaredMutations, derivedEdits, derivedRemoves, mutations, invariants, add };

  checkRoutes(ctx);
  checkShippedLenses(ctx);
  checkBlankInstallation(ctx);
  checkProviders(ctx);
  checkPlots(ctx);
  checkFigures(ctx);
  const writtenByAModel = checkModelWritten(ctx);
  checkSettings(ctx);
  checkMigrations(ctx);
  checkAccents(ctx);
  checkModules(ctx);
  checkReadings(ctx);
  checkEdgeNamesAgree(ctx);
  checkActsFromEnds(ctx, writtenByAModel);
  checkUnmakeable(ctx);
  checkEditableFields(ctx);
  checkPolicy(ctx);
  checkPalette(ctx);
  checkLensBindings(ctx);
  checkArrangement(ctx);

  const errors = findings.filter((f) => f.severity === "error").length;
  const notes = findings.filter((f) => f.severity === "note").length;
  const warnings = findings.length - errors - notes;
  return { app: app.name, findings, errors, warnings, notes, ok: errors === 0 };
}

export function formatFindings(result: CheckResult): string {
  if (result.findings.length === 0) {
    return `graview check: ${result.app} — no problems found.`;
  }
  const said = { error: "ERROR", warning: "warn ", note: "note " } as const;
  const lines = result.findings.map(
    (f) =>
      `${said[f.severity]} [${f.code}] ${f.where}\n` +
      `        ${f.message}\n        fix: ${f.fix}`,
  );
  return [
    `graview check: ${result.app}`,
    ...lines,
    `${result.errors} error(s), ${result.warnings} warning(s)${
      result.notes > 0 ? `, ${result.notes} note(s)` : ""
    }`,
  ].join("\n");
}
