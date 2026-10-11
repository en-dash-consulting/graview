import { z } from "zod";
import { fileShape, isFileValue, isImage, markFile, type FileValue } from "./files.js";

/*
 * A DECLARATION'S PICTURE AND DOCUMENT FIELDS (FR-162), in the classic zod a
 * product writes its kinds in, so they chain like any other field:
 *
 *   fields: z.object({
 *     name: z.string(),
 *     photo: imageField().optional(),
 *     papers: z.array(fileField()).max(20),
 *   })
 *
 * A document says the same as `{"type": "image"}`, `{"type": "file"}` and
 * `{"type": "list", "of": "image"}`. The value is a `FileValue` the host's
 * upload answered; its `href` is a path on the host (see `safeFileHref`).
 */

/** A field that holds one picture: a `FileValue` whose type is an image's. */
export function imageField(): z.ZodType<FileValue> {
  return markFile(z.object(fileShape()).refine((v) => isFileValue(v) && isImage(v), "an image the host stored, at a path on this host"), "image") as never;
}

/** A field that holds one file of any type: a `FileValue`. */
export function fileField(): z.ZodType<FileValue> {
  return markFile(z.object(fileShape()).refine(isFileValue, "a file the host stored, at a path on this host"), "file") as never;
}
