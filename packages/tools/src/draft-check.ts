import { sanitizeStylesheet, viewFaceRefusedWords, type CssRefusal } from "@graview/core/css";
import { styleStringsOf } from "./section.js";

/*
 * A DRAFT IS JUDGED BEFORE ANYBODY SEES IT (Roadmap f-make-any-page-better):
 * what a page or a section showed, read before the draft and read again
 * from the draft as it was drawn — its headings, its records, its words,
 * where each record stands — and compared by code. What breaks is handed
 * back to the model in words it can fix; what changed is said to the
 * person in the code's own words, never the model's account of itself.
 * Pure: the page reads the drawing (`draft-read.ts` in primitives) and
 * hands plain data here.
 */

/**
 * A drawing read for judging: its headings in order, the records it shows
 * in order with where and how big, and all its words. Each record carries
 * what its row or card says beside its name (`facts`: "Todo", "Sep 3,
 * 2026", "3 tasks"; never a nested record's), the words of the block that
 * holds it and no other record (`row`: a tag one box over from its link is
 * still its), and the heading it sits under (`under`).
 */
export interface DrawnRead {
  readonly headings: readonly string[];
  readonly records: readonly {
    readonly label: string;
    readonly top: number;
    readonly left: number;
    readonly size: number;
    readonly facts?: readonly string[];
    readonly row?: string;
    readonly under?: string;
    /** Whether its row offered a control to press (a circle that finishes it, a toggle), and whether its name opened it. */
    readonly presses?: boolean;
    readonly opens?: boolean;
  }[];
  readonly text: string;
}

const norm = (words: string) => words.replace(/\s+/g, " ").trim().toLowerCase();
const counted = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** A list said in words: "a", "a and b", "a, b and c". */
const listed = (list: readonly string[]) => (list.length < 2 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);

/** One refusal of a stylesheet, with the rule it was in (its selector, or its at-rule's head) and what of that rule was kept. */
interface StyleRefusal {
  readonly refusal: CssRefusal;
  readonly rule?: string;
  readonly kept?: readonly string[];
}

/**
 * What a refused stylesheet rule needs, in words a model can act on — and,
 * where it was in a rule, which rule and what of it was kept: "In “.home
 * .lg”, the property “image-rendering” is not allowed and is removed
 * (border-radius is kept): …".
 */
function refusalWords({ refusal, rule, kept }: StyleRefusal): string {
  const name = refusal.name ? `“${refusal.name}”` : "";
  const where = rule ? `In “${rule}”, ` : "";
  const keeps = kept && kept.length > 0 ? ` (${listed(kept)} ${kept.length === 1 ? "is" : "are"} kept)` : "";
  const begun = (words: string) => (where ? `${where}${words}` : words.charAt(0).toUpperCase() + words.slice(1));
  switch (refusal.reason) {
    case "selector":
      return `The selector “${/^(host|host-context)$/.test(refusal.name ?? "") ? ":" : /^(slotted|part)$/.test(refusal.name ?? "") ? "::" : ""}${refusal.name ?? ""}” reaches outside the view and is removed with its rule: give the view's outer element a class and style that instead.`;
    case "at-rule":
      return `${name || "An at-rule"} is not allowed and is removed with what it holds: use plain rules and @media only.`;
    case "property":
      return `${begun(`the property ${name}`)} is not allowed and is removed${keeps}: use ordinary layout, color and type properties.`;
    case "function":
      return `${begun(`the function ${name}()`)} is not allowed and is removed${keeps}: use var(--graview-…), calc(), min(), max(), clamp() or repeat().`;
    case "url":
      return `${begun("url()")} is not allowed and is removed${keeps}: draw nothing from an address.`;
    case "value":
      return `${begun(`a value of ${name || "a property"}`)} is not allowed and is removed${keeps} (position may be static, relative, absolute or sticky).`;
    case "size":
      return "The stylesheet is too long and is removed whole: keep it short.";
    case "font-face":
      return viewFaceRefusedWords(refusal);
    default:
      return `${begun(`a rule ${name ? `near ${name} ` : ""}`)}could not be read and is removed: write plain CSS, one rule at a time, no nesting.`;
  }
}

