import { appFrom, type AppFromOptions, type CompiledDocument, type RefusedDocument } from "./document/compiled.js";

/*
 * `@graview/core/compiled` — the app a host compiled on its server, built
 * in the page (FR-123).
 *
 * An entry of its own, not part of `@graview/core/document`: a page that is
 * handed `serializeCompiled(compileDocument(doc))` as JSON needs only the
 * half of compiling that builds the app — the field schemas, the closures
 * that run acts and judge rules, the evaluator and the template renderer —
 * and none of the reader, the validator, the expression parser or the view
 * checker. Importing it from here keeps them out of the page's first chunk;
 * `appFromOrCompile` fetches the compiler only when it must compile after
 * all (no compiled app was handed, or one of another format). A page that
 * imports `@graview/core/document` up front for anything at all brings the
 * compiler back with it — a bundler places every module a chunk reaches in
 * that chunk — so what such a page says of a refusal, `sayFindings`, is
 * here too.
 */
export { appFrom, COMPILED_FORMAT, serializeCompiled } from "./document/compiled.js";
export type { ActPlan, AppFromOptions, ArgPlan, CompiledApp, CompiledDocument, EdgePlan, KindPlan, RefusedDocument, RulePlan } from "./document/compiled.js";
export { sayFindings } from "./document/findings.js";
export type { Finding } from "./document/findings.js";

/**
 * The app a host handed the page, or — when it handed none, or one this
 * build cannot read — the document compiled here, as before. The compiler
 * is fetched only then, from a fixed path of the framework's own: a stale
 * compiled app cached from another build costs one more request, not a
 * broken page. `handed` is the host's answer, `{ document, compiled }` as
 * Graview Cloud's `/graview/document` serves it.
 */
export async function appFromOrCompile(handed: { readonly compiled?: unknown; readonly document: unknown }, options: AppFromOptions = {}): Promise<CompiledDocument | RefusedDocument> {
  const built = handed.compiled === undefined ? undefined : appFrom(handed.compiled, options);
  if (built?.ok) return built;
  const { compileDocumentWithoutCheck } = await import("./document/compile.js");
  return compileDocumentWithoutCheck(handed.document, options);
}
