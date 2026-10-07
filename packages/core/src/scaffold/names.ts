import type { ScaffoldOptions } from "./index.js";

/*
 * WHAT A NEW PROJECT IS CALLED, and every way that name is spelled: a slug
 * for paths, a title for people, camel and pascal for code, and the escapes
 * that let a name sit safely inside the files written about it.
 */

export const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function camel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function pascal(slug: string): string {
  const c = camel(slug);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * The reasons a name or a kind cannot be used, said before any file exists.
 * A kind is a TypeScript identifier and a URL segment and an edge target,
 * so it is held to the strictest of those.
 */
export function validateScaffoldOptions(options: ScaffoldOptions): readonly string[] {
  const problems: string[] = [];
  if (!options.name || options.name.trim().length === 0) {
    problems.push("a name is required — the product's name, as a person would say it");
  }
  const kind = options.kind ?? "item";
  if (!SLUG.test(kind)) {
    problems.push(`the kind "${kind}" must be a slug: lowercase letters, digits and hyphens, starting with a letter`);
  }
  const plural = options.plural ?? `${kind}s`;
  if (!SLUG.test(plural)) {
    problems.push(`the plural "${plural}" must be a slug like the kind: lowercase letters, digits and hyphens`);
  }
  if (["kind", "edge", "node", "rule", "graph"].includes(kind)) {
    problems.push(`the kind "${kind}" is a word the framework uses for itself; pick the thing your product is about`);
  }
  if (options.packageName !== undefined && !/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9-._]*$/.test(options.packageName)) {
    problems.push(`the package name "${options.packageName}" is not one npm accepts`);
  }
  if (options.port !== undefined && !(Number.isInteger(options.port) && options.port > 0 && options.port < 65536)) {
    problems.push(`the port ${String(options.port)} is not a port`);
  }
  if (options.accent !== undefined && !/^#[0-9a-fA-F]{6}$/.test(options.accent)) {
    problems.push(`the accent "${options.accent}" must be a six-digit hex color like #2e7d32`);
  }
  return problems;
}

export type Ids = {
  name: string;
  kind: string;
  plural: string;
  spoken: string;
  spokenPlural: string;
  /** The kind spoken with its article: "an item", "a work order". */
  aSpoken: string;
  /** The same, capitalized for the head of a sentence. */
  ASpoken: string;
  Kind: string;
  Plural: string;
  kindVar: string;
  KindPascal: string;
  appVar: string;
  brandVar: string;
  schemaVar: string;
  SchemaType: string;
  StoreType: string;
  AppComponent: string;
  accent: string;
  port: number;
  link: string | undefined;
  frameworkRepo: string | undefined;
  range: string;
  packageManager: "pnpm" | "npm";
  packageName: string;
  /** The act the starter seat is gated on: one that creates the kind. */
  gate: string;
  /** Made from a template (FR-08): the declaration is the document in src/domain/app.json. */
  fromTemplate: boolean;
};

/* -------------------------------------------------------------- escapes */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function escapeTemplate(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\`").replace(/\$\{/g, "\${");
}
