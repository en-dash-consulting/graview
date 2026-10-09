import { placesOf, type AnySchema, type AppPlace, type GraviewApp, type LensDeclaration, type ShippedLensName } from "@graview/core";
import { checkApp, compileDocument } from "@graview/core/check";
import { diffDocuments, editDocument, type DocumentEdit, type GraviewDocument } from "@graview/core/document";
import { lensEditOf, takeBackEditOf, type AddLensEdit, type RemoveLensEdit } from "./draft.js";

/*
 * KEEPING A DRAFTED VIEW AS A LENS, where the declaration is written.
 *
 * `@graview/tools/draft` draws a view and judges it with what a page
 * already runs; keeping one changes the declaration, which is the host's:
 * the `add-lens` edit through `editDocument`, `compileDocument` (graview
 * check) and `diffDocuments` for a document, or `checkApp` over the
 * declaration with the lens beside its own for an app declared in code.
 * An entry of its own, `@graview/tools/keep`, so a page that draws drafts
 * never carries the edit vocabulary or the checker: a host (Graview Cloud's
 * server, a dev server, a test) keeps, and a page hands it the edit
 * (`onKeepLens`).
 */

const pluralOf = (schema: AnySchema, kind: string): string => ((schema.tryDefinition(kind) as { plural?: string } | undefined)?.plural ?? `${kind}s`).toLowerCase();

/** What a lens is kept in: the document an app was compiled from, or the app as it was declared in code. */
export type LensHolder<S extends AnySchema = AnySchema> = { readonly document: GraviewDocument } | { readonly app: GraviewApp<S> };

export interface LensKept<S extends AnySchema = AnySchema> {
  readonly ok: true;
  /** "Adds “Deliverables by status” to the places." */
  readonly said: string;
  /** What the change does, in `diffDocuments`' sentences (a document) or the edit's own (a declaration). */
  readonly sentences: readonly string[];
  /** The edit that was made, and the one that takes it back. */
  readonly edit: AddLensEdit | RemoveLensEdit;
  readonly undo: AddLensEdit | RemoveLensEdit;
  /** The document after it, for a document app: what the host writes. */
  readonly document?: GraviewDocument;
  /** The app after it, checked. */
  readonly app: GraviewApp<S>;
  /** Its place, when it was added: in the place list from now on. */
  readonly place?: AppPlace;
}

export interface LensRefused {
  readonly ok: false;
  readonly failed: string;
  readonly findings: readonly { readonly path: string; readonly message: string }[];
}


/**
 * KEEP A DRAFT AS A LENS: the `add-lens` edit, previewed and checked. For a
 * document app, `editDocument` → `compileDocument` (graview check) →
 * `diffDocuments`, and the document to write; for an app declared in code,
 * the declaration with the lens beside its own, judged by `checkApp`, and
 * the edit to hand the host (`onKeepLens`). Either way, the `remove-lens`
 * edit that takes it back.
 */
export async function keepLens<S extends AnySchema>(holder: LensHolder<S>, edit: AddLensEdit): Promise<LensKept<S> | LensRefused> {
  return changeLenses(holder, edit, takeBackEditOf(edit));
}

/** TAKE A KEPT LENS BACK: the `remove-lens` edit, through the same checks; its undo adds it again. */
export async function takeBackLens<S extends AnySchema>(holder: LensHolder<S>, edit: RemoveLensEdit, kept?: AddLensEdit): Promise<LensKept<S> | LensRefused> {
  const lenses = "document" in holder ? (holder.document.lenses ?? []) : (holder.app.lenses ?? []);
  const was = (lenses as readonly Record<string, unknown>[]).find((lens) => lens["title"] === edit.title && (edit.on === undefined || lens["on"] === edit.on));
  const again: AddLensEdit = kept ?? (was ? lensEditOf({ name: was["name"] as ShippedLensName, title: edit.title, on: (was["on"] as string | undefined) ?? edit.on ?? "", ...(was["bindings"] ? { bindings: was["bindings"] as Record<string, unknown> } : {}), ...(was["options"] ? { options: was["options"] as Record<string, unknown> } : {}) }) : { op: "add-lens", title: edit.title, lens: "blocks", on: edit.on ?? "" });
  return changeLenses(holder, edit, again);
}

