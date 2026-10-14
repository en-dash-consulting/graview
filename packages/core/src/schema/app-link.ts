import * as z from "./zod.js";
import { defOf } from "./zod.js";
import { APP_ADDRESS } from "./app-address.js";

export { APP_ADDRESS, isAppAddress } from "./app-address.js";

/*
 * A LINK TO ANOTHER APP (FR-171).
 *
 * A relation's `to` names kinds inside one document, so a scenario in one
 * app could not point at a house in another. This is the first step there:
 * a field whose value is ANOTHER APP'S ADDRESS — `@nick/house`, an id the
 * host knows its apps by (`app_kf5eydr9z58jzf`), or the app's absolute
 * `https:` address. The record keeps the address as any other value; what
 * the address is CALLED, and whether this viewer may open it, is the
 * host's to say (`ResolveApp`), and the field draws as that app's name,
 * icon and home headline rather than as the address.
 *
 * A hosted page loads this up front to build a document's fields, so it
 * holds that and no more; what draws one is `@graview/primitives`'s,
 * fetched with the first drawn. A relation whose `to` is a KIND in another
 * app — a record there, walked by an expression, its changes kept in this
 * app's history — is `linked.ts`'s.
 */

/*
 * WHICH FIELDS HOLD AN APP'S ADDRESS: a mark on the schema's def, as a file
 * field is marked (`files.ts`), so a clone shares it, a refinement spreads it
 * and a wrapper holds it inside.
 */
const APP_LINK = Symbol.for("@graview/core:app-link");

/** Marks a schema as holding another app's address. */
export const markAppLink = <T extends object>(schema: T): T => (Object.defineProperty(defOf(schema)!, APP_LINK, { value: 1, enumerable: true }), schema);

/** Whether a field holds another app's address — under optional, default and nullable. */
export function isAppLinkField(schema: unknown): boolean {
  const def = defOf(schema) as { [APP_LINK]?: 1; innerType?: unknown } | undefined;
  return !!def && (def[APP_LINK] === 1 || isAppLinkField(def.innerType));
}

/** A document's `app-link` field, in zod/mini: at most 500 characters. */
export const appLinkSchema = (): z.ZodMiniType => markAppLink(z.string().check(z.maxLength(500), z.regex(APP_ADDRESS, "another app's address")));

/** Another app, as the host says it to this viewer: its name, its icon, its home's headline, and where it opens. */
export interface LinkedApp {
  readonly name: string;
  /** A picture the host serves (a path on the host or an http(s) address), or an emoji or a letter or two. */
  readonly icon?: string;
  /** What the app's home says first, in a line. */
  readonly headline?: string;
  /** Where the app opens: a path on the host or an http(s) address. */
  readonly href: string;
}

/**
 * THE HOST'S ANSWER for one address and one viewer: the app; `{ denied:
 * true }` when this viewer may not open it (the field says "linked app (no
 * access)" and nothing of it); or null when the host knows no such app (the
 * field draws the address, plainly).
 */
export type AppResolution = LinkedApp | { readonly denied: true } | null;

/**
 * THE HOST'S WAY TO NAME ANOTHER APP (FR-171): handed to `mount`, `<Embed>`,
 * `GraviewProvider` or the routed face as `resolveApp`. Asked once per
 * address and viewer, and remembered; a throw is taken as null.
 */
export type ResolveApp = (address: string, viewer: { readonly kind: string; readonly id?: string | undefined; readonly roles?: readonly string[] | undefined }) => Promise<AppResolution>;
