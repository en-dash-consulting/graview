import { compileDocument } from "./compile-checked.js";
import type { CompileOptions } from "./compile.js";
import { checkTemplate, expandSetup, readGraviewTemplate, resolveAnswers, shiftSeed, withDefaults, type InstantiatedTemplate, type RefusedTemplate } from "./graview-template.js";
import type { Finding } from "./findings.js";

/*
 * Instantiating a template compiles its document WITH the checker, so it
 * lives beside the checked compile and is exported from
 * `@graview/core/check`, not from the document barrel a page imports.
 */
/**
 * WHAT IS WRONG WITH A TEMPLATE BEFORE ANYBODY ANSWERS IT — `graview check
 * template.json`: its shape, and what its questions, setup, examples and
 * views name against its document (handed in compiled, or compiled here).
 * No answers are judged; a document that does not compile is said by its
 * own compile, so only the template's shape is judged without one.
 */
export function templateFindings(raw: unknown, compiled?: Extract<ReturnType<typeof compileDocument>, { ok: true }>): Finding[] {
  const read = readGraviewTemplate(raw);
  if (!read.ok) return [...read.findings];
  const judged = compiled ?? compileDocument(read.template.document);
  return judged.ok ? checkTemplate(read.template, judged) : [];
}

/**
 * A template, made ready to install: its shape read, its document compiled
 * through the same compiler every document goes through, the answers held to
 * the questions, the setup expanded, and the example content judged against
 * the compiled schema. Everything is judged before anything happens; what
 * comes back is data a store applies.
 *
 * Setup may only create things or act on nothing: an answer can name a
 * category, never "the category made two steps ago".
 */
export function instantiateTemplate(raw: unknown, answers: Readonly<Record<string, unknown>> = {}, options: CompileOptions = {}): InstantiatedTemplate | RefusedTemplate {
  const read = readGraviewTemplate(raw);
  if (!read.ok) return read;
  const template = read.template;

  const compiled = compileDocument(template.document, options);
  if (!compiled.ok) return { ok: false, findings: compiled.findings.map((f) => ({ ...f, path: f.path ? `document.${f.path}` : "document" })) };

  const authoring = checkTemplate(template, compiled);
  if (authoring.length > 0) return { ok: false, findings: authoring };

  const resolved = resolveAnswers(template.questions, answers);
  if (!resolved.ok) return { ok: false, findings: resolved.findings };

  const setup = expandSetup(template, resolved.answers);
  if (!setup.ok) return { ok: false, findings: setup.findings };

  const today = options.today?.() ?? new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    template,
    document: compiled.document,
    compiled,
    answers: resolved.answers,
    setup: setup.calls,
    ...(template.seed ? { seed: shiftSeed({ ...template.seed, nodes: template.seed.nodes.map((n) => withDefaults(n, compiled.document)) }, compiled.document, today) } : {}),
  };
}
