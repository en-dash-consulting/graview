/**
 * THE STUDIO DOOR'S CONTRACT — what the studio and a dev server agree on.
 *
 * The studio edits a declaration as a graph, and a browser cannot write a
 * checkout. The door is the dev server writing it on the studio's behalf —
 * and what crosses it is not files. Files regenerated from the graph would
 * erase everything the graph does not hold: the comments, the `describe`
 * and `format` functions, every hand-written body. What crosses is the
 * CHANGE — a field added here, an edge moved there — and the server makes
 * exactly that edit inside the checkout's own `defineNode` calls, leaving
 * every other character where it was.
 *
 * Like the other doors, it carries no Node and no DOM: the page and the
 * plugin both hold it and neither imports the other. And the page never
 * names a path: the server writes only the files it finds under its own
 * `src/domain/`, so there is nothing a request can point elsewhere.
 */

/** Where the door answers unless an app says otherwise. */
export const STUDIO_DOOR_PATH = "/__graview/studio";

/** One change to the declaration, as the source must receive it. Texts are TypeScript. */
export type DeclarationChange =
  /** A kind declared afresh: the whole `defineNode` statement, and the name it is bound to. */
  | { readonly what: "add-kind"; readonly kind: string; readonly binding: string; readonly text: string }
  | { readonly what: "remove-kind"; readonly kind: string }
  /** One of a kind's own settings — `description`, `plural`, `figure` — as TypeScript, or `null` to take it off. */
  | { readonly what: "set-kind-property"; readonly kind: string; readonly property: string; readonly text: string | null }
  /** `zod` is the field's schema expression: `z.number().optional()`. */
  | { readonly what: "add-field"; readonly kind: string; readonly field: string; readonly zod: string }
  | { readonly what: "change-field"; readonly kind: string; readonly field: string; readonly zod: string }
  | { readonly what: "remove-field"; readonly kind: string; readonly field: string }
  /** `text` is the edge's object literal: `{ to: ["gardener"], description: "…" }`. */
  | { readonly what: "add-edge"; readonly kind: string; readonly edge: string; readonly text: string }
  | { readonly what: "change-edge"; readonly kind: string; readonly edge: string; readonly text: string }
  | { readonly what: "remove-edge"; readonly kind: string; readonly edge: string }
  /**
   * The same relation, declared on another kind. Carried as it is written —
   * its readings, its comments — and only its targets rewritten.
   */
  | { readonly what: "move-edge"; readonly edge: string; readonly from: string; readonly to: string; readonly targets: string };

/** GET — is the door open, and which files would it edit? */
export type StudioDoorStatus =
  | { readonly available: true; readonly domain: string; readonly files: readonly string[] }
  | { readonly available: false; readonly reason: string };

/** POST — the changes, in the order they were made. */
export interface StudioDoorAsk {
  readonly changes: readonly DeclarationChange[];
  /** Say what would be written, and write nothing. */
  readonly dryRun?: boolean;
}

/**
 * What came back. All or nothing: a change the source cannot take — a kind
 * it cannot find, a field declared somewhere it cannot read — refuses the
 * whole request, naming why, and no file is touched.
 */
export type StudioDoorAnswer =
  | { readonly written: readonly string[]; readonly diff: readonly { readonly path: string; readonly before: string; readonly after: string }[] }
  | { readonly refused: readonly string[] }
  | { readonly error: string };
