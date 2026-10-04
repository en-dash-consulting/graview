import { config, globalRegistry, type ZodMiniType } from "zod/mini";
import en from "zod/v4/locales/en.js";

/*
 * Imported as a namespace (`import * as z from "./zod.js"`) and never
 * re-exported as one: a namespace object handed on as a value is one a
 * bundler must keep whole, which is the cost this module exists to avoid.
 */
export * from "zod/mini";

/*
 * THE FRAMEWORK'S OWN ZOD: zod/mini, over the one copy of zod a product
 * resolves.
 *
 * A product writes `z.string().min(1)` with the classic `z` that
 * `@graview/core` re-exports, and pays for classic zod in its own bundle
 * by choosing it. The framework itself builds schemas too — the document
 * format, a compiled document's fields, the derived edit acts — and built
 * them with the same classic `z`, which a bundler keeps whole: every page
 * that compiled a document carried 188 KB of zod (FR-57). zod/mini is the
 * same zod (one `$ZodType`, one registry, one parse) with functions in
 * place of methods, so a bundler keeps only what is called — about 25 KB.
 *
 * Classic and mini schemas mix freely: a mini object may hold a classic
 * field and the other way round, and both parse, describe themselves in
 * the global registry and keep their definition on `_zod.def`. So the
 * framework reads a schema only through `_zod.def` (`defOf`) and the
 * registry (`descriptionOf`), never through a classic-only method.
 *
 * Mini carries no messages of its own until a locale is configured; classic
 * configures English when it loads. Configured here too, so a document's
 * findings say "Too big: expected string to have <=500 characters" whether
 * or not anything on the page loaded classic — and only where nobody has
 * chosen a locale, as classic does, so a product's own choice stands.
 */
if (!config().localeError) config(en());


/** A schema's definition, classic or mini: what zod keeps on `_zod.def`. */
export type ZodDef = {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly options?: readonly unknown[];
  readonly element?: unknown;
  readonly values?: readonly unknown[];
  readonly entries?: Record<string, string | number>;
  readonly checks?: readonly unknown[];
  readonly pattern?: unknown;
  readonly format?: string;
  readonly [key: string]: unknown;
};

export const defOf = (schema: unknown): ZodDef | undefined =>
  typeof schema === "object" && schema !== null ? (schema as { _zod?: { def?: ZodDef } })._zod?.def : undefined;

/** What a schema was described as (`.describe(…)` classic, `z.describe(…)` mini): the registry holds both. */
export const descriptionOf = (schema: unknown): string | undefined => {
  if (typeof schema !== "object" || schema === null || !("_zod" in schema)) return undefined;
  const said = globalRegistry.get(schema as ZodMiniType)?.description;
  return typeof said === "string" ? said : undefined;
};
