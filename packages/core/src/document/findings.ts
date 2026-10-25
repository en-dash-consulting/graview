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
}

export const error = (code: string, path: string, message: string, fix?: string): Finding => ({
  severity: "error",
  code,
  path,
  message,
  ...(fix ? { fix } : {}),
});

export const warning = (code: string, path: string, message: string, fix?: string, edits?: readonly Record<string, unknown>[]): Finding => ({
  severity: "warning",
  code,
  path,
  message,
  ...(fix ? { fix } : {}),
  ...(edits && edits.length > 0 ? { edits } : {}),
});

export const hasErrors = (findings: readonly Finding[]) => findings.some((f) => f.severity === "error");

/** One line per finding, the way a person reads them in a chat; the edits that fix it, one to a line beneath it. */
export function sayFindings(findings: readonly Finding[]): string {
  return findings.map((f) => `${f.severity === "error" ? "✗" : f.severity === "warning" ? "!" : "·"} ${f.path || "(document)"}: ${f.message}${f.fix ? ` — ${f.fix}` : ""}${(f.edits ?? []).map((edit) => `\n    edit: ${JSON.stringify(edit)}`).join("")}`).join("\n");
}
