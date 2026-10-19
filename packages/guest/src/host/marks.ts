import type { FileKind, FileValue } from "@graview/core";

/*
 * WHAT A DECLARATION MARKS ON ITS SCHEMAS, READ WITHOUT ZOD (FR-193).
 *
 * Core marks a field that holds a file, and an argument that names a
 * record, on the schema's def under a registry symbol (`Symbol.for`), so any
 * copy of the framework reads them. Core's readers sit in modules that load
 * zod; the guest host reads the same marks here, so a page that draws a
 * worker view loads none of zod for it. Held to core's readers by
 * `a-view-takes-files-dropped-on-it`.
 */

const FILE = Symbol.for("@graview/core:file");
const NODE_REF = Symbol.for("@graview/core:node-ref");

type Def = { readonly type?: string; readonly innerType?: unknown; readonly element?: unknown; readonly [key: symbol]: unknown };
const defOf = (schema: unknown): Def | undefined => (typeof schema === "object" && schema !== null ? (schema as { _zod?: { def?: Def } })._zod?.def : undefined);

/** Whether a field holds an image, a video or a file — under optional, default and nullable — as core's `fileKindOf` says it. */
export function fileKindOf(schema: unknown): FileKind | undefined {
  const def = defOf(schema);
  return (def?.[FILE] as FileKind | undefined) ?? (def?.innerType ? fileKindOf(def.innerType) : undefined);
}

/** What a field holds, where it holds files: one, or a list of them. */
export function fileFieldKind(schema: unknown): { readonly as: FileKind; readonly list: boolean } | undefined {
  const one = fileKindOf(schema);
  if (one) return { as: one, list: false };
  let def = defOf(schema);
  while (def?.innerType) def = defOf(def.innerType);
  const of = def?.type === "array" ? fileKindOf(def.element) : undefined;
  return of ? { as: of, list: true } : undefined;
}

/** The kinds an argument names a record of, as core's `nodeRefKinds` says them; undefined where it names none. */
export function refKindsOf(schema: unknown): readonly string[] | undefined {
  if (typeof schema !== "object" || schema === null) return undefined;
  const direct = (schema as Def)[NODE_REF] as readonly string[] | undefined;
  if (direct) return direct;
  const def = defOf(schema);
  return (def?.[NODE_REF] as readonly string[] | undefined) ?? (def?.innerType ? refKindsOf(def.innerType) : undefined);
}

/** An act's arguments that name a record, by name, with their kinds. */
export function refArgsOf(input: unknown): { readonly name: string; readonly kinds: readonly string[] }[] {
  const shape = (input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  return Object.entries(shape).flatMap(([name, schema]) => {
    const kinds = refKindsOf(schema);
    return kinds ? [{ name, kinds }] : [];
  });
}

/** What looks like a stored file: an object with a string `href`, a name, a type and a size. The act's own field judges it whole. */
export const isStoredFile = (value: unknown): value is FileValue =>
  typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as FileValue).href === "string" && typeof (value as FileValue).name === "string" && typeof (value as FileValue).type === "string" && typeof (value as FileValue).bytes === "number";

/** The files a value holds: one, a list of them, or none. */
export const storedFilesOf = (value: unknown): readonly FileValue[] => (Array.isArray(value) ? value : [value]).filter(isStoredFile);
