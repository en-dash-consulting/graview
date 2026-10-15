import type { Finding } from "./findings.js";

/*
 * THE TWO CONVENTIONS, SAID TOGETHER, with the name as it should be. A
 * document's kinds, acts, rules and roles are kebab-case (`tool-note`) and
 * its fields and relations camelCase (`supersededBy`), so a rule can say a
 * field bare; the first write met one rule at a time. The name is not
 * respelled for the author: a kind's name is stored in every record
 * (`"kind": "tool-note"` in a seed and the log) and names its derived acts
 * (`add-tool-note`), so a document quietly renamed would disagree with its
 * own seed and data. The fix says the exact name instead.
 *
 * Asked of a refused document by the checked compile (`compile-checked.ts`),
 * not by the compile a page carries up front: a page is handed documents
 * that already compile.
 */

/** The words of a name, however it was joined: `toolNote`, `tool_note`, `Tool Note` and `tool-note` are tool, note. */
const wordsOf = (given: string): string[] =>
  given
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

const BOTH = 'Kinds, acts, rules and roles are kebab-case, like "tool-note"; fields and relations are camelCase, like "supersededBy", so a rule can say them bare.';

/** The fix for a name written in the other convention: its right spelling, and both rules. Undefined for a sentence about anything else. */
export function namedRightly(given: string, said: string): string | undefined {
  const words = wordsOf(given);
  if (words.length === 0 || !/^[a-z]/.test(words[0]!)) return undefined;
  const right = /joined by hyphens/.test(said) ? words.join("-") : /camelCase/.test(said) ? words.map((word, at) => (at === 0 ? word : `${word[0]!.toUpperCase()}${word.slice(1)}`)).join("") : undefined;
  if (right === undefined) return undefined;
  return right !== given ? `Call it "${right}". ${BOTH}` : BOTH;
}

/**
 * A refused document's findings, each that refused a name given its fix: a
 * key (`kinds.toolNote`, whose name is the path's last step) or a value
 * naming one (`acts.add-note.creates`, read from the document).
 */
export function withRightNames(findings: readonly Finding[], raw: unknown): Finding[] {
  let document = raw;
  if (typeof raw === "string") {
    try {
      document = JSON.parse(raw) as unknown;
    } catch {
      return [...findings];
    }
  }
  return findings.map((finding) => {
    if (finding.code !== "shape" || finding.fix) return finding;
    const key = /^the name "([^"]*)" is not allowed here/.exec(finding.message)?.[1];
    const value = key === undefined ? finding.path.split(".").reduce<unknown>((at, step) => (at as Record<string, unknown> | undefined)?.[step], document) : undefined;
    const given = key ?? (typeof value === "string" ? value : undefined);
    const fix = given === undefined ? undefined : namedRightly(given, finding.message);
    return fix ? { ...finding, fix } : finding;
  });
}
