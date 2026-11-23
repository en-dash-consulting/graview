import { filesOf, fileKindOf, isImage, isVideo, previewOf, videoWords, type FileValue } from "./files.js";
import { defOf } from "./zod.js";

/*
 * WHAT ONLY A DRAWN RECORD ASKS OF ITS FILES (FR-162): which fields hold
 * them, its first picture, the words a file is said by. Apart from
 * `files.ts`, which a hosted page loads up front to build a document's
 * fields: a bundler places a whole module in the first chunk when that
 * chunk reaches it, so these ride with the faces that draw them.
 */

/** What a file is said as where it cannot be seen: its caption, else its name. */
export const fileWords = (file: FileValue): string => file.caption?.trim() || file.name;

/** What a file is said as to somebody listening: its words, and for a video how long it is (0.1.37): "beach.mov, a 45-second video". */
export const fileSaid = (file: FileValue): string => (isVideo(file) ? `${fileWords(file)}, ${videoWords(file)}` : fileWords(file));

/** A size as a person reads it: "820 bytes", "120 KB", "3.4 MB". */
export function sizeWords(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

/** A file's type as a person says it: "PDF", "JPEG", "DOCX" — its name's ending, else the type's. */
export function typeWords(file: { readonly type: string; readonly name?: string }): string {
  if (file.type === "application/pdf") return "PDF";
  const ending = /\.([a-z0-9]{2,5})$/i.exec(file.name ?? "")?.[1];
  if (ending) return ending.toUpperCase();
  const sub = file.type.split("/")[1] ?? file.type;
  return sub.replace(/^x-|^vnd\./, "").split(/[.+-]/)[0]!.toUpperCase();
}

/** A video's length as a player's clock says it (0.1.37): "0:45", "2:05", "1:02:05". */
export function videoClock(duration: number): string {
  const total = Math.max(0, Math.round(duration));
  const two = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}:${two(minutes)}:${two(total % 60)}` : `${minutes}:${two(total % 60)}`;
}

/** The fields of a kind that hold files — one, or a list of them — in declared order. */
export function fileFieldsOf(definition: { readonly fields?: unknown } | undefined): readonly string[] {
  const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  return Object.keys(shape).filter((key) => {
    let def = defOf(shape[key]);
    while (def?.innerType) def = defOf(def.innerType);
    return fileKindOf(shape[key]) !== undefined || (def?.type === "array" && fileKindOf(def.element) !== undefined);
  });
}

/**
 * A record's first picture — or video, drawn by its poster (0.1.37) — in its
 * kind's declared order: what a card or a row shows small. Where it holds
 * none, its first document with a preview its host made (HQ
 * f-file-values-carry-a-preview): a photograph is the record's picture
 * before a PDF's first page is.
 */
export function firstPicture(node: Readonly<Record<string, unknown>>, definition: { readonly fields?: unknown } | undefined): FileValue | undefined {
  const files = fileFieldsOf(definition).flatMap((key) => filesOf(node[key]));
  return files.find((file) => isImage(file) || isVideo(file)) ?? files.find((file) => previewOf(file) !== undefined);
}
