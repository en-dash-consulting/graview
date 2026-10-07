import { withArticle } from "../schema/define-node.js";
import { canonicalize } from "./canonical.js";
import { narrows, rangeWords } from "./range.js";
import type { GraviewDocument } from "./schema.js";
import { homeOf, VIEW_SLOTS, viewsOf } from "./views.js";

/*
 * WHAT A CHANGE TO THE APP MEANS, IN WORDS — and whether data would move.
 *
 * A change is BREAKING when stored records could stop fitting the
 * declaration: a kind or a field removed, a field's type changed, an enum
 * option dropped, a field made required. Breaking changes are previewed with
 * what they would cost (how many records lose a value) and need an explicit
 * acknowledgment before they apply.
 */

export interface DocumentDiff {
  readonly sentences: readonly string[];
  readonly breaking: boolean;
  readonly removedKinds: readonly string[];
  readonly removedFields: readonly { readonly kind: string; readonly field: string }[];
  readonly retypedFields: readonly { readonly kind: string; readonly field: string; readonly from: string; readonly to: string }[];
  readonly droppedOptions: readonly { readonly kind: string; readonly field: string; readonly options: readonly string[] }[];
  readonly removedEdges: readonly { readonly kind: string; readonly edge: string }[];
  readonly newlyRequired: readonly { readonly kind: string; readonly field: string }[];
  /** Number fields whose range no longer takes a value it took (FR-114): records outside it are cleared. */
  readonly narrowedRanges: readonly { readonly kind: string; readonly field: string }[];
  readonly unchanged: boolean;
}

const keys = <T extends object>(o: T | undefined) => Object.keys(o ?? {});
/** The same meaning, whatever order the keys were written in: compared as documentHash compares. */
const same = (a: unknown, b: unknown) => canonicalize(a) === canonicalize(b);

