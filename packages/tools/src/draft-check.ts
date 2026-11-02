import { sanitizeStylesheet, type CssRefusal } from "@graview/core/css";
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

/** A drawing read for judging: its headings in order, the records it shows in order with where and how big, and all its words. */
export interface DrawnRead {
  readonly headings: readonly string[];
  readonly records: readonly { readonly label: string; readonly top: number; readonly left: number; readonly size: number }[];
  readonly text: string;
}

const norm = (words: string) => words.replace(/\s+/g, " ").trim().toLowerCase();
const counted = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** What a refused stylesheet rule needs, in words a model can act on. */
function refusalWords(refusal: CssRefusal): string {
  const name = refusal.name ? `“${refusal.name}”` : "";
  switch (refusal.reason) {
    case "selector":
      return `The selector “${/^(host|host-context)$/.test(refusal.name ?? "") ? ":" : /^(slotted|part)$/.test(refusal.name ?? "") ? "::" : ""}${refusal.name ?? ""}” reaches outside the view and is removed with its rule: give the view's outer element a class and style that instead.`;
    case "at-rule":
      return `${name || "An at-rule"} is not allowed and is removed with what it holds: use plain rules and @media only.`;
    case "property":
      return `The property ${name} is not allowed and is removed: use ordinary layout, color and type properties.`;
    case "function":
      return `The function ${name}() is not allowed and is removed: use var(--graview-…), calc(), min(), max(), clamp() or repeat().`;
    case "url":
      return "url() is not allowed and is removed: draw nothing from an address.";
    case "value":
      return `A value of ${name || "a property"} is not allowed and is removed (position may be static, relative, absolute or sticky).`;
    case "size":
      return "The stylesheet is too long and is removed whole: keep it short.";
    default:
      return `A rule ${name ? `near ${name} ` : ""}could not be read and is removed: write plain CSS, one rule at a time, no nesting.`;
  }
}

/**
 * WHAT THE HOST WOULD STRIP FROM A SCRIPT'S STYLESHEETS, before it is
 * drawn: each `graview.style` string read by the framework's own
 * sanitizer, and what it refuses said as what to do instead.
 */
export function cssFindings(source: string): string[] {
  const findings = new Set<string>();
  for (const sheet of styleStringsOf(source)) {
    const css = source.slice(sheet.start, sheet.end).replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, "0");
    for (const refusal of sanitizeStylesheet(css).refused) findings.add(refusalWords(refusal));
  }
  return [...findings];
}

const ISO_DAY = /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/;
const MARKUP = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?>/i;
const RAW = /\b(undefined|null|NaN|\[object Object\]|true|false)\b/;

/**
 * WHAT A DRAFT BROKE, against what the page showed: a record or a heading
 * it no longer shows, a heading drawn twice, and words no person was shown
 * before — a field's own name, a date as the computer keeps it, `true`,
 * `undefined`. Empty when the draft may be shown.
 */
export function drawnFindings(before: DrawnRead, after: DrawnRead, options: { readonly fields?: readonly string[] } = {}): string[] {
  const findings: string[] = [];
  const text = norm(after.text);
  const lost = before.records.map((one) => one.label).filter((label) => label && !text.includes(norm(label)));
  if (lost.length > 0) findings.push(`It no longer shows ${lost.slice(0, 4).map((one) => `“${one}”`).join(", ")}${lost.length > 4 ? ` and ${lost.length - 4} more` : ""}: show every record the page showed.`);
  const headingsLost = before.headings.filter((heading) => heading && !text.includes(norm(heading)));
  if (headingsLost.length > 0) findings.push(`It no longer shows the heading${headingsLost.length > 1 ? "s" : ""} ${headingsLost.map((one) => `“${one}”`).join(", ")}: keep each heading the page had.`);
  const seen = new Map<string, number>();
  for (const heading of after.headings) if (heading.trim()) seen.set(norm(heading), (seen.get(norm(heading)) ?? 0) + 1);
  const twice = [...seen].filter(([, n]) => n > 1).map(([heading]) => after.headings.find((one) => norm(one) === heading)!);
  if (twice.length > 0) findings.push(`The heading${twice.length > 1 ? "s" : ""} ${twice.map((one) => `“${one}”`).join(", ")} ${twice.length > 1 ? "are" : "is"} drawn twice: the page already draws its title above the view, so leave it out.`);
  const markup = MARKUP.exec(after.text);
  if (markup && !MARKUP.test(before.text)) findings.push(`It shows its own markup as words (“${markup[0].slice(0, 40)}”): build it with graview.html\`…\`, nesting graview.html for each list, never a string of HTML.`);
  const iso = ISO_DAY.exec(after.text);
  if (iso && !ISO_DAY.test(before.text)) findings.push(`It shows a date as “${iso[0]}”: say dates in words, as the page did (“Sep 3”).`);
  const raw = RAW.exec(after.text);
  if (raw && !new RegExp(`\\b${raw[1]!.replace(/[[\]]/g, "\\$&")}\\b`).test(before.text)) findings.push(`It shows “${raw[1]}”, which is a value as the computer keeps it, not words for a person: say it in words or leave it out.`);
  for (const field of options.fields ?? []) {
    if (field.length < 3 || ["label", "name", "title"].includes(field)) continue;
    // As the computer keeps it: a camelCase key anywhere, or a lowercase one with a value after it ("order 2", "done: true") — never a label a person wrote ("Due Sep 3").
    const named = /[A-Z]/.test(field) ? new RegExp(`\\b${field}\\b`) : new RegExp(`(?:^|[^\\w])${field}(?:\\s*[:=]|\\s+(?:\\d|true|false|null))`);
    if (named.test(after.text) && !named.test(before.text)) {
      findings.push(`It shows “${field}”, a field's name, not words for a person: say what it means, or leave it out.`);
      break;
    }
  }
  return findings;
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