/** The rules of a stylesheet at its top level, each with its head (a selector, or an at-rule's prelude) and its whole text. */
function topRules(css: string): { readonly head: string; readonly text: string }[] {
  const rules: { head: string; text: string }[] = [];
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => " ".repeat(comment.length));
  let at = 0;
  while (at < bare.length) {
    const open = bare.indexOf("{", at);
    if (open < 0) break;
    let depth = 0;
    let close = open;
    for (; close < bare.length; close++) {
      if (bare[close] === "{") depth += 1;
      else if (bare[close] === "}" && --depth === 0) break;
    }
    rules.push({ head: bare.slice(at, open).replace(/\s+/g, " ").trim(), text: bare.slice(at, close + 1) });
    at = close + 1;
  }
  return rules;
}

/** The properties a sanitized rule kept, in order: each declaration's name in `selector { name: value; … }` — none for an at-rule's. */
function keptOf(css: string): string[] {
  const open = css.indexOf("{");
  if (open < 0 || css.trimStart().startsWith("@")) return [];
  return [...new Set([...css.slice(open + 1).matchAll(/(?:^|;)\s*(-{0,2}[a-zA-Z][\w-]*)\s*:/g)].map((one) => one[1]!))];
}

/** What the host's sanitizer refuses of a script's stylesheets, each with the rule it was in and what of that rule was kept. */
function styleRefusalsOf(source: string): StyleRefusal[] {
  const found: StyleRefusal[] = [];
  for (const sheet of styleStringsOf(source)) {
    const written = source.slice(sheet.start, sheet.end);
    const css = written.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, "0");
    /* A view's own sheet, whose data: faces are kept (HQ f-view-font-face-data). A face whose bytes come in a ${…} is read here as "0": not judged by what stands in for it. */
    const faced = (refusals: readonly CssRefusal[]) => (css === written ? refusals : refusals.filter((one) => one.reason !== "font-face"));
    const whole = faced(sanitizeStylesheet(css, undefined, { faces: true }).refused);
    if (whole.length === 0) continue;
    if (whole.some((one) => one.reason === "size")) {
      found.push({ refusal: { reason: "size" } });
      continue;
    }
    // Each rule judged alone, as the sanitizer judges it among the rest, so what it refuses is said with its own selector.
    const left = [...whole];
    for (const rule of topRules(css)) {
      const judged = sanitizeStylesheet(rule.text, undefined, { faces: true });
      const kept = keptOf(judged.css);
      for (const refusal of faced(judged.refused)) {
        const at = left.findIndex((one) => one.reason === refusal.reason && one.name === refusal.name);
        if (at < 0) continue;
        left.splice(at, 1);
        found.push({ refusal, ...(rule.head ? { rule: rule.head } : {}), ...(kept.length > 0 ? { kept } : {}) });
      }
    }
    // What no one rule accounts for is said as the sheet's.
    found.push(...left.map((refusal) => ({ refusal })));
  }
  return found;
}

/** What makes two refusals the same: what was refused, why, and in which rule — never what else of the rule was kept. */
const refusalKey = (one: StyleRefusal) => `${one.refusal.reason}|${one.refusal.name ?? ""}|${(one.rule ?? "").replace(/\s+/g, "")}`;

/**
 * WHAT THE HOST WOULD STRIP FROM A SCRIPT'S STYLESHEETS, before it is
 * drawn: each `graview.style` string read by the framework's own
 * sanitizer, and what it refuses said by its rule — which rule, what of it
 * was kept, why the rest is not — and what to do instead. With `already`
 * (the script on the page), a refusal that script had too is left out: the
 * page draws without it now, and a draft that keeps it changes nothing.
 */
export function cssFindings(source: string, options: { readonly already?: string } = {}): string[] {
  const before = options.already === undefined ? new Set<string>() : new Set(styleRefusalsOf(options.already).map(refusalKey));
  const findings = new Set<string>();
  for (const one of styleRefusalsOf(source)) if (!before.has(refusalKey(one))) findings.add(refusalWords(one));
  return [...findings];
}

