import { capitalize } from "../capital.js";

/** A key spoken: `plannedAt` is "Planned at", `state-sponsored` "State sponsored", `sourceUrl` "Source URL". */
export function humanizeField(field: string): string {
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  // An abbreviation said as its letters is written as them: `cvss` is "CVSS", `sourceUrl` "Source URL", `ids` "IDs".
  return capitalize(spaced.replace(/\b[a-z]+\b/g, (word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.endsWith("s") && ACRONYMS.has(word.slice(0, -1)) ? `${word.slice(0, -1).toUpperCase()}s` : word)));
}

/**
 * THE ABBREVIATIONS A KEY IS SPOKEN AS LETTERS. Only words nobody reads as
 * a word: a list, not a guess from length or vowels — `pts`, `hrs` and `dr`
 * are abbreviations said as words, and "Mr" is not "MR".
 */
const ACRONYMS: ReadonlySet<string> = new Set(
  "id url uri api ip ioc cve cvss cwe cpe sku vat iban isbn pdf csv json html css sla kpi roi faq ssn ein vin gps sms crm erp seo utm ui ux ai dns ssl tls http https sql uuid mfa sso cto ceo cfo coo rsvp eta".split(" "),
);
