import type { GraviewDocument } from "./schema.js";
import { VIEW_SLOTS, viewsOf } from "./views.js";

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
  readonly unchanged: boolean;
}

const keys = <T extends object>(o: T | undefined) => Object.keys(o ?? {});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffDocuments(before: GraviewDocument, after: GraviewDocument): DocumentDiff {
  const sentences: string[] = [];
  const removedKinds: string[] = [];
  const removedFields: { kind: string; field: string }[] = [];
  const retypedFields: { kind: string; field: string; from: string; to: string }[] = [];
  const droppedOptions: { kind: string; field: string; options: string[] }[] = [];
  const removedEdges: { kind: string; edge: string }[] = [];
  const newlyRequired: { kind: string; field: string }[] = [];

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
      if (!same({ ...old, type: 0, options: 0, required: 0, renamedFrom: 0 }, { ...f, type: 0, options: 0, required: 0, renamedFrom: 0 })) sentences.push(`${kind}'s ${field} is described differently.`);
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
    if (!same(was.label, now.label) || !same(was.describe, now.describe)) sentences.push(`How a ${kind} is labelled changes.`);
  }
  for (const [section, noun] of [["acts", "act"], ["rules", "rule"]] as const) {
    const a = before[section] ?? {};
    const b = after[section] ?? {};
    for (const n of keys(b)) if (!(n in a)) sentences.push(`A new ${noun}: ${(b as Record<string, { title?: string }>)[n]!.title ?? n}.`);
    for (const n of keys(a)) if (!(n in b)) sentences.push(`The ${noun} "${(a as Record<string, { title?: string }>)[n]!.title ?? n}" is removed.`);
    for (const n of keys(b)) if (n in a && !same((a as Record<string, unknown>)[n], (b as Record<string, unknown>)[n])) sentences.push(`The ${noun} "${(b as Record<string, { title?: string }>)[n]!.title ?? n}" changes.`);
  }
  if (!same(before.policy, after.policy) || !same(before.roles, after.roles)) sentences.push("Who may do what changes.");
  if (!same(before.brand, after.brand)) sentences.push("The app's colours change.");
  sentences.push(...viewSentences(before, after));
  for (const k of ["lenses", "pages", "modules", "settings", "description"] as const) if (!same(before[k], after[k])) sentences.push(`The app's ${k} change.`);

  const breaking = removedKinds.length + removedFields.length + retypedFields.length + droppedOptions.length + removedEdges.length + newlyRequired.length > 0;
  return { sentences, breaking, removedKinds, removedFields, retypedFields, droppedOptions, removedEdges, newlyRequired, unchanged: sentences.length === 0 };
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
  return sentences;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