const ISO_DAY = /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/;
const MARKUP = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?>/i;
const RAW = /(?<![\w])(undefined|null|NaN|\[object Object\]|true|false)(?![\w])/g;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_SAID = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b|\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/;
const WEEKDAY = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(today|tomorrow|yesterday)\b/;

/**
 * WHETHER A ROW STILL SAYS A FACT IT SAID, in other words if it likes: the
 * same words, or the same day of the same month ("Sep 3, 2026" as "3
 * September" or "Sep 3"), or the same number where the fact was one.
 */
export function rowSays(row: string, fact: string): boolean {
  const said = norm(row);
  const wanted = norm(fact);
  if (!wanted) return true;
  if (said.includes(wanted)) return true;
  // "To do" for "Todo", "in-progress" for "In progress": the same letters, spaced or joined.
  const squashed = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, "");
  if (squashed(wanted).length >= 3 && squashed(said).includes(squashed(wanted))) return true;
  const day = DAY_SAID.exec(wanted);
  if (day) {
    const month = (day[1] ?? day[4])!;
    const date = Number(day[2] ?? day[3]);
    for (const one of said.matchAll(new RegExp(DAY_SAID.source, "g"))) if ((one[1] ?? one[4]) === month && Number(one[2] ?? one[3]) === date) return true;
    // A day said by its weekday or as "today" stands for it where the draft says no month at all.
    return MONTHS.every((name) => !said.includes(name)) && WEEKDAY.test(said);
  }
  // A count is held by its number, said in figures or in words: "0 stories" as "no stories", "1 chapters" as "one chapter".
  const number = /^\D*(\d+(?:[.,]\d+)?)\D*$/.exec(wanted);
  if (number) {
    if (new RegExp(`(^|\\D)${number[1]!.replace(/[.,]/g, "[.,]")}(\\D|$)`).test(said)) return true;
    const count = Number(number[1]);
    if (count === 0) return /\b(no|none|zero|nothing|not any)\b/.test(said);
    return Number.isInteger(count) && count < counted.length && new RegExp(`\\b${counted[count]}\\b`).test(said);
  }
  return false;
}

/** Words that ask for something a page showed to go: "hide the dates", "just the names", "without the status". */
const TAKE_AWAY = /\b(hide|hides|hiding|remove|drop|without|no more|less|fewer|only|just|minimal|simpler|declutter|strip)\b/i;
/** Words that ask for records to be grouped or moved differently. */
const REGROUP = /\b(group|groups|grouped|regroup|section|sections|categor\w*|split|move|moved|bucket\w*|by (status|date|day|list|owner|person))\b/i;

/** Whether the words asked a fact like this one to go: a dates' fact by "dates", a status by "status", anything by "just the names". */
function askedAway(asked: string | undefined, fact: string): boolean {
  if (!asked || !TAKE_AWAY.test(asked)) return false;
  const words = asked.toLowerCase();
  if (/\b(only|just)\b[^.]*\b(name|names|title|titles|label|labels)\b/.test(words)) return true;
  if (DAY_SAID.test(norm(fact)) || WEEKDAY.test(norm(fact))) return /\b(date|dates|due|day|days|when|deadline|deadlines)\b/.test(words);
  if (/^\D*\d/.test(fact)) return /\b(count|counts|number|numbers|how many|total|totals)\b/.test(words);
  return /\b(status|statuses|state|tag|tags|chip|chips|badge|badges|label|labels|pill|pills|meta|details)\b/.test(words) || words.includes(norm(fact));
}

/** Words that ask for a heading's words to change: "reword the top heading", "a shorter title", "rename this section". */
const REWORD_VERB = /\b(re-?word\w*|re-?name\w*|re-?title\w*|re-?phrase\w*|rewrite|shorten|shorter|longer|wording|words|call it|say|says)\b/i;
const A_HEADING = /\b(heading|headings|title|titles|header|headers|headline|headlines)\b/i;

/** Whether the person's words ask for a heading's words to change. */
export function asksToReword(asked: string | undefined): boolean {
  return Boolean(asked && REWORD_VERB.test(asked) && A_HEADING.test(asked));
}