async function changeLenses<S extends AnySchema>(holder: LensHolder<S>, edit: AddLensEdit | RemoveLensEdit, undo: AddLensEdit | RemoveLensEdit): Promise<LensKept<S> | LensRefused> {

  const adding = edit.op === "add-lens";
  const said = adding ? `Adds “${edit.title}” to the places.` : `Takes “${edit.title}” out of the places.`;
  if ("document" in holder) {
    const edited = editDocument(holder.document, [edit as unknown as DocumentEdit]);
    if (!edited.ok) return refused(edited.findings);
    const compiled = compileDocument(edited.document);
    if (!compiled.ok) return refused(compiled.findings.filter((finding) => finding.severity === "error"));
    const app = compiled.app as unknown as GraviewApp<S>;
    const place = adding ? placesOf(app).find((one) => one.title === edit.title) : undefined;
    if (adding && !place) return refused([{ path: "lenses", message: `“${edit.title}” does not draw, so it would be no place` }]);
    return { ok: true, said, sentences: diffDocuments(holder.document, edited.document).sentences, edit, undo, document: edited.document, app, ...(place ? { place } : {}) };
  }
  const app = holder.app;
  const lenses = app.lenses ?? [];
  let next: readonly LensDeclaration[];
  if (adding) {
    if (lenses.some((lens) => lens.title === edit.title)) return refused([{ path: "lenses", message: `there is already a lens called “${edit.title}”` }]);
    next = [...lenses, { name: edit.lens, title: edit.title, on: edit.on, ...(edit.bindings ? { bindings: edit.bindings } : {}), ...(edit.options ? { options: edit.options } : {}) } as LensDeclaration];
  } else {
    const index = lenses.findIndex((lens) => lens.title === edit.title && (edit.on === undefined || lens.on === undefined || lens.on === edit.on));
    if (index < 0) return refused([{ path: "lenses", message: `there is no lens “${edit.title}”` }]);
    next = lenses.filter((_, at) => at !== index);
  }
  const after = { ...app, lenses: next } as GraviewApp<S>;
  const before = checkApp(app);
  const judged = checkApp(after);
  const known = new Set(before.findings.map((finding) => `${finding.code}|${finding.where}|${finding.message}`));
  const fresh = judged.findings.filter((finding) => !known.has(`${finding.code}|${finding.where}|${finding.message}`));
  const lensPath = `lenses.${next.length - 1}`;
  const wrong = fresh.filter((finding) => finding.severity === "error" || (adding && finding.severity === "warning" && (finding.where === lensPath || finding.where.startsWith(`${lensPath}.`) || finding.where.includes(`"${edit.title}"`) || finding.message.includes(`"${edit.title}"`))));
  if (wrong.length > 0) return refused(wrong.map((finding) => ({ path: finding.where, message: finding.message })));
  const place = adding ? placesOf(after).find((one) => one.title === edit.title) : undefined;
  if (adding && !place) return refused([{ path: "lenses", message: `“${edit.title}” does not draw, so it would be no place` }]);
  const where = adding ? (place?.kind ? `, over ${pluralOf(app.schema as AnySchema, place.kind)}` : "") : "";
  return { ok: true, said, sentences: [adding ? `A lens "${edit.title}" is added${where}.` : `The lens "${edit.title}" is removed.`], edit, undo, app: after, ...(place ? { place } : {}) };
}

function refused(findings: readonly { readonly path: string; readonly message: string }[]): LensRefused {
  const message = findings[0]?.message.replace(/\.$/, "") ?? "it was refused";
  return { ok: false, failed: `Couldn't keep it: ${message}.`, findings: findings.map((finding) => ({ path: finding.path, message: finding.message })) };
}
