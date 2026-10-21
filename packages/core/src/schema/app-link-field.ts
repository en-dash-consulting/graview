import * as z from "zod";
import { APP_ADDRESS, markAppLink } from "./app-link.js";

/*
 * A DECLARATION'S LINK TO ANOTHER APP (FR-171), in the classic zod a product
 * writes its kinds in, so it chains like any other field:
 *
 *   fields: z.object({
 *     name: z.string(),
 *     house: appLinkField().optional(),
 *   })
 *
 * A document says the same as `{"type": "app-link"}`. The value is another
 * app's address; the host's `resolveApp` says what it is called.
 */

/** A field that holds another app's address: `@owner/app`, its id, or its https:// address. */
export function appLinkField(): z.ZodString {
  return markAppLink(z.string().max(500).regex(APP_ADDRESS, "another app's address"));
}
