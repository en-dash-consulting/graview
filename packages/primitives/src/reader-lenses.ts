import type { AnySchema } from "@graview/core";

/**
 * YOUR LENSES — a view the seat drew and a reader kept, in an app whose
 * declaration is code (todo, rota) or that this reader cannot write.
 *
 * Kept in this browser, under the app's name, and laid beside the app's own
 * places when a face opens: a place on the bar, a page at `/places/<as>`,
 * a picture the scene can stand in front of. Never what a kind draws by
 * default, and never written into the declaration: the `add-lens` edit
 * goes to the host (`onKeepLens`) as well, for whoever does write it.
 */

/** A lens as an `add-lens` edit says it: what a reader keeps, and what the seat hands its host. */
export interface KeptLens {
  readonly title: string;
  readonly lens: string;
  readonly on: string;
  readonly bindings?: Readonly<Record<string, unknown>>;
  readonly options?: Readonly<Record<string, unknown>>;
}

/** The name an app's kept lenses are held under: the same one its conversation is. */
export const readerLensesKey = (app: string): string => `graview:lenses:${app}`;

/** The app's name, as the provider keys its conversation: the brand's, else its kinds. */
export const appKeyOf = (brand: { readonly name?: string } | undefined, schema: AnySchema): string => brand?.name ?? (schema.kinds as readonly string[]).join(",");

/** The lenses this reader kept in this app. */
export function readerLenses(app: string): readonly KeptLens[] {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(readerLensesKey(app)) ?? "[]");
    // Only what reads as a lens: the declaration's own judging decides whether it draws.
    return Array.isArray(kept) ? kept.filter((one: KeptLens | null) => typeof one?.title === "string" && typeof one.lens === "string") : [];
  } catch {
    // A private window, a sandboxed frame: nothing kept, and nothing broken.
    return [];
  }
}
