import type { GraviewApp } from "./app.js";
import { checkRoutes } from "./cli/check/routes.js";
import { checkDeclaredLenses, checkLensBindings, checkShippedLenses } from "./cli/check/lenses.js";
import { checkContextOf } from "./cli/check/context-of.js";
import type { Finding as CheckFinding } from "./cli/check/context.js";
import { actFindings } from "./document/act-findings.js";
import { compileDocumentWithoutCheck, type CompiledDocument, type RefusedDocument } from "./document/compile.js";
import { computedFindings } from "./document/computed.js";
import { derivesFindings } from "./document/derives-findings.js";
import { exprTypeFindings } from "./document/expr-type-findings.js";
import { factFindings, roleFindings } from "./document/facts-and-roles.js";
import { hasErrors, type Finding } from "./document/findings.js";
import { formatFindings } from "./document/format-findings.js";
import { frameworkPath, inDocumentText } from "./document/framework-path.js";
import { nameMeansBothFindings } from "./document/guard-names.js";
import { linkedFindings } from "./document/linked-findings.js";
import type { GraviewDocument } from "./document/schema.js";
import { viewKeys } from "./document/views.js";
import { documentAliasFindings } from "./alias-findings.js";
import { documentJobFindings } from "./job-findings.js";
import type { AnySchema } from "./schema/schema.js";

/**
 * A CHANGED DOCUMENT, COMPILED AND JUDGED AS A PAGE'S COMPOSER JUDGES IT
 * (Roadmap f-light-composer): the compile a page already has, then the part
 * of the checker a change composed on a page can get wrong, so nothing is
 * offered that the host would then refuse: an act, a rule, a computed value,
 * a format, a link to another app, a job, an alias, a view's keys, and of
 * the framework's checks the pages' routes and the lenses' bindings.
 * Not asked: the city, the brand's contrast, the look, the arrangement and
 * the rest of `checkApp`, which stay with the host that keeps the change
 * (`compileDocument`, `@graview/core/check`). Errors refuse; warnings and
 * notes are the host's to say.
 */
export function compileForAChange(document: GraviewDocument): CompiledDocument | RefusedDocument {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) return compiled;
  const own: Finding[] = [...actFindings(document), ...derivesFindings(document), ...formatFindings(document), ...computedFindings(document), ...exprTypeFindings(document), ...factFindings(document), ...roleFindings(document), ...linkedFindings(document), ...viewKeys(document.views, "views", undefined, document.lenses), ...documentJobFindings(document), ...documentAliasFindings(document), ...nameMeansBothFindings(document, compiled.app)];
  if (hasErrors(own)) return { ok: false, findings: [...compiled.findings, ...own] };
  const checked: CheckFinding[] = [];
  const ctx = checkContextOf(compiled.app as GraviewApp<AnySchema>, (finding) => void (finding.severity === "error" && checked.push(finding)));
  checkRoutes(ctx);
  checkShippedLenses(ctx);
  checkLensBindings(ctx);
  checkDeclaredLenses(ctx);
  if (checked.length === 0) return compiled;
  // Said in the document's own words and paths, as the checked compile says them.
  return { ok: false, findings: checked.map((f) => ({ severity: "error", code: `check:${f.code}`, path: frameworkPath(f.where, document), message: inDocumentText(f.message, document) }) as Finding) };
}
