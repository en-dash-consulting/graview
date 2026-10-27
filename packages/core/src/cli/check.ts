import type { HostView } from "../views/types.js";
import type { GraviewApp } from "../app.js";
import { deriveArchiveMutations, deriveEditMutations, deriveRemoveMutations } from "../mutations/derive-edits.js";
import { deriveRepeatMutations } from "../mutations/derive-repeats.js";
import { deriveRelationMutations } from "../mutations/derive-relations.js";
import type { AnySchema } from "../schema/schema.js";
import { designFindings } from "../document/design-findings.js";
import { moreLines } from "../document/findings.js";
import { toDocument } from "../document/to-document.js";

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
  checkJobs,
  checkAliases,
  checkActsFromEnds,
  checkBlankInstallation,
  checkEditableFields,
  checkFigures,
  checkLensBindings,
  checkDeclaredLenses,
  checkPagesArrangement,
  checkMigrations,
  checkModelWritten,
  checkModules,
  checkPalette,
  checkPlots,
  checkPeople,
  checkPolicy,
  checkProviders,
  checkReadings,
  checkRoutes,
  checkSettings,
  checkShippedLenses,
  checkArrangement,
  checkViewSpecs,
  checkComputed,
  checkHiddenReads,
  checkTypingAsks,
  checkFactRules,
  checkClockRules,
  checkFieldSight,
  checkCodeDescribes,
  checkForms,
  checkPublishing,
} from "./check/index.js";
import type { CheckContext, Finding } from "./check/context.js";

export type { Finding, Severity } from "./check/context.js";

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

/** What a host tells the checker beyond the declaration. */
export interface CheckOptions {
  /** The views the host keeps (`HostView`; a script view's manifest is one): what `view:<name>` in `pages` may name. Unsaid, such a name is a note. */
  readonly views?: readonly HostView[];
  /**
   * Whether the look is judged too (`designFindings`, Roadmap f-design-critic):
   * unsaid, yes. A document's compile judges its own document and says no here.
   */
  readonly design?: boolean;
}

/**
 * EVERY QUESTION A DECLARATION IS ASKED, in the order it is asked. Each
 * family of checks lives in `check/` and is handed the same context; the
 * order is the report's order, which is the order a person reads it in.
 */
export function checkApp<S extends AnySchema>(app: GraviewApp<S>, options: CheckOptions = {}): CheckResult {
  const findings: Finding[] = [];
  const kinds = new Set<string>(app.schema.kinds as readonly string[]);
  const declaredMutations = app.mutations ?? [];
  const derivedEdits = deriveEditMutations(app.schema, declaredMutations);
  const derivedRemoves = deriveRemoveMutations(app.schema, declaredMutations);
  // Declared and derived: a grant may name `edit-<kind>`, `remove-<kind>`, `archive-<kind>`, `unarchive-<kind>`, `merge-<kind>` or a relation's `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`, and a repair may too.
  const mutations = new Map([...declaredMutations, ...derivedEdits, ...derivedRemoves, ...deriveArchiveMutations(app.schema, declaredMutations), ...deriveRepeatMutations(app.schema, declaredMutations), ...deriveRelationMutations(app.schema, declaredMutations)].map((m) => [m.name, m]));
  const invariants = new Map((app.invariants ?? []).map((i) => [i.name, i]));

  const add = (f: Finding) => findings.push(f);
  const ctx: CheckContext<S> = { app, kinds, declaredMutations, derivedEdits, derivedRemoves, mutations, invariants, add, ...(options.views ? { views: options.views } : {}) };

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
  checkActsFromEnds(ctx, writtenByAModel);
  checkEditableFields(ctx);
  checkPolicy(ctx);
  checkPeople(ctx);
  checkFieldSight(ctx);
  checkForms(ctx);
  checkPublishing(ctx);
  checkPalette(ctx);
  checkLensBindings(ctx);
  checkDeclaredLenses(ctx);
  checkArrangement(ctx);
  checkPagesArrangement(ctx);
  checkViewSpecs(ctx);
  checkCodeDescribes(ctx);
  checkComputed(ctx);
  checkHiddenReads(ctx);
  checkTypingAsks(ctx);
  checkFactRules(ctx);
  checkClockRules(ctx);
  checkJobs(ctx);
  checkAliases(ctx);
  // The look: places that repeat, more than a person scans, a home with nothing to read first — judged of the app written as a document.
  if (options.design !== false) {
    for (const f of designFindings(toDocument(app).document)) add({ severity: f.severity, code: f.code, where: f.path, message: f.message, fix: f.fix ?? "", ...(f.edits ? { edits: f.edits } : {}) });
  }
  dropAnsweredGlances(findings, "glance-unchosen", (f) => /^defineNode\("([^"]+)"\)/.exec(f.where)?.[1]);

  const errors = findings.filter((f) => f.severity === "error").length;
  const notes = findings.filter((f) => f.severity === "note").length;
  const warnings = findings.length - errors - notes;
  return { app: app.name, findings, errors, warnings, notes, ok: errors === 0 };
}

/**
 * A glance the main kind is told to choose by its design finding, with the
 * edit, need not be asked again as a note: once is enough, the louder one.
 */
export function dropAnsweredGlances<F extends { readonly code: string; readonly edits?: readonly Record<string, unknown>[] }>(findings: F[], glance: string, kindOf: (f: F) => string | undefined): void {
  const told = new Set(findings.filter((f) => f.code === "design-no-card-for-main-kind").flatMap((f) => (f.edits ?? []).map((edit) => edit["kind"])));
  if (told.size === 0) return;
  for (let i = findings.length - 1; i >= 0; i--) if (findings[i]!.code === glance && told.has(kindOf(findings[i]!))) findings.splice(i, 1);
}

export function formatFindings(result: CheckResult): string {
  if (result.findings.length === 0) {
    return `graview check: ${result.app} — no problems found.`;
  }
  const said = { error: "ERROR", warning: "warn ", note: "note " } as const;
  const lines = result.findings.map((f) => `${said[f.severity]} [${f.code}] ${f.where}\n` + `        ${f.message}\n        fix: ${f.fix}` + moreLines(f, "        "));
  return [
    `graview check: ${result.app}`,
    ...lines,
    `${result.errors} error(s), ${result.warnings} warning(s)${
      result.notes > 0 ? `, ${result.notes} note(s)` : ""
    }`,
  ].join("\n");
}
