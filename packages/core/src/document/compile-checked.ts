import { checkApp } from "../cli/check.js";
import { actFindings } from "./act-findings.js";
import { brandFindings } from "./brand-check.js";
import { compileDocumentWithoutCheck, frameworkPath, inDocumentWords, readDocument, type CompiledDocument, type CompileOptions, type RefusedDocument } from "./compile.js";
import { hasErrors, type Finding } from "./findings.js";
import { viewBraces } from "./views.js";

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
    return read ? { ok: false, findings: [...compiled.findings, ...actFindings(read)] } : compiled;
  }
  const { app, document } = compiled;
  // What the brand may hold (FR-124): a mark that could act or load, a face from off the list.
  const own = [...actFindings(document), ...brandFindings(document.brand, options.fonts ? { fonts: options.fonts } : {})];
  if (hasErrors(own)) return { ok: false, findings: [...compiled.findings, ...own] };
  // Braces in a block's plain words (FR-99): asked here, with the checker, and not of a page that compiles without it.
  // The checker's sentence for an accent (FR-126) says what the compile's did, and more: once is enough.
  const said = own.some((f) => f.code === "brand-accent") ? compiled.findings.filter((f) => !(f.code === "brand" && f.path === "brand.accent")) : compiled.findings;
  const findings: Finding[] = [...said, ...own, ...viewBraces(document.views, "views", undefined, document.lenses)];
  const check = checkApp(app);
  for (const f of check.findings) {
    const finding = { severity: f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "note", code: `check:${f.code}`, path: frameworkPath(f.where, document), message: f.message, ...(f.fix ? { fix: f.fix } : {}) } as const;
    // The document already said it, at the same path (a blocks lens's words are held by both): once is enough.
    if (compiled.findings.some((said) => said.code === f.code && said.path === finding.path)) continue;
    findings.push(f.code === "glance-unchosen" ? inDocumentWords(finding, f.where, document) : finding);
  }
  if (hasErrors(findings)) return { ok: false, findings };
  return { ...compiled, findings };
}
