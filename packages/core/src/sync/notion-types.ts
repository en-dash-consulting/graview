/*
 * What a Notion database's properties are to a Graview kind, apart from the
 * transport — so the checker (`graview check`) can judge a declared property
 * map, and the transport can judge the database it finds, by one table.
 */

/** The property types a Notion connection keeps in step, and the field types each one may be held in. */
export const NOTION_FITS: Readonly<Record<string, readonly string[]>> = {
  title: ["string", "text"],
  rich_text: ["string", "text"],
  number: ["number", "integer"],
  select: ["enum", "string"],
  status: ["enum", "string"],
  multi_select: ["list"],
  date: ["date", "datetime"],
  checkbox: ["boolean"],
  url: ["url", "string"],
  email: ["email", "string"],
  phone_number: ["phone", "string"],
  // Read from Notion as the people's names, and never written from here.
  people: ["string", "text", "list"],
};

/** The property types a connection reads and never writes. */
export const NOTION_READ_ONLY: ReadonlySet<string> = new Set(["people"]);

/** The field types a property may be inferred for, when the declaration names no properties. */
export const NOTION_INFERABLE: ReadonlySet<string> = new Set(Object.values(NOTION_FITS).flat());

/** Why a property type Notion has is left alone, where it is not the plain "not kept in step". */
export const NOTION_LEFT_ALONE: Readonly<Record<string, string>> = {
  relation: "a relation links pages of two databases, and a connection keeps one database in step",
  formula: "Notion works a formula out, so there is nothing to write",
  rollup: "Notion works a rollup out, so there is nothing to write",
  files: "files are not kept in step yet",
};

/** Whether a field of `fieldType` can hold a Notion property of `propertyType`. */
export function notionFits(propertyType: string, fieldType: string | undefined): boolean {
  return fieldType !== undefined && (NOTION_FITS[propertyType]?.includes(fieldType) ?? false);
}

/** A Notion id: 32 hexadecimal characters, with or without the hyphens. */
export const NOTION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** An internal integration's secret, as Notion writes one: never in a document. */
export const NOTION_SECRET = /(?:^|[^A-Za-z0-9_])(?:secret_|ntn_)[A-Za-z0-9]{20,}/;

/** The environment prefix a Notion connection's secret is read under: `<prefix>_TOKEN`. */
export const NOTION_AUTH_ENV = "NOTION";