/**
 * WHAT A DRAFT CHANGED THE WORDS OF, IN PLACE: each name of `before` that
 * stands where a new name now stands — the same number of names, the one
 * at that place no longer among them and the new one never among them
 * before — by its old name. A part is found by where it stands, not by
 * its words: a heading reworded is the same heading.
 */
export function renamedInPlace(before: readonly string[], after: readonly string[]): ReadonlyMap<string, string> {
  const renamed = new Map<string, string>();
  if (before.length !== after.length) return renamed;
  const was = new Set(before.map(norm));
  const now = new Set(after.map(norm));
  before.forEach((name, at) => {
    const next = after[at]!;
    if (norm(name) !== norm(next) && !now.has(norm(name)) && !was.has(norm(next))) renamed.set(name, next);
  });
  return renamed;
}

/**
 * THE NAMES A DRAFT NO LONGER DRAWS that it may not have changed: of
 * `lost`, each but those reworded in place (`renamedInPlace`) where the
 * person asked for a heading's words to change — and, where the part being
 * changed is named (`mayReword`, its own headings), only that part's.
 */
export function lostUnlessReworded(lost: readonly string[], before: readonly string[], after: readonly string[], options: { readonly mayReword?: readonly string[]; readonly asked?: string }): string[] {
  if (!asksToReword(options.asked)) return [...lost];
  const renamed = renamedInPlace(before, after);
  const theirs = (name: string) => !options.mayReword || options.mayReword.some((one) => norm(one) === norm(name));
  return lost.filter((name) => !(renamed.has(name) && theirs(name)));
}

/**
 * WHAT A CHECK FOUND, BY WHAT IT IS: a record left out or shown twice, a
 * fact a record no longer says, a record in another group, a heading or a
 * part no longer drawn, the title drawn twice, words shown as the computer
 * keeps them, a style the page will not keep, a class left unstyled, a
 * control that does not work, a draft that did not draw, an edit whose
 * text is not in the script once (`edit-missed`) — and `other`, said in
 * its own words.
 */
export type FindingKind = "record-lost" | "record-twice" | "fact-lost" | "record-moved" | "heading-lost" | "section-lost" | "title-twice" | "computer-words" | "style-refused" | "unstyled" | "control" | "did-not-draw" | "edit-missed" | "other";

/** A finding with what it is: what a host logs, and what the panel says it by. */
export interface DraftFinding {
  readonly kind: FindingKind;
  readonly words: string;
}

