/** What became of a value a host was asked to keep: kept, or refused in a sentence the view's author and its person can read. */
export type ViewerStateAnswer = { readonly ok: true } | { readonly ok: false; readonly sentence: string };

/**
 * WHAT A VIEW KEEPS FOR WHOEVER IS LOOKING AT IT (Roadmap
 * f-viewer-state-and-me-framework): small strings, by the view's name, that a
 * host stores for the viewer it knows — the seat's, or the profile's — and
 * hands `mount`, `<Embed>` and `PagesApp`. Not part of the graph or the log:
 * never in history, undo, an export or an agent's tools. Each value is a string
 * somebody wrote, data, of at most 4 KB, and a host adds caps of its own by
 * answering a sentence. Without one, a page keeps them for the visit.
 */
export interface ViewerState {
  /** Every value this view has kept for the viewer. */
  read(view: string): Promise<Readonly<Record<string, string>>>;
  /** Keep a value, or forget it (`null`). */
  write(view: string, key: string, value: string | null): Promise<ViewerStateAnswer>;
}
