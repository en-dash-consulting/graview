import { z } from "zod";
import { markMarkdown } from "./markdown.js";

/*
 * PROSE WRITTEN IN MARKDOWN (FR-180), in the classic zod a product writes
 * its kinds in, so it chains like any other field:
 *
 *   fields: z.object({
 *     title: z.string(),
 *     body: markdownField().optional(),
 *   })
 *
 * A document says the same as `{"type": "text", "format": "markdown"}`: up
 * to 20,000 characters, asked for in a text area, drawn as prose on the
 * record's page and said as an excerpt everywhere else.
 */

/** A text field whose value is Markdown: at most 20,000 characters. */
export function markdownField(): z.ZodString {
  return markMarkdown(z.string().max(20_000));
}
