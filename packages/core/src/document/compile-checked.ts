import { checkApp, dropAnsweredGlances } from "../cli/check.js";
import { designFindings } from "./design-findings.js";
import { actFindings } from "./act-findings.js";
import { linkedFindings } from "./linked-findings.js";
import { connectionFindings } from "./connection-findings.js";
import { factFindings, roleFindings } from "./facts-and-roles.js";
import { computedFindings } from "./computed.js";
import { brandFindings } from "./brand-check.js";
import { formatFindings } from "./format-findings.js";
import { frameworkPath, inDocumentText } from "./framework-path.js";
import { compileDocumentWithoutCheck, inDocumentWords, readDocument, type CompiledDocument, type CompileOptions, type RefusedDocument } from "./compile.js";
import { hasErrors, type Finding } from "./findings.js";
import { viewBraces, viewKeys } from "./views.js";
import { withRightNames } from "./right-names.js";
import { documentJobFindings } from "../job-findings.js";

/*
 * THE CHECKED COMPILE, in a module of its own: `compile.ts` is what a page
 * compiles a document with, and the checker it does not ask for — with
 * everything the checker reaches, the city among it — must not be reachable
 * from there, or a bundler places it in the page's first chunk (FR-57).
 * Exported from `@graview/core/check`.
 */
/**
 * A document, compiled and judged: its own sentences, then the framework's
 * `checkApp` over the app it compiles to — what a host does with a document
 * it is handed, and what `graview check` says of one.
 */
export function compileDocument(raw: unknown, options: CompileOptions = {}): CompiledDocument | RefusedDocument {
  const compiled = compileDocumentWithoutCheck(raw, options);
  if (!compiled.ok) {
    // A range and the other end of a link are judged here too (FR-114, FR-115), so a refusal says all of what is wrong.
    const read = readDocument(raw).document;
    // A name written in the other convention is told its right spelling (`right-names.ts`).
    const named = withRightNames(compiled.findings, raw);
    return { ok: false, findings: read ? [...named, ...actFindings(read), ...computedFindings(read), ...factFindings(read), ...roleFindings(read), ...formatFindings(read), ...linkedFindings(read), ...connectionFindings(read), ...documentJobFindings(read)] : named };
  }
  const { app, document } = compiled;
  // What the brand may hold (FR-124): a mark that could act or load, a face from off the list.
  // A block's key is its own in its view: a face claims it by that key.
  // A relation to another app's kinds (FR-171), said in the checker's words, not the page's.
  const own = [...linkedFindings(document), ...actFindings(document), ...formatFindings(document), ...computedFindings(document), ...factFindings(document), ...roleFindings(document), ...brandFindings(document.brand, options.fonts ? { fonts: options.fonts } : {}), ...viewKeys(document.views, "views", undefined, document.lenses), ...connectionFindings(document, app as never), ...documentJobFindings(document)];
  if (hasErrors(own)) return { ok: false, findings: [...compiled.findings, ...own] };
  // Braces in a block's plain words (FR-99): asked here, with the checker, and not of a page that compiles without it.
  // The checker's sentence for an accent (FR-126) or a ground says what the compile's did, and more: once is enough.
  const said = compiled.findings.filter((f) => !(f.code === "brand" && ((f.path === "brand.accent" && own.some((o) => o.code === "brand-accent")) || (f.path === "brand.ground" && own.some((o) => o.code === "brand-ground")))));
  const findings: Finding[] = [...said, ...own, ...viewBraces(document.views, "views", undefined, document.lenses)];
  // The look is judged of the document itself, in its own words and paths, so the framework's check is not asked it again.
  const check = checkApp(app, { ...(options.views ? { views: options.views } : {}), design: false });
  for (const f of check.findings) {
    // Located and said in the document's own words: `acts.finish.on`, never `defineMutation("finish")`.
    const finding = { severity: f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "note", code: `check:${f.code}`, path: frameworkPath(f.where, document), message: inDocumentText(f.message, document), ...(f.fix ? { fix: inDocumentText(f.fix, document) } : {}), ...(f.edits ? { edits: f.edits } : {}) } as const;
    // The document already said it, at the same path (a blocks lens's words are held by both): once is enough.
    if (compiled.findings.some((said) => said.code === f.code && said.path === finding.path)) continue;
    findings.push(f.code === "glance-unchosen" ? inDocumentWords(finding, f.where, document) : finding);
  }
  findings.push(...designFindings(document));
  dropAnsweredGlances(findings, "check:glance-unchosen", (f) => /^kinds\.([^.]+)\./.exec(f.path)?.[1]);
  if (hasErrors(findings)) return { ok: false, findings };
  return { ...compiled, findings };
}
