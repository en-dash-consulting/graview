import * as z from "./zod.js";
import { defOf } from "./zod.js";

/*
 * A PICTURE OR A DOCUMENT ON A RECORD (FR-162).
 *
 * The bytes are the host's: it stores what its `files.upload` is handed
 * (FR-163) and serves it to whoever may read the record. The record keeps
 * what the host answered — where the file is, what it is called, its type
 * and size, and for a picture its size in pixels and a caption — as any
 * other value: written by an act, in the log, undone, exported, remixed.
 *
 * `href` is a PATH ON THE HOST, never an address of somewhere else: `/`
 * and a path (`/graview/files/3f9a….jpg`, as Graview Cloud answers), or a
 * relative one the page's base resolves (`files/3f9a….jpg`). Refused: a
 * scheme of any sort — `javascript:`, `data:`, `https:` alike, since a
 * record can be written by a seat or an import as well as by an upload —
 * another host (`//elsewhere`), a backslash (which a browser reads as a
 * slash), and a path that climbs (`..`, `.`, `%2e`). A `data:` picture is
 * refused too: the bytes belong in the host's store, not in the log.
 */

/** A file the host stored, as its upload answered and a record keeps it. */
export interface FileValue {
  /** A path on the host, under its base: `/graview/files/3f9a….jpg`. */
  readonly href: string;
  /** What it was called when it was put on the record: `porch.jpg`. */
  readonly name: string;
  /** Its media type: `image/jpeg`, `application/pdf`. */
  readonly type: string;
  /** Its size in bytes. */
  readonly bytes: number;
  /** A picture's size in pixels, where the host knows it. */
  readonly width?: number;
  readonly height?: number;
  /** What it shows, in words: a picture's alt text, and what Find matches beside its name. */
  readonly caption?: string;
}

/**
 * THE HOST'S FILES (FR-163): handed to `mount`, `<Embed>`, `GraviewProvider`
 * or the Shell as `files`, it is what a file field's editor sends to.
 * `upload` stores the bytes and answers the value the record will keep; a
 * refusal is thrown, and its message is said in the editor. `maxBytes` and
 * `kinds` (media types, `image/*` for any picture) are said before anything
 * is sent. Without it, the editor says this host takes no files.
 */
export interface HostFiles {
  upload(file: Blob, name: string): Promise<FileValue>;
  readonly maxBytes: number;
  readonly kinds: readonly string[];
}

/** Whether `href` is a path on the host: no scheme, no other host, no backslash, nothing that climbs. */
export const safeFileHref = (href: unknown): href is string =>
  typeof href === "string" && href.length < 2049 && /^(?![^/?#]*:|\/\/)(?!(?:.*\/)?\.\.?(?:[/?#]|$))(?!.*%2e)[^\\\s]+$/i.test(href);

/** A whole number at least `least`, or nothing at all where `least` is 1 (a size in pixels may be unsaid). */
const count = (n: unknown, least = 1) => (least > 0 && n === undefined) || (Number.isInteger(n) && (n as number) >= least);

/** Whether a value is a file a record may keep: the shape, a path on the host, a media type (`image/jpeg`), its size, a caption of at most 500 characters. */
export function isFileValue(value: unknown): value is FileValue {
  const v = (value ?? {}) as Partial<Record<keyof FileValue, unknown>>;
  return (
    safeFileHref(v.href) &&
    typeof v.name === "string" &&
    /^.{1,255}$/s.test(v.name) &&
    /^[\w.+-]{1,60}\/[\w.+-]{1,60}$/.test(v.type as string) &&
    count(v.bytes, 0) &&
    count(v.width) &&
    count(v.height) &&
    (v.caption === undefined || (typeof v.caption === "string" && v.caption.length < 501))
  );
}

/** Whether a file is a picture a page can draw. */
export const isImage = (file: { readonly type: string }): boolean => file.type.startsWith("image/");

/** The files a value holds: one, a list of them, or none. */
export const filesOf = (value: unknown): readonly FileValue[] => (Array.isArray(value) ? value : [value]).filter(isFileValue);

/*
 * WHICH FIELDS HOLD FILES: a mark on the schema's def, under a registry
 * symbol, as a node reference is marked — so a clone (`.describe()`) shares
 * it, a refinement spreads it (it is enumerable), a wrapper (`.optional()`)
 * holds it inside, and another copy of the framework reads it alike.
 */
const FILE = Symbol.for("@graview/core:file");

/** Marks a schema as holding an image or a file. */
export const markFile = <T extends object>(schema: T, as: "image" | "file"): T => (Object.defineProperty(defOf(schema)!, FILE, { value: as, enumerable: true }), schema);

/** Whether a field holds an image or a file — under optional, default and nullable — or neither. */
export function fileKindOf(schema: unknown): "image" | "file" | undefined {
  const def = defOf(schema) as { [FILE]?: "image" | "file"; innerType?: unknown } | undefined;
  return def?.[FILE] ?? (def?.innerType ? fileKindOf(def.innerType) : undefined);
}

/** The value's fields, as a tool schema says them. */
export const fileShape = () => ({
  href: z.string(),
  name: z.string(),
  type: z.string(),
  bytes: z.number(),
  width: z.optional(z.number()),
  height: z.optional(z.number()),
  caption: z.optional(z.string()),
});

/** A document's `image` or `file` field, in zod/mini. */
export function fileSchema(as: "image" | "file"): z.ZodMiniType {
  return markFile(z.object(fileShape()).check(z.refine((v) => isFileValue(v) && (as === "file" || isImage(v)), `${as === "image" ? "an image" : "a file"} the host stored, at a path on this host`)), as);
}
