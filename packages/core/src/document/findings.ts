/*
 * A FINDING is a sentence about a place in the document.
 *
 * Every refusal the document path produces — malformed JSON, an edge to a
 * kind nobody declared, a rule that names a field the kind lacks, whatever
 * `graview check` says about the compiled app — arrives in this one shape,
 * so the web editor, the chat's `propose_change` and a CI annotation can all
 * point at the line. `path` is dotted from the document root
 * ("kinds.vendor.fields.status.options").
 */

export type Severity = "error" | "warning" | "note";

/**
 * ONE WAY OUT OF A FINDING, as a host offers it — a button a person presses
 * (Roadmap f-connection-refusal-in-plain-words, FR-229): what it does, in
 * the person's words, and the edits that do it where they can be written
 * down. One with no `edits` is a way the person takes by hand (a field
 * mapped to a property the app cannot name for them).
 */
export interface FindingFix {
  readonly label: string;
  readonly edits?: readonly Record<string, unknown>[];
}

export interface Finding {
  readonly severity: Severity;
  readonly code: string;
  readonly path: string;
  readonly message: string;
  /** What to do about it, when there is something to say. */
  readonly fix?: string;
  /**
   * The edits that do it, in `editDocument`'s (and `propose_change`'s) words —
   * `{ "op": "remove-lens", "title": "Stage: Planned" }` — where they can be
   * written down: a host applies them as they are.
   */
  readonly edits?: readonly Record<string, unknown>[];
  /**
   * The same, in the framework's words, for an agent and the CLI — the act
   * that asks, the fields it asks for — where `message` is the sentence a
   * person filling a form reads (FR-229).
   */
  readonly details?: string;
  /** The ways out, each one a host offers as a button, with its edits where they can be written. */
  readonly fixes?: readonly FindingFix[];
}

/** What a finding says beyond its sentence and its fix: given only where there is something to say, so a finding carries no empty key. */
export interface FindingMore {
  readonly edits?: readonly Record<string, unknown>[];
  readonly details?: string;
  readonly fixes?: readonly FindingFix[];
}

export const error = (code: string, path: string, message: string, fix?: string, more?: FindingMore): Finding => ({ severity: "error", code, path, message, ...(fix ? { fix } : {}), ...more });

export const warning = (code: string, path: string, message: string, fix?: string, edits?: readonly Record<string, unknown>[]): Finding => ({ ...error(code, path, message, fix, edits?.length ? { edits } : undefined), severity: "warning" });

export const hasErrors = (findings: readonly Finding[]) => findings.some((f) => f.severity === "error");

/** The lines beneath a finding's sentence: its edits, its details, and each way out with the edits that do it. */
export function moreLines(f: { readonly edits?: readonly Record<string, unknown>[]; readonly details?: string; readonly fixes?: readonly FindingFix[] }, indent: string): string {
  return [
    ...(f.edits ?? []).map((edit) => `${indent}edit: ${JSON.stringify(edit)}`),
    ...(f.details ? [`${indent}details: ${f.details}`] : []),
    ...(f.fixes ?? []).flatMap((fix) => [`${indent}fix: ${fix.label}`, ...(fix.edits ?? []).map((edit) => `${indent}  edit: ${JSON.stringify(edit)}`)]),
  ]
    .map((line) => `\n${line}`)
    .join("");
}

/** One line per finding, the way a person reads them in a chat; the edits that fix it, its details and its ways out, one to a line beneath it. */
export function sayFindings(findings: readonly Finding[]): string {
  return findings.map((f) => `${f.severity === "error" ? "✗" : f.severity === "warning" ? "!" : "·"} ${f.path || "(document)"}: ${f.message}${f.fix ? ` — ${f.fix}` : ""}${moreLines(f, "    ")}`).join("\n");
}