export function diffDocuments(before: GraviewDocument, after: GraviewDocument): DocumentDiff {
  const sentences: string[] = [];
  const removedKinds: string[] = [];
  const removedFields: { kind: string; field: string }[] = [];
  const retypedFields: { kind: string; field: string; from: string; to: string }[] = [];
  const droppedOptions: { kind: string; field: string; options: string[] }[] = [];
  const removedEdges: { kind: string; edge: string }[] = [];
  const newlyRequired: { kind: string; field: string }[] = [];
  const narrowedRanges: { kind: string; field: string }[] = [];

  if (before.name !== after.name) sentences.push(`The app is renamed from "${before.name}" to "${after.name}".`);
  // A kind declared `renamedFrom` an old one continues it: compared as the same kind, said as a rename.
  const continues = new Map<string, string>();
  for (const [kind, spec] of Object.entries(after.kinds)) {
    const from = (spec as { renamedFrom?: string }).renamedFrom;
    if (from && before.kinds[from] && !before.kinds[kind]) {
      continues.set(from, kind);
      sentences.push(`The ${from} kind is renamed to ${kind}; its records are kept.`);
    }
  }
  for (const kind of keys(after.kinds)) if (!before.kinds[kind] && ![...continues.values()].includes(kind)) sentences.push(`A new kind, ${kind}, with ${keys(after.kinds[kind]!.fields).join(", ")}.`);
  for (const kind of keys(before.kinds)) {
    const was = before.kinds[kind]!;
    const now = after.kinds[continues.get(kind) ?? kind];
    if (!now) {
      removedKinds.push(kind);
      sentences.push(`The ${kind} kind is removed, and every ${kind} with it.`);
      continue;
    }
    const renamed = new Map<string, string>();
    for (const [field, f] of Object.entries(now.fields)) {
      const from = (f as { renamedFrom?: string }).renamedFrom;
      if (from && was.fields[from] && !was.fields[field]) {
        renamed.set(field, from);
        sentences.push(`${kind}'s ${from} is renamed to ${field}; its values are kept.`);
      }
    }
    for (const field of keys(now.fields)) {
      const f = now.fields[field]!;
      const old = was.fields[renamed.get(field) ?? field];
      if (!old) {
        sentences.push(`${kind} gains a field, ${field} (${f.type}${f.required ? ", required" : ""}).`);
        if (f.required && f.default === undefined) newlyRequired.push({ kind, field });
        continue;
      }
      if (old.type !== f.type) {
        retypedFields.push({ kind, field, from: old.type, to: f.type });
        sentences.push(`${kind}'s ${field} changes from ${old.type} to ${f.type}; values that convert are kept, the rest are cleared.`);
      }
      const dropped = (old.options ?? []).filter((o) => !(f.options ?? []).includes(o));
      if (dropped.length > 0 && old.type === f.type) {
        droppedOptions.push({ kind, field, options: dropped });
        sentences.push(`${kind}'s ${field} no longer offers ${dropped.map((o) => `"${o}"`).join(", ")}; records holding ${dropped.length === 1 ? "it" : "them"} are cleared.`);
      }
      const added = (f.options ?? []).filter((o) => !(old.options ?? []).includes(o));
      if (added.length > 0) sentences.push(`${kind}'s ${field} now also offers ${added.map((o) => `"${o}"`).join(", ")}.`);
      if (f.required && !old.required && f.default === undefined) {
        newlyRequired.push({ kind, field });
        sentences.push(`${kind}'s ${field} becomes required; records without one will need it.`);
      }
      // Its range (FR-114), said as the values it takes; a narrower one clears what it no longer takes.
      if (old.type === f.type && (old.min !== f.min || old.max !== f.max || old.step !== f.step)) {
        const narrower = narrows(old, f);
        if (narrower) narrowedRanges.push({ kind, field });
        sentences.push(`${kind}'s ${field} now takes ${rangeWords(f)}, where it took ${rangeWords(old)}${narrower ? "; values outside it are cleared" : ""}.`);
      }
      if (!same({ ...old, type: 0, options: 0, required: 0, renamedFrom: 0, min: 0, max: 0, step: 0 }, { ...f, type: 0, options: 0, required: 0, renamedFrom: 0, min: 0, max: 0, step: 0 })) sentences.push(`${kind}'s ${field} is described differently.`);
    }
    for (const field of keys(was.fields)) {
      if (!now.fields[field] && ![...renamed.values()].includes(field)) {
        removedFields.push({ kind, field });
        sentences.push(`${kind} loses its ${field} field, and every value in it.`);
      }
    }
    const renamedEdges = new Set(Object.values(now.edges ?? {}).map((e) => (e as { renamedFrom?: string }).renamedFrom).filter(Boolean));
    for (const [edge, e] of Object.entries(now.edges ?? {})) {
      const from = (e as { renamedFrom?: string }).renamedFrom;
      if (from && was.edges?.[from] && !was.edges?.[edge]) sentences.push(`The "${from}" relation from ${kind} is renamed to "${edge}"; its links are kept.`);
    }
    for (const edge of keys(was.edges)) {
      if (!now.edges?.[edge] && !renamedEdges.has(edge)) {
        removedEdges.push({ kind, edge });
        sentences.push(`The "${edge}" relation from ${kind} is removed, with every link of that kind.`);
      }
    }
    for (const edge of keys(now.edges)) if (!was.edges?.[edge] && !(now.edges?.[edge] as { renamedFrom?: string } | undefined)?.renamedFrom) sentences.push(`${kind} gains a relation, "${edge}".`);
    if (!same(was.label, now.label) || !same(was.describe, now.describe)) sentences.push(`How ${withArticle(kind)} is labeled changes.`);
    // A glance follows its fields: a rename or a removal is already said, so only a different choice is.
    const movedTo = new Map(Object.entries(now.fields).flatMap(([field, f]) => ((f as { renamedFrom?: string }).renamedFrom ? [[(f as { renamedFrom: string }).renamedFrom, field] as const] : [])));
    const wasGlance = (was.glance ?? []).map((field) => movedTo.get(field) ?? field).filter((field) => now.fields[field] || now.computed?.[field] !== undefined);
    if (!same(wasGlance, now.glance ?? [])) sentences.push(`What a glance at ${withArticle(kind)} says changes.`);
    sentences.push(...computedSentences(now.plural ?? was.plural ?? `${kind}s`, was.computed, now.computed));
  }
  for (const [section, noun] of [["acts", "act"], ["rules", "rule"]] as const) {
    const a = before[section] ?? {};
    const b = after[section] ?? {};
    for (const n of keys(b)) if (!(n in a)) sentences.push(`A new ${noun}: ${(b as Record<string, { title?: string }>)[n]!.title ?? n}.`);
    for (const n of keys(a)) if (!(n in b)) sentences.push(`The ${noun} "${(a as Record<string, { title?: string }>)[n]!.title ?? n}" is removed.`);
    for (const n of keys(b)) if (n in a && !same((a as Record<string, unknown>)[n], (b as Record<string, unknown>)[n])) sentences.push(`The ${noun} "${(b as Record<string, { title?: string }>)[n]!.title ?? n}" changes.`);
  }
  if (!same(before.policy, after.policy) || !same(before.roles, after.roles)) sentences.push("Who may do what changes.");
  if (!same(before.brand?.accent, after.brand?.accent) || !same(before.brand?.name, after.brand?.name)) sentences.push("The app's colors change.");
  // The app's money (FR-100), said apart from its colors.
  if (!same(before.brand?.currency, after.brand?.currency) || !same(before.brand?.locale, after.brand?.locale)) {
    const currency = after.brand?.currency;
    sentences.push(currency ? `Money is said in ${currency}${after.brand?.locale ? `, written for ${after.brand.locale}` : ""}.` : "Money is said with no currency.");
  }
  sentences.push(...viewSentences(before, after));
  sentences.push(...lensSentences(before.lenses ?? [], after.lenses ?? []));
  sentences.push(...pagesSentences(before.pages, after.pages));
  for (const k of ["modules", "settings", "description"] as const) if (!same(before[k], after[k])) sentences.push(`The app's ${k} change.`);

  const breaking = removedKinds.length + removedFields.length + retypedFields.length + droppedOptions.length + removedEdges.length + newlyRequired.length + narrowedRanges.length > 0;
  return { sentences, breaking, removedKinds, removedFields, retypedFields, droppedOptions, removedEdges, newlyRequired, narrowedRanges, unchanged: sentences.length === 0 };
}

