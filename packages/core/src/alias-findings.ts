import type { GraviewApp } from "./app.js";
import type { GraviewDocument } from "./document/schema.js";
import { error, type Finding } from "./document/findings.js";
import { humanizeField, nounOf, pluralOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";

/*
 * OTHER WORDS FOR A KIND OR A FIELD, JUDGED (Roadmap f-learned-suggestions),
 * in one vocabulary for a document and a TypeScript app. An alias is a word
 * search finds the kind by and a model is told: one that another kind is
 * already called — its id, noun or plural, or an alias of its own — would
 * send "guests" to the vendors, and one another field of the same kind is
 * called would say two fields are one. Codes, every one an error:
 * `alias-taken`, and `alias-field` for a TypeScript kind's `fieldAliases`
 * naming a field it does not have.
 */

/** A kind as its aliases are judged: what it is called, and each field's name, label and aliases. */
export interface AliasKind {
  readonly kind: string;
  readonly names: readonly string[];
  readonly aliases: readonly string[];
  readonly fields: readonly { readonly field: string; readonly names: readonly string[]; readonly aliases: readonly string[]; readonly declared: boolean }[];
}

export type AliasFindingCode = "alias-taken" | "alias-field";

export interface AliasFinding {
  readonly code: AliasFindingCode;
  readonly kind: string;
  readonly field?: string;
  /** Which alias, by its place in the list. */
  readonly index?: number;
  readonly message: string;
  readonly fix: string;
}

/** A word as two of them are compared: lower case, whitespace folded. */
export const aliasWord = (word: string): string => word.toLowerCase().replace(/\s+/g, " ").trim();

/** What a kind is called: its id, as written and spoken, its noun and its plural. */
const kindNames = (kind: string, noun: string, plural: string): string[] => [...new Set([kind, humanizeField(kind), noun, plural].map(aliasWord))];

/** What a field is called: its name, as written and spoken, and its label. */
const fieldNames = (field: string, label?: string): string[] => [...new Set([field, humanizeField(field), ...(label ? [label] : [])].map(aliasWord))];

export function aliasFindings(kinds: readonly AliasKind[]): AliasFinding[] {
  const out: AliasFinding[] = [];
  // Who each word already belongs to, across the kinds: their names first, then their aliases.
  const owner = new Map<string, string>();
  for (const one of kinds) for (const name of one.names) if (!owner.has(name)) owner.set(name, one.kind);
  for (const one of kinds) {
    const seen = new Set<string>();
    one.aliases.forEach((raw, index) => {
      const word = aliasWord(raw);
      const held = owner.get(word);
      if (seen.has(word)) out.push({ code: "alias-taken", kind: one.kind, index, message: `"${word}" is said twice among ${one.kind}'s aliases`, fix: "say each word once" });
      else if (held === one.kind) out.push({ code: "alias-taken", kind: one.kind, index, message: `"${word}" is already what ${one.kind} is called, so it is no other word for it`, fix: "take it out of the aliases" });
      else if (held !== undefined) out.push({ code: "alias-taken", kind: one.kind, index, message: `"${word}" is what ${held} is called, so search could not tell ${one.kind} from it`, fix: `choose a word nothing else in the app is called, or take it out of ${one.kind}'s aliases` });
      seen.add(word);
      if (held === undefined) owner.set(word, one.kind);
    });
    // A field's words within its kind: another field's name, label or alias is taken.
    const fieldOwner = new Map<string, string>();
    for (const field of one.fields) for (const name of field.names) if (!fieldOwner.has(name)) fieldOwner.set(name, field.field);
    for (const field of one.fields) {
      if (!field.declared) {
        out.push({ code: "alias-field", kind: one.kind, field: field.field, message: `${one.kind} has no field "${field.field}" to give other words`, fix: `name one of its fields, or take "${field.field}" out of fieldAliases` });
        continue;
      }
      const said = new Set<string>();
      field.aliases.forEach((raw, index) => {
        const word = aliasWord(raw);
        const held = fieldOwner.get(word);
        if (said.has(word)) out.push({ code: "alias-taken", kind: one.kind, field: field.field, index, message: `"${word}" is said twice among ${one.kind}'s ${field.field}'s aliases`, fix: "say each word once" });
        else if (held === field.field) out.push({ code: "alias-taken", kind: one.kind, field: field.field, index, message: `"${word}" is already what ${one.kind}'s ${field.field} is called`, fix: "take it out of the aliases" });
        else if (held !== undefined) out.push({ code: "alias-taken", kind: one.kind, field: field.field, index, message: `"${word}" is what ${one.kind}'s ${held} is called, so it cannot also mean ${field.field}`, fix: `choose a word no other field of ${one.kind} is called` });
        said.add(word);
        if (held === undefined) fieldOwner.set(word, field.field);
      });
    }
  }
  return out;
}

/** A document's kinds, as their aliases are judged. */
export function aliasKindsOfDocument(document: GraviewDocument): AliasKind[] {
  return Object.entries(document.kinds).map(([kind, spec]) => ({
    kind,
    names: kindNames(kind, spec.noun ?? humanizeField(kind).toLowerCase(), spec.plural ?? `${kind}s`),
    aliases: spec.aliases ?? [],
    fields: Object.entries(spec.fields).map(([field, f]) => ({ field, names: fieldNames(field, f.label), aliases: f.aliases ?? [], declared: true })),
  }));
}

/** An app's kinds, as their aliases are judged: each definition's `aliases`, and its `fieldAliases` beside its fields. */
export function aliasKindsOfSchema(schema: AnySchema): AliasKind[] {
  return (schema.kinds as readonly string[]).map((kind) => {
    const definition = schema.tryDefinition(kind) as { aliases?: readonly string[]; fieldAliases?: Readonly<Record<string, readonly string[]>>; fields?: { shape?: Record<string, unknown> }; display?: { labels?: Readonly<Record<string, string>> } } | undefined;
    const shape = Object.keys(definition?.fields?.shape ?? {}).filter((field) => field !== "id" && field !== "kind");
    const aliased = Object.keys(definition?.fieldAliases ?? {});
    return {
      kind,
      names: kindNames(kind, nounOf(definition as never, kind), pluralOf(schema, kind)),
      aliases: definition?.aliases ?? [],
      fields: [...new Set([...shape, ...aliased])].map((field) => ({ field, names: fieldNames(field, definition?.display?.labels?.[field]), aliases: definition?.fieldAliases?.[field] ?? [], declared: shape.includes(field) })),
    };
  });
}

/** A document's aliases judged, each at its path. */
export function documentAliasFindings(document: GraviewDocument): Finding[] {
  return aliasFindings(aliasKindsOfDocument(document)).map((finding) =>
    error(finding.code, `kinds.${finding.kind}${finding.field ? `.fields.${finding.field}` : ""}.aliases${finding.index === undefined ? "" : `.${finding.index}`}`, finding.message, finding.fix),
  );
}

/** An app's aliases judged, each where `defineNode` says it. */
export function appAliasFindings(app: Pick<GraviewApp, "schema">): readonly (AliasFinding & { readonly where: string })[] {
  return aliasFindings(aliasKindsOfSchema(app.schema as AnySchema)).map((finding) => ({
    ...finding,
    where: `defineNode("${finding.kind}").${finding.field ? `fieldAliases.${finding.field}` : "aliases"}${finding.index === undefined ? "" : `[${finding.index}]`}`,
  }));
}