/** What one finding is, read from its words. */
export function findingKind(finding: string): FindingKind {
  if (/^Edit \d+: “|^There is no script to edit|^Your edits change nothing/.test(finding)) return "edit-missed";
  if (/no longer says what it said/.test(finding)) return "fact-lost";
  if (/^It no longer shows “/.test(finding)) return "record-lost";
  if (/more often than the page did/.test(finding)) return "record-twice";
  if (/moved to another group/.test(finding)) return "record-moved";
  if (/no longer shows the heading/.test(finding)) return "heading-lost";
  if (/” is not drawn any more\.?$/.test(finding)) return "section-lost";
  if (/drawn twice/.test(finding)) return "title-twice";
  if (/markup as words|a date as “|as the computer keeps it|a field's name/.test(finding)) return "computer-words";
  if (/is still drawn and no rule styles it/.test(finding)) return "unstyled";
  if (/can no longer be marked|no longer opens? (its|their) page/.test(finding)) return "control";
  if (/did not draw|did not start|threw while drawing|could not start/.test(finding)) return "did-not-draw";
  if (/not allowed|is removed|reaches outside/.test(finding)) return "style-refused";
  return "other";
}

/**
 * ONE DRAFT AS BETTER UI'S CHECKS JUDGED IT, told to the host
 * (`HostAi.onDraftChecked`): the part it was for, which draft of the turn
 * it was, whether it passed, and each finding whole with its kind.
 */
export interface DraftChecked {
  readonly part: string;
  readonly draft: number;
  readonly passed: boolean;
  readonly findings: readonly DraftFinding[];
}

/** Each finding with its kind. */
export const findingsOf = (findings: readonly string[]): DraftFinding[] => findings.map((words) => ({ kind: findingKind(words), words }));

/**
 * WHAT A DRAFT BROKE, against what the page showed: a record or a heading
 * it no longer shows, a fact a record's row said that its card no longer
 * says (its status, its date, a count), a record moved under another
 * heading, a heading drawn twice, and words no person was shown before — a
 * field's own name with its value as kept beside it, a date as the
 * computer keeps it, `true`, `undefined` where no record's own words
 * (`values`, each field's values as kept) say it. A count is held by its
 * number ("0 stories" may be "no stories"). A fact or a group the person asked to change (`asked`: "hide the dates",
 * "group by status") is theirs to change, and so is a heading's wording
 * they asked for — in its place, and only the part's being changed
 * (`mayReword`) where one is. Empty when the draft may be shown.
 */
export function drawnFindings(before: DrawnRead, after: DrawnRead, options: { readonly fields?: readonly string[]; readonly values?: Readonly<Record<string, readonly unknown[]>>; readonly asked?: string; readonly mayReword?: readonly string[] } = {}): string[] {
  const findings: string[] = [];
  const text = norm(after.text);
  const lost = before.records.map((one) => one.label).filter((label) => label && !text.includes(norm(label)));
  if (lost.length > 0) findings.push(`It no longer shows ${lost.slice(0, 4).map((one) => `“${one}”`).join(", ")}${lost.length > 4 ? ` and ${lost.length - 4} more` : ""}: show every record the page showed.`);
  // A record shown more times than the page showed it: put under a group it is not in, as well as its own.
  const times = (words: string, label: string) => words.split(norm(label)).length - 1;
  const shownBefore = norm(before.text);
  const twiceOver = before.records.map((one) => one.label).filter((label) => label && times(text, label) > times(shownBefore, label));
  if (twiceOver.length > 0 && !(options.asked && REGROUP.test(options.asked))) findings.push(`It shows ${twiceOver.slice(0, 4).map((one) => `“${one}”`).join(", ")}${twiceOver.length > 4 ? ` and ${twiceOver.length - 4} more` : ""} more often than the page did: show each record where the page showed it, and nowhere else.`);
  // What each record's row said, said still: each fact by the record it was about, in words or as the same day.
  const factsLost: string[] = [];
  const moved: string[] = [];
  for (const was of before.records) {
    const now = after.records.find((one) => norm(one.label) === norm(was.label));
    if (!now) continue;
    // A fact said by the heading it now sits under ("Doing" over a column of what is doing) is said still.
    const row = `${now.row ?? ""} ${now.under ?? ""}`;
    for (const fact of was.facts ?? []) if (!rowSays(row, fact) && !askedAway(options.asked, fact)) factsLost.push(`“${fact}” on “${was.label}”`);
    if (was.under && now.under && norm(was.under) !== norm(now.under) && after.headings.some((one) => norm(one) === norm(was.under!)) && !(options.asked && REGROUP.test(options.asked))) moved.push(`“${was.label}” is under “${now.under}”, and was under “${was.under}”`);
  }
  if (factsLost.length > 0) findings.push(`A record no longer says what it said: ${factsLost.slice(0, 4).join(", ")}${factsLost.length > 4 ? ` and ${factsLost.length - 4} more` : ""}. Show on each record what the page showed on it (its status, its dates, its counts), in words.`);
  if (moved.length > 0) findings.push(`A record moved to another group: ${moved.slice(0, 3).join("; ")}${moved.length > 3 ? ` and ${moved.length - 3} more` : ""}. Keep each record under the heading it was under.`);
  const headingsLost = lostUnlessReworded(
    before.headings.filter((heading) => heading && !text.includes(norm(heading))),
    before.headings,
    after.headings,
    options,
  );
  if (headingsLost.length > 0) findings.push(`It no longer shows the heading${headingsLost.length > 1 ? "s" : ""} ${headingsLost.map((one) => `“${one}”`).join(", ")}: keep each heading the page had.`);
  const seen = new Map<string, number>();
  for (const heading of after.headings) if (heading.trim()) seen.set(norm(heading), (seen.get(norm(heading)) ?? 0) + 1);
  const twice = [...seen].filter(([, n]) => n > 1).map(([heading]) => after.headings.find((one) => norm(one) === heading)!);
  // Said with what to keep: a model told only to leave the title out drops every heading with it.
  const others = before.headings.filter((one) => !twice.some((title) => norm(title) === norm(one)));
  if (twice.length > 0) findings.push(`The heading${twice.length > 1 ? "s" : ""} ${twice.map((one) => `“${one}”`).join(", ")} ${twice.length > 1 ? "are" : "is"} drawn twice: the page already draws its title above the view, so leave it out${others.length > 0 ? ` — and keep every other heading as it was: ${others.map((one) => `“${one}”`).join(", ")}` : ""}.`);
  const markup = MARKUP.exec(after.text);
  if (markup && !MARKUP.test(before.text)) findings.push(`It shows its own markup as words (“${markup[0].slice(0, 40)}”): build it with graview.html\`…\`, nesting graview.html for each list, never a string of HTML.`);
  const iso = ISO_DAY.exec(after.text);
  if (iso && !ISO_DAY.test(before.text)) findings.push(`It shows a date as “${iso[0]}”: say dates in words, as the page did (“Sep 3”).`);
  // A word a record's own text says ("it was true") is the person's, not the computer's.
  const theirs = Object.values(options.values ?? {})
    .flat()
    .filter((one): one is string => typeof one === "string")
    .join("\n");
  const shownRaw = [...after.text.matchAll(RAW)].map((one) => one[1]!);
  const raw = shownRaw.find((word) => {
    const said = new RegExp(`(^|[^\\w])${word.replace(/[[\]]/g, "\\$&")}([^\\w]|$)`);
    return !said.test(before.text) && (word === "[object Object]" || !said.test(theirs));
  });
  if (raw) findings.push(`It shows “${raw}”, which is a value as the computer keeps it, not words for a person: say it in words or leave it out.`);
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const field of options.fields ?? []) {
    if (field.length < 3 || ["label", "name", "title"].includes(field)) continue;
    /*
     * As the computer keeps it: a camelCase key anywhere, or a lowercase one
     * with its own value as kept after it ("order 2", "status: candidate",
     * "done: true") — never ordinary words that happen to be a field's name
     * ("draft 3 · revising 0", "story 2"), nor a label a person wrote ("Due
     * Sep 3"). Where its values are not known, only a key and a raw value
     * written as code is ("done: true", "order=2").
     */
    const kept = (options.values?.[field] ?? []).map((one) => escape(String(one))).filter((one) => one.length > 0 && one.length <= 40);
    const named = /[A-Z]/.test(field)
      ? new RegExp(`\\b${field}\\b`)
      : options.values
        ? kept.length > 0
          ? new RegExp(`(?:^|[^\\w])${field}(?:\\s*[:=]\\s*|\\s+)(?:${kept.join("|")})(?![\\w])`)
          : undefined
        : new RegExp(`(?:^|[^\\w])${field}\\s*[:=]\\s*(?:\\d|true\\b|false\\b|null\\b|undefined\\b)`);
    if (named && named.test(after.text) && !named.test(before.text)) {
      findings.push(`It shows “${field}”, a field's name, not words for a person: say what it means, or leave it out.`);
      break;
    }
  }
  return findings;
}