/** How the look of each kind changes, slot by slot: "How a vendor card looks changes." */
function viewSentences(before: GraviewDocument, after: GraviewDocument): string[] {
  const sentences: string[] = [];
  const was = viewsOf(before);
  const now = viewsOf(after);
  for (const kind of [...new Set([...keys(was), ...keys(now)])]) {
    const noun = after.kinds[kind]?.noun ?? before.kinds[kind]?.noun ?? kind;
    const a = /^[aeiou]/i.test(noun) ? "an" : "a";
    for (const slot of VIEW_SLOTS) {
      const old = was[kind]?.[slot];
      const next = now[kind]?.[slot];
      if (same(old, next)) continue;
      if (old === undefined) sentences.push(`${cap(a)} ${noun} ${slot} gets a look of its own.`);
      else if (next === undefined) sentences.push(`${cap(a)} ${noun} ${slot} goes back to Graview's own look.`);
      else sentences.push(`How ${a} ${noun} ${slot} looks changes.`);
    }
  }
  // The home view (FR-81), which is no kind's.
  const home = [homeOf(before), homeOf(after)] as const;
  if (!same(home[0], home[1])) sentences.push(home[0] === undefined ? "The front page gets a view of its own." : home[1] === undefined ? "The front page goes back to Graview's own." : "The front page changes.");
  return sentences;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What a kind works out, compared (FR-83, FR-84): "Packages work out "net".", in the kind's own plural. */
function computedSentences(plural: string, was: Record<string, unknown> | undefined, now: Record<string, unknown> | undefined): string[] {
  const out: string[] = [];
  const said = cap(plural);
  const exprOf = (c: unknown) => (typeof c === "string" ? c : (c as { expr?: string } | undefined)?.expr);
  for (const name of keys(now)) {
    if (was?.[name] === undefined) out.push(`${said} work out "${name}".`);
    else if (exprOf(was[name]) !== exprOf(now![name])) out.push(`How ${plural.charAt(0).toLowerCase()}${plural.slice(1)} work out "${name}" changes.`);
    else if (!same(typeof was[name] === "string" ? { expr: was[name] } : was[name], typeof now![name] === "string" ? { expr: now![name] } : now![name])) out.push(`${said}' "${name}" is described differently.`);
  }
  for (const name of keys(was)) if (now?.[name] === undefined) out.push(`${said} no longer work out "${name}".`);
  return out;
}

type LooseLens = Record<string, unknown>;
const lensKey = (lens: LooseLens, index: number) => (typeof lens["title"] === "string" ? `${lens["title"]}|${String(lens["on"] ?? "")}` : `#${index}:${String(lens["name"] ?? "")}`);
const lensName = (lens: LooseLens) => (typeof lens["title"] === "string" ? `A lens "${lens["title"]}"` : `A ${String(lens["name"] ?? "")} lens`);

/** The lenses, compared by title: "A lens "The packages" is added." */
function lensSentences(before: readonly LooseLens[], after: readonly LooseLens[]): string[] {
  const out: string[] = [];
  const was = new Map(before.map((lens, i) => [lensKey(lens, i), lens]));
  const now = new Map(after.map((lens, i) => [lensKey(lens, i), lens]));
  for (const [key, lens] of now) {
    const old = was.get(key);
    if (!old) out.push(`${lensName(lens)} is added.`);
    else if (!same(old, lens)) out.push(`${lensName(lens).replace(/^A lens/, "The lens").replace(/^A /, "The ")} changes.`);
  }
  for (const [key, lens] of was) if (!now.has(key)) out.push(`${lensName(lens).replace(/^A lens/, "The lens").replace(/^A /, "The ")} is removed.`);
  const order = (lenses: readonly LooseLens[]) => lenses.map(lensKey).filter((key) => was.has(key) && now.has(key));
  if (out.length === 0 && !same(order(before), order(after))) out.push("The lenses are put in a different order.");
  return out;
}

type Arrangement = { order?: readonly string[]; hide?: readonly string[]; first?: string } | undefined;

/** The arrangement (FR-80), compared part by part. */
function pagesSentences(before: Arrangement, after: Arrangement): string[] {
  if (same(before, after)) return [];
  const out: string[] = [];
  if (!same(before?.order, after?.order)) out.push(after?.order && after.order.length > 0 ? `The kinds are put in a new order: ${after.order.join(", ")}.` : "The kinds go back to the order they were declared in.");
  if (!same(before?.hide, after?.hide)) {
    const hidden = after?.hide ?? [];
    const shown = (before?.hide ?? []).filter((kind) => !hidden.includes(kind));
    const newly = hidden.filter((kind) => !(before?.hide ?? []).includes(kind));
    if (newly.length > 0) out.push(`The front page leaves off ${newly.join(", ")}.`);
    if (shown.length > 0) out.push(`The front page shows ${shown.join(", ")} again.`);
  }
  if (!same(before?.first, after?.first)) out.push(after?.first === undefined || after.first.trim().toLowerCase() === "home" ? "The app opens at its home." : `The app opens on "${after.first}".`);
  if (out.length === 0) out.push("The app's pages change.");
  return out;
}
