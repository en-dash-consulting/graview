import { capitalize, lowerFirst } from "../capital.js";

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

/**
 * A CHOICE'S OPTION SPOKEN, where no label names it (Roadmap
 * f-lifelogics-findings). An id written in lower case is spoken as a key is
 * — `state-sponsored` "State sponsored", `inProgress` "In progress" — but a
 * capital the author wrote is theirs: `LifeLogics` stays "LifeLogics",
 * `Open Set` "Open Set", `En_Dash` "En Dash", `State-Sponsored` keeps its hyphen. A name a person wrote with
 * capitals read "Life logics" and "Open set", lowercased and split.
 */
export function humanizeValue(value: string): string {
  // Lower case throughout, or a key in camelCase (a lower-case start): spoken as a field's key is.
  if (!authorCased(value)) return humanizeField(value);
  const spaced = value.replace(/[_\s]+/g, " ").trim();
  return capitalize(spaced);
}

/** Whether an option's id carries capitals its author wrote, not a key's camelCase: `LifeLogics`, `Open Set`, `SUV`. */
const authorCased = (value: string): boolean => /[A-Z]/.test(value) && !/^[a-z][a-zA-Z0-9]*$/.test(value);

/**
 * A CHOICE'S OPTION SAID INSIDE A SENTENCE, where no label names it: a
 * describe line's "Rainy day (idea)", a rule's "high risk". Spoken as a
 * key is and in lower case — "supply chain", never "supply-chain" — but a
 * capital its author wrote, or an abbreviation's letters, are kept:
 * "LifeLogics", "CVSS".
 */
export function optionInSentence(value: string): string {
  return authorCased(value) ? humanizeValue(value) : lowerFirst(humanizeField(value));
}
