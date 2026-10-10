/* Its own module: a page draws the standing on its first load, and a rule's line only where one is drawn (`./line.ts`). */

/**
 * HOW MANY RULES ARE BROKEN, said as rules: "1 rule broken", "2 rules
 * broken", and "1 rule broken in 3 places" where one rule is broken by
 * several records — never "N problems are not kept".
 */
export function brokenWords(violations: readonly { readonly invariant: string }[]): string {
  const rules = new Set(violations.map((violation) => violation.invariant)).size;
  if (rules === 0) return "All rules hold";
  const said = `${rules} ${rules === 1 ? "rule" : "rules"} broken`;
  return violations.length > rules ? `${said} in ${violations.length} places` : said;
}
