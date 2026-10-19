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
  /** A picture's or a video's size in pixels, where the host knows it. */
  readonly width?: number;
  readonly height?: number;
  /** What it shows, in words: a picture's alt text, and what Find matches beside its name. */
  readonly caption?: string;
  /**
   * A VIDEO'S FACTS (0.1.37), where the host's upload answered them: the
   * picture drawn before it plays (a path on the host, as `href` is), its
   * length in seconds, and its captions (a WebVTT file on the host). Unsaid,
   * the page draws the video's first frame and reads its length from what
   * the player loads first (`preload="metadata"`).
   */
  readonly poster?: string;
  readonly duration?: number;
  readonly captions?: string;
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
  /**
   * A video (`video/*` in `kinds`, 0.1.37) is sent as it was picked: the
   * host answers a value a browser plays (an H.264 MP4 made from a phone's
   * HEVC `.mov`, say) with its `poster`, `duration`, `width` and `height`
   * where it knows them.
   */
  upload(file: Blob, name: string): Promise<FileValue>;
  readonly maxBytes: number;
  readonly kinds: readonly string[];
  /**
   * WHETHER THE HOST STILL KEEPS A FILE'S BYTES (Roadmap f-playback). The
   * past holds every file a record ever held, and the bytes are the host's:
   * one removed since is drawn as "removed later" rather than a broken
   * picture. Unsaid, a file is drawn as kept, and one that does not load
   * while somebody looks back is said to be removed later. A host that
   * cannot say at once (its bytes are elsewhere) answers a promise
   * (Roadmap f-files-kept-async): the picture is drawn as kept until it
   * settles, the page asks once per href for as long as it holds this
   * `files`, and a promise that rejects is taken as kept.
   */
  kept?(href: string): boolean | Promise<boolean>;
  /**
   * WHERE THE HOST SERVES A FILE A RECORD HOLDS (0.1.36): the address the
   * page draws, links and downloads `href` at. A host that serves the app
   * under a base (Graview Cloud's `/a/<app>`) answers `base + href`, since
   * a record keeps the path its upload answered, without the base.
   * `filesAt(url)` derives it from its own url. Unsaid, the href itself.
   * `kept` and what the page says of a file still name it by `href`.
   */
  src?(href: string): string;
}

/** Where the page draws, links or downloads a record's file: where its host says it serves it (`HostFiles.src`), else the href as the record keeps it. */
export const fileSrc = (files: HostFiles | undefined, href: string): string => files?.src?.(href) ?? href;

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
    (v.caption === undefined || (typeof v.caption === "string" && v.caption.length < 501)) &&
    (v.poster === undefined || safeFileHref(v.poster)) &&
    (v.captions === undefined || safeFileHref(v.captions)) &&
    (v.duration === undefined || (typeof v.duration === "number" && Number.isFinite(v.duration) && v.duration > 0))
  );
}

/** Whether a file is a picture a page can draw. */
export const isImage = (file: { readonly type: string }): boolean => file.type.startsWith("image/");

/** Whether a file is a video a page can play (0.1.37). */
export const isVideo = (file: { readonly type: string }): boolean => file.type.startsWith("video/");

/** A video's length as a person reads it: "a 45-second video", "a 3-minute video", "a 1-hour 7-minute video"; "a video" where its length is unsaid. */
export function videoWords(file: { readonly duration?: number }): string {
  const seconds = file.duration === undefined ? 0 : Math.round(file.duration);
  if (seconds < 1) return "a video";
  if (seconds < 60) return `a ${seconds}-second video`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `a ${minutes}-minute video`;
  const hours = Math.floor(minutes / 60);
  return `a ${hours}-hour${minutes % 60 > 0 ? ` ${minutes % 60}-minute` : ""} video`;
}

/** What a file field holds: a picture, a video, or a file of any type. */
export type FileKind = "image" | "video" | "file";

/** Whether a file is of the sort a field of `as` holds. */
export const fileOfKind = (file: { readonly type: string }, as: FileKind): boolean => (as === "image" ? isImage(file) : as === "video" ? isVideo(file) : true);

/** What a field of `as` holds, said where a value is refused. */
export const fileRefusal = (as: FileKind): string => `${as === "image" ? "an image" : as === "video" ? "a video" : "a file"} the host stored, at a path on this host`;

/** The files a value holds: one, a list of them, or none. */
export const filesOf = (value: unknown): readonly FileValue[] => (Array.isArray(value) ? value : [value]).filter(isFileValue);

/*
 * WHICH FIELDS HOLD FILES: a mark on the schema's def, under a registry
 * symbol, as a node reference is marked — so a clone (`.describe()`) shares
 * it, a refinement spreads it (it is enumerable), a wrapper (`.optional()`)
 * holds it inside, and another copy of the framework reads it alike.
 */
const FILE = Symbol.for("@graview/core:file");

/** Marks a schema as holding an image, a video or a file. */
export const markFile = <T extends object>(schema: T, as: FileKind): T => (Object.defineProperty(defOf(schema)!, FILE, { value: as, enumerable: true }), schema);

/** Whether a field holds an image, a video or a file — under optional, default and nullable — or none of them. */
export function fileKindOf(schema: unknown): FileKind | undefined {
  const def = defOf(schema) as { [FILE]?: FileKind; innerType?: unknown } | undefined;
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
  poster: z.optional(z.string()),
  duration: z.optional(z.number()),
  captions: z.optional(z.string()),
});

/** A document's `image`, `video` or `file` field, in zod/mini. */
export function fileSchema(as: FileKind): z.ZodMiniType {
  return markFile(z.object(fileShape()).check(z.refine((v) => isFileValue(v) && fileOfKind(v, as), fileRefusal(as))), as);
}
