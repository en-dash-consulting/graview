import { fileKindOf } from "../schema/files.js";
import { isAppLinkField } from "../schema/app-link.js";
import { isMarkdownField } from "../schema/markdown.js";
import { isCollaborativeField } from "../schema/collaborative.js";
import { typedFieldOf } from "../schema/typed-field-of.js";
import { descriptionOf } from "../schema/zod.js";
import { isMoment } from "../days.js";
import type { FieldSpec } from "./schema.js";

/*
 * ONE DECLARED FIELD, IN THE DOCUMENT'S WORDS: `url`, `date`, `enum`, an
 * `image` (FR-162) and the rest. Apart from `toDocument`, which writes a
 * whole app as a document: a view's check and a face's blocks read a field
 * this way, and a bundler places a whole file in a page's first chunk when
 * the first chunk can reach it — so a hosted page carries this, and not
 * the writing of a document it never asks for.
 */

type ZodLike = { readonly _zod?: { readonly def?: Record<string, unknown> } };
const defOf = (schema: unknown): Record<string, unknown> | undefined => (schema as ZodLike | undefined)?._zod?.def;

const DATE = /^\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$$/;

/** One zod field as a document field, or why it cannot be one. */
export function fieldOf(schema: unknown): { readonly spec: FieldSpec } | { readonly why: string } {
  let def = defOf(schema);
  let required = true;
  let fallback: unknown;
  for (let depth = 0; def && depth < 4; depth++) {
    if (def["type"] === "optional" || def["type"] === "nullable") required = false;
    else if (def["type"] === "default") {
      required = false;
      fallback = def["defaultValue"];
    } else break;
    def = defOf(def["innerType"]);
  }
  if (!def) return { why: "it is not a zod field" };
  const description = descriptionOf(schema);
  const base = { ...(required ? { required: true } : {}), ...(fallback !== undefined ? { default: fallback } : {}), ...(description ? { description } : {}) };
  const checks = ((def["checks"] as readonly ZodLike[] | undefined) ?? []).map((check) => defOf(check));
  // A picture or a document (FR-162): `imageField()`, `fileField()`.
  const file = fileKindOf(schema);
  if (file) return { spec: { type: file, ...base } };
  // Another app's address (FR-171): `appLinkField()`.
  if (isAppLinkField(schema)) return { spec: { type: "app-link", ...base } };
  // Prose written in Markdown (FR-180): `markdownField()`.
  // Typed together, where that is not what the document's type says by default (Roadmap f-collab-text): a text is, a string is not.
  const together = (type: "text" | "string") => (isCollaborativeField(schema) !== (type === "text") ? { collaborative: type !== "text" } : {});
  if (isMarkdownField(schema)) return { spec: { type: "text", format: "markdown", ...base, ...together("text") } };
  // A phone, a place or a duration: `phoneField()`, `placeField()`, `durationField()`.
  const typed = typedFieldOf(schema);
  if (typed) return { spec: { type: typed, ...base } };
  switch (def["type"]) {
    case "string": {
      const format = def["format"];
      if (format === "email") return { spec: { type: "email", ...base } };
      if (format === "url") return { spec: { type: "url", ...base } };
      if (format === "date") return { spec: { type: "date", ...base } };
      if (format === "datetime" || checks.some((check) => check?.["fn"] === isMoment)) return { spec: { type: "datetime", ...base } };
      if (checks.some((check) => check?.["format"] === "regex" && DATE.test(String((check?.["pattern"] as RegExp | undefined)?.source ?? "")))) return { spec: { type: "date", ...base } };
      return { spec: { type: "string", ...base, ...together("string") } };
    }
    case "number": {
      // Its range, where the declaration bounds it inclusively (FR-114): `.min(1).max(5)`, `.multipleOf(0.5)`.
      const range: { min?: number; max?: number; step?: number } = {};
      for (const check of checks) {
        const value = check?.["value"];
        if (typeof value !== "number") continue;
        if (check?.["check"] === "greater_than" && check["inclusive"]) range.min = Math.max(range.min ?? value, value);
        else if (check?.["check"] === "less_than" && check["inclusive"]) range.max = Math.min(range.max ?? value, value);
        else if (check?.["check"] === "multiple_of") range.step = value;
      }
      return { spec: { type: checks.some((check) => check?.["format"] === "safeint" || check?.["format"] === "int") ? "integer" : "number", ...range, ...base } };
    }
    case "boolean":
      return { spec: { type: "boolean", ...base } };
    case "enum": {
      const options = Object.keys((def["entries"] as Record<string, unknown> | undefined) ?? {});
      return options.length > 0 ? { spec: { type: "enum", options, ...base } } : { why: "it is an enum with no options" };
    }
    case "array": {
      const element = defOf(def["element"]);
      const of = fileKindOf(def["element"]) ?? (element?.["type"] === "number" ? "number" : element?.["type"] === "string" ? "string" : undefined);
      return of ? { spec: { type: "list", of, ...base } } : { why: `it is a list of ${String(element?.["type"] ?? "something")}, and a document lists words, numbers, dates, images, videos or files` };
    }
    default:
      return { why: `it is a ${String(def["type"])}, which a document has no field type for` };
  }
}

/**
 * What one declared field is, in the document's words — `url`, `date`,
 * `enum` and the rest — or undefined when a document has no word for it.
 * A view spec reads it to know which values may be a link and which a date.
 */
export function fieldSpecOf(field: unknown): FieldSpec | undefined {
  const read = fieldOf(field);
  return "spec" in read ? read.spec : undefined;
}