/**
 * WHAT A NEW DESIGN COULD NOT KEEP, said plainly from what broke: "I
 * couldn't keep the dates and statuses in a new design." — the facts by
 * what they are (a day is a date, a number a count, other words a
 * status), a record or a heading lost, a record moved out of its group,
 * words shown as the computer keeps them. Plain `COULD_NOT` where what
 * broke is none of those (the view did not draw, the answer was not one).
 */
export function couldNotKeep(findings: readonly string[]): string {
  const things: string[] = [];
  const add = (thing: string) => void (things.includes(thing) || things.push(thing));
  for (const finding of findings) {
    const facts = /no longer says what it said: (.*?)(?: and \d+ more)?\. Show/.exec(finding);
    if (facts) {
      for (const one of facts[1]!.matchAll(/“([^”]+)” on “/g)) {
        const fact = norm(one[1]!);
        add(DAY_SAID.test(fact) || WEEKDAY.test(fact) ? "dates" : /^\D*\d/.test(fact) ? "counts" : "statuses");
      }
      continue;
    }
    if (/^It no longer shows “/.test(finding)) add("every record");
    else if (/no longer shows the heading/.test(finding)) add("headings");
    else if (/moved to another group/.test(finding)) add("each record in its group");
    else if (/drawn twice/.test(finding)) add("the title once");
    else if (/markup as words|a date as “|as the computer keeps it|a field's name/.test(finding)) add("the words as the page said them");
  }
  if (things.length === 0) return "I couldn't make a version that looks right.";
  const order = ["dates", "statuses", "counts", "headings"];
  const facts = order.filter((one) => things.includes(one));
  const rest = things.filter((one) => !order.includes(one));
  const and = (list: readonly string[]) => (list.length < 2 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);
  const said = [...(facts.length > 0 ? [`the ${and(facts)}`] : []), ...rest];
  return `I couldn't keep ${and(said)} in a new design.`;
}

/** How the records stand: the most side by side on one line. */
function perLine(records: DrawnRead["records"]): number {
  const lines = new Map<number, number>();
  for (const one of records) {
    const line = [...lines.keys()].find((top) => Math.abs(top - one.top) <= 6) ?? one.top;
    lines.set(line, (lines.get(line) ?? 0) + 1);
  }
  return Math.max(0, ...lines.values());
}

/**
 * WHAT CHANGED, SAID BY CODE from the two readings: how the records stand
 * (side by side, how many to a line), how big they are, their order, and
 * headings it adds. Undefined where nothing measurable moved, for the card
 * to say so plainly rather than echo the model.
 */
export function describeChange(name: string, before: DrawnRead, after: DrawnRead): string | undefined {
  const said: string[] = [];
  const was = perLine(before.records);
  const now = perLine(after.records);
  if (now > 1 && now !== was) said.push(`side by side, ${counted[now] ?? now} to a line`);
  else if (now === 1 && was > 1) said.push("one under another");
  const size = (records: DrawnRead["records"]) => (records.length ? records.reduce((sum, one) => sum + one.size, 0) / records.length : 0);
  const ratio = size(before.records) > 0 ? size(after.records) / size(before.records) : 1;
  if (ratio >= 1.12) said.push("in bigger type");
  else if (ratio <= 0.89) said.push("in smaller type");
  const order = (records: DrawnRead["records"], keep: Set<string>) => records.map((one) => norm(one.label)).filter((one) => keep.has(one));
  const common = new Set(before.records.map((one) => norm(one.label)).filter((label) => after.records.some((one) => norm(one.label) === label)));
  if (order(before.records, common).join("|") !== order(after.records, common).join("|")) said.push("in a new order");
  const labels = new Set(before.records.map((one) => norm(one.label)));
  const added = after.headings.filter((heading) => heading.trim() && !before.headings.some((one) => norm(one) === norm(heading)) && norm(heading) !== norm(name) && !labels.has(norm(heading)));
  if (added.length > 0) said.push(`under ${added.length === 1 ? "a new heading" : "new headings"}: ${added.slice(0, 3).map((one) => `“${one}”`).join(", ")}`);
  if (said.length === 0) return undefined;
  const plural = /s$/i.test(name.trim());
  return `${name} now ${plural ? "show" : "shows"} ${said.length === 1 ? said[0] : `${said.slice(0, -1).join(", ")} and ${said.at(-1)}`}.`;
}

/** One control a press check pressed, and what came of it. */
export interface PressSaid {
  readonly control: string;
  readonly element: string;
  readonly does: string;
  readonly ok: boolean;
  readonly says: string;
}

const attribute = (element: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(element)?.[1];

/**
 * WHAT A PERSON CAN DO ON EACH RECORD, KEPT (Roadmap f-make-any-page-better):
 * every control the draft drew, pressed headless with nothing applied —
 * one that does nothing, throws, or is refused is a finding in its own
 * words — and each record whose row the page let a person press (a circle
 * that finishes it) or open by its name must still be: a press bound to
 * one of the toggles (`data-act`, `data-record` its id) that the check
 * found the app accepts, and a link to it.
 */
export function pressFindings(presses: { readonly controls: readonly PressSaid[]; readonly problems: readonly PressSaid[] }, wanted: readonly { readonly label: string; readonly id: string; readonly presses?: boolean; readonly opens?: boolean }[], toggles: readonly string[], noun = "record"): string[] {
  const findings = presses.problems.slice(0, 5).map((one) => `${one.control}: ${one.says}`);
  const bound = (id: string) => presses.controls.some((one) => one.ok && one.does === "act" && attribute(one.element, "data-record") === id && toggles.includes(attribute(one.element, "data-act") ?? ""));
  const linked = (id: string) => presses.controls.some((one) => one.ok && one.does === "link" && attribute(one.element, "data-record") === id);
  const unpressable = toggles.length > 0 ? wanted.filter((one) => one.presses && !bound(one.id)) : [];
  if (unpressable.length > 0)
    findings.push(
      `${unpressable.slice(0, 3).map((one) => `“${one.label}”`).join(", ")}${unpressable.length > 3 ? ` and ${unpressable.length - 3} more` : ""} can no longer be marked as the page let a person mark ${unpressable.length === 1 ? "it" : "them"}: give each ${noun} a press bound to ${toggles.map((one) => `“${one}”`).join(" or ")}, e.g. <button data-act="${toggles[0]}" data-record="${unpressable[0]!.id}">…</button>.`,
    );
  const closed = wanted.filter((one) => one.opens && !linked(one.id));
  if (closed.length > 0) findings.push(`${closed.slice(0, 3).map((one) => `“${one.label}”`).join(", ")}${closed.length > 3 ? ` and ${closed.length - 3} more` : ""} no longer ${closed.length === 1 ? "opens its" : "open their"} page: link each with data-record="its id".`);
  return findings;
}

/**
 * WHAT THE CONTROLS DO, SAID BY THE PRESS CHECK: "Pressing it checked:
 * “Done” marks each of the 3 tasks done, and each opens its page." Only
 * what was pressed and accepted is said; undefined where it found nothing
 * to say. The agent's own account of its controls is never said for it.
 */
export function pressSaid(presses: { readonly controls: readonly PressSaid[] }, acts: readonly { readonly act: string; readonly title: string; readonly toggle?: string }[], noun = "records"): string | undefined {
  const said: string[] = [];
  for (const act of acts) {
    const on = new Set(presses.controls.filter((one) => one.ok && one.does === "act" && attribute(one.element, "data-act") === act.act).map((one) => attribute(one.element, "data-record") ?? one.control));
    if (on.size > 0) said.push(`${act.title.replace(/[.…]+$/, "")} works on ${on.size === 1 ? "one of the" : `${on.size}`} ${noun}`);
  }
  const opens = new Set(presses.controls.filter((one) => one.ok && one.does === "link" && attribute(one.element, "data-record")).map((one) => attribute(one.element, "data-record")));
  if (opens.size > 0) said.push(`${opens.size} open${opens.size === 1 ? "s its" : " their"} page${opens.size === 1 ? "" : "s"}`);
  if (said.length === 0) return undefined;
  return `Pressing each control checked it: ${said.length < 2 ? said[0] : `${said.slice(0, -1).join(", ")} and ${said.at(-1)}`}.`;
}

/** Words that say what a control does: a sentence of the model's with one is not said for it — the press check says what was checked. */
export const CONTROL_WORDS = /\b(check ?box(es)?|button|click|tap|press|toggle|mark(ed|s|ing)?|complet(e|ed|ing)|finish(ed|es|ing)?|persist|sav(e|es|ed|ing)|updat(e|es|ed|ing)|works?|working|data)\b/i;

/** Words of a person who says a control does not work. */
export const IT_DOES_NOT_WORK = /\b(does(n'?t| not)|did(n'?t| not)|can'?t|cannot|won'?t|not)\s+(work|working|persist|save|stick|change|update|do anything|mark|finish|complete|click|press)|\bfake\b|\bbroken\b|\bstill (broken|not)\b/i;
