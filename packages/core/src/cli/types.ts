import { linkedEdges, localEdges } from "../schema/linked.js";
import type { FieldSpec, GraviewDocument } from "../document/schema.js";

/*
 * `graview types <document>` — A DOCUMENT'S KINDS, FIELDS AND RELATIONS AS
 * TYPESCRIPT.
 *
 * A face over a document read every record as `{ id, kind } &
 * Record<string, unknown>`, its fields with `typeof` and its relations by
 * bare strings, so a renamed relation was a blank section and not a compile
 * error. This writes what the document declares as types — each kind's
 * record with its fields' own types, an enum's options as a union — and the
 * `Types` that `typedReader` (`@graview/core/typed`) reads a store through.
 * `TypesOf<typeof document>` is the same for a `defineDocument`.
 */

/** What the generated file names besides the kinds, which a kind's own name gives way to. */
const TAKEN = new Set(["Kinds", "Edges", "Types", "AnyRecord", "Reader", "TypedReader"]);
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const pascal = (kind: string) => kind.replace(/(^|-)([a-z0-9])/g, (_, __: string, c: string) => c.toUpperCase());
const key = (name: string) => (IDENTIFIER.test(name) ? name : JSON.stringify(name));
const comment = (text: string | undefined, indent: string) => (text ? `${indent}/** ${text.replace(/\*\//g, "*\\/").replace(/\s*\n\s*/g, " ")} */\n` : "");
const union = (names: readonly string[]) => (names.length === 0 ? "never" : names.map((name) => JSON.stringify(name)).join(" | "));

/** The TypeScript a field of one declared type holds, as the store keeps it. */
export function fieldType(spec: FieldSpec): string {
  switch (spec.type) {
    case "enum":
      return union(spec.options ?? []);
    case "number":
    case "integer":
    case "duration":
      return "number";
    case "boolean":
      return "boolean";
    case "image":
    case "video":
    case "file":
      return "FileValue";
    case "list":
      return spec.of === "number" ? "readonly number[]" : spec.of === "image" || spec.of === "video" || spec.of === "file" ? "readonly FileValue[]" : "readonly string[]";
    default:
      return "string";
  }
}

/** What a string field holds, where its type says more than `string`. */
const HOLDS: Partial<Record<FieldSpec["type"], string>> = {
  date: "A day, as 2026-10-02.",
  datetime: "A date and time, as ISO 8601.",
  url: "A web address.",
  email: "An email address.",
  image: "A picture the host stored: its href a path on the host.",
  file: "A file the host stored: its href a path on the host.",
  "app-link": "Another app's address: @owner/app, its id, or its https:// address.",
  phone: "A phone number, as it was written.",
  place: "An address or a place's name, linked to the reader's maps app.",
  duration: "A length of time, in whole minutes.",
};

/** A field's comment: its description, the words it is shown by, and what a string of its type holds. */
function fieldNote(spec: FieldSpec): string | undefined {
  const said = [spec.description, spec.label ? `Shown as "${spec.label}"` : undefined, spec.format === "markdown" ? "Markdown, drawn as prose on the record's page" : HOLDS[spec.type], spec.unit ? `In ${spec.unit}` : undefined].filter((part): part is string => Boolean(part));
  return said.length > 0 ? said.map((part) => (/[.!?]$/.test(part) ? part : `${part}.`)).join(" ") : undefined;
}

/** Each kind's interface name: its own name in PascalCase, unless that is a name the file already uses. */
export function typeNames(document: GraviewDocument): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set(TAKEN);
  for (const kind of Object.keys(document.kinds)) {
    let name = pascal(kind);
    while (used.has(name)) name = `${name}Record`;
    used.add(name);
    names.set(kind, name);
  }
  return names;
}

/**
 * The `.d.ts` for a document: one interface per kind, `Kinds`, `Edges`,
 * `Types`, `AnyRecord` and `Reader`. `from` is what the header says it was
 * written from.
 */
export function documentTypes(document: GraviewDocument, from = "the document"): string {
  const names = typeNames(document);
  const kinds = Object.keys(document.kinds);
  const out: string[] = [];
  out.push(
    `/*\n * The types of "${document.name.replace(/\*\//g, "*\\/")}"${document.version === undefined ? "" : ` (version ${document.version})`}, written by \`graview types ${from}\`.\n` +
      ` * Do not edit: change the document and run it again. Read a store through\n` +
      ` * them with \`typedReader<Types>(store)\` from "@graview/core/typed".\n */\n` +
      (Object.values(document.kinds).some((spec) => Object.values(spec.fields).some((f) => /^(image|video|file)$/.test(f.of ?? f.type))) ? `import type { FileValue } from "@graview/core";\n` : "") +
      (Object.values(document.kinds).some((spec) => Object.values(spec.fields).some((f) => f.repeats)) ? `import type { Repeat } from "@graview/core";\n` : "") +
      `import type { TypedReader } from "@graview/core/typed";\n`,
  );
  for (const [kind, spec] of Object.entries(document.kinds)) {
    let body = `${comment(spec.description, "")}export interface ${names.get(kind)} {\n  readonly id: string;\n  readonly kind: ${JSON.stringify(kind)};\n`;
    for (const [field, f] of Object.entries(spec.fields)) {
      body += `${comment(fieldNote(f), "  ")}  readonly ${key(field)}${f.required ? "" : "?"}: ${fieldType(f)};\n`;
      // How a date repeats, kept beside it: its first occurrence is the date itself.
      if (f.repeats) body += `  /** How ${key(field)} repeats; ${key(field)} is the first occurrence. */\n  readonly ${key(`${field}Repeat`)}?: Repeat | null;\n`;
    }
    // A link to another app's record (FR-171) is kept on this record: "<kind>:<id>", or a list of them.
    for (const [edge, relation] of linkedEdges(spec.edges)) {
      body += `  /** ${relation.cardinality === "one" ? "A record" : "Records"} of ${relation.kinds.join(" or ")} in the app ${relation.address}, as "<kind>:<id>". */\n  readonly ${key(edge)}?: ${relation.cardinality === "one" ? "string" : "readonly string[]"};\n`;
    }
    out.push(`${body}}\n`);
  }
  out.push(`/** Every kind's record, by kind. */\nexport type Kinds = {\n${kinds.map((kind) => `  readonly ${key(kind)}: ${names.get(kind)};\n`).join("")}};\n`);
  const edges = Object.entries(document.kinds).map(([kind, spec]) => {
    const relations = Object.entries(localEdges(spec.edges));
    if (relations.length === 0) return `  readonly ${key(kind)}: {};\n`;
    const lines = relations.map(([edge, e]) => `${comment(e.description, "    ")}    readonly ${key(edge)}: ${e.to === "*" ? "keyof Kinds" : union(e.to)};\n`);
    return `  readonly ${key(kind)}: {\n${lines.join("")}  };\n`;
  });
  out.push(`/** The kinds each kind's relations reach, by kind and relation. */\nexport type Edges = {\n${edges.join("")}};\n`);
  out.push(
    `/** The document's types: what \`typedReader\` reads a store through. */\nexport type Types = { readonly kinds: Kinds; readonly edges: Edges };\n` +
      `/** A record of any kind. */\nexport type AnyRecord = Kinds[keyof Kinds];\n` +
      `/** A store read through these types: \`typedReader<Types>(store)\`. */\nexport type Reader = TypedReader<Types>;\n`,
  );
  return out.join("\n");
}
