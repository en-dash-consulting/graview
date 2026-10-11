import { filesOf, fileKindOf, isImage, type FileValue } from "./files.js";
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

/** The fields of a kind that hold files — one, or a list of them — in declared order. */
export function fileFieldsOf(definition: { readonly fields?: unknown } | undefined): readonly string[] {
  const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  return Object.keys(shape).filter((key) => {
    let def = defOf(shape[key]);
    while (def?.innerType) def = defOf(def.innerType);
    return fileKindOf(shape[key]) !== undefined || (def?.type === "array" && fileKindOf(def.element) !== undefined);
  });
}

/** A record's first picture, in its kind's declared order: what a card or a row shows small. */
export function firstPicture(node: Readonly<Record<string, unknown>>, definition: { readonly fields?: unknown } | undefined): FileValue | undefined {
  for (const key of fileFieldsOf(definition)) {
    const found = filesOf(node[key]).find(isImage);
    if (found) return found;
  }
  return undefined;
}
