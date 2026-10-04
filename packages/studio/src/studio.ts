import { checkApp, Store, type AnySchema, type Batch, type CheckResult, type GraphSnapshot, type GraviewApp, type MigrationDeclaration, type MutationCall, type Principal } from "@graview/core";
import { compileDocument, documentOf, toDocument, warning, type CompiledDocument, type RefusedDocument, type DocumentEdit, type EditOutcome, type Fill, type Finding, type GraviewDocument } from "@graview/core/document";
import { resolveProposal } from "@graview/tools";
import { documentAfter, documentEdits } from "./edits.js";
import { declarationToGraph } from "./from-declaration.js";
import { sourceChanges, type SourceChanges } from "./changes.js";
import { migrationBetween } from "./migration.js";
import { studioApp, type StudioSchema } from "./meta.js";
import { declarationFiles, type SourceOptions, type WrittenFile } from "./source.js";
import { graphToDeclaration } from "./to-declaration.js";

/*
 * A STUDIO OVER ONE APP. The app's declaration is read into a store of the
 * meta-schema; the ordinary acts change it; the checker judges what it
 * would become; applying hands back the new app and the migration a stored
 * graph would need; the files are what `graview create` writes. An agent
 * seat proposes by acting — its batches are the proposals — and a person
 * accepts by applying or declines by undoing, the same way any turn of an
 * agent's is kept or taken back.
 */

export interface Studio<S extends AnySchema = AnySchema> {
  /** The store the interface edits: the declaration as a graph. */
  readonly store: Store<StudioSchema>;
  /** The app the studio opened on. */
  readonly base: GraviewApp<S>;
  /** The declaration as it now stands, runnable and checkable. */
  declaration(): GraviewApp<AnySchema>;
  /** What `graview check` says about the declaration as it now stands. */
  check(): CheckResult;
  /** Batches applied since the studio opened — every change, with its author and intent. */
  changes(): readonly Batch[];
  /** The changes an agent seat made and nobody has taken back. */
  proposals(): readonly Batch[];
  /** An agent's proposed change: applied under its seat, in a batch of its own, so a person can keep or take it back. */
  propose(call: MutationCall, agent: Principal, intent?: string): { readonly batch: string; readonly ok: true } | { readonly ok: false; readonly reason: string };
  /** Take a proposal back. */
  decline(batch: string): boolean;
  /**
   * WHAT THE CHECKER WOULD SAY IF THIS CALL WERE MADE — without making it.
   *
   * A proposal a person is shown has to be judged BEFORE they are asked to
   * keep it: a change that would fail the build is not a choice, it is a
   * trap. The call is applied to a copy of the store and the copy's
   * declaration is checked, so the real declaration is untouched whatever
   * the answer is — and a call the store itself refuses comes back as a
   * refusal in the store's own words rather than as a thrown error.
   */
  would(call: MutationCall | readonly MutationCall[]): { readonly ok: true; readonly check: CheckResult } | { readonly ok: false; readonly reason: string };
  /**
   * The new app and, where a stored graph needs one, the migration to it. Refused while the checker finds errors.
   *
   * Opened on an app compiled from a document, it also hands back the
   * document (FR-54): the one it opened on with `edits()` applied, which a
   * host compiles and keeps in place of `app`. When a change cannot be
   * said as a document, `documentFindings` says why, one sentence each.
   */
  apply(): StudioApplyResult | { readonly ok: false; readonly check: CheckResult };
  /**
   * WHAT CHANGED, AS editDocument's OWN OPS (FR-54). Applied to the
   * document the app was compiled from, they make the document `apply`
   * hands back; a host that keeps documents stores these, or the document.
   * Empty when nothing changed. A change no op can say is not among them:
   * `document()` names it.
   */
  edits(): readonly DocumentEdit[];
  /**
   * The document the studio's changes make — the one it opened on, with
   * `edits()` applied and everything the graph did not touch kept as it
   * was written — or the findings that say why there is none. Undefined
   * when the studio knows no document for its app: `whyNoDocument()`
   * says why.
   */
  document(): EditOutcome | undefined;
  /**
   * WHY `document()` IS UNDEFINED, in one finding (`studio-no-document`):
   * the studio was opened on a TypeScript app, or on an app that is not
   * the object `compileDocument` returned — a copy, or one with its policy
   * swapped — and no document was said with `createStudio(app, { document })`.
   * Undefined when the studio has a document. `apply()` hands it back as
   * `documentFindings`.
   */
  whyNoDocument(): Finding | undefined;
  /** The declaration as the files `graview create` writes. */
  files(options?: SourceOptions): readonly WrittenFile[];
  /** What changed since the studio opened, as edits the checkout's own source can take — and what cannot be written that way yet. */
  sourceChanges(): SourceChanges;
}

export interface StudioApplyResult {
  readonly ok: true;
  readonly app: GraviewApp<AnySchema>;
  readonly migration: MigrationDeclaration | null;
  /**
   * The document the change makes, when the studio was opened on one and
   * every change could be said (FR-54). `app` is then the app this
   * document compiles to, remembered as compiled from it, so
   * `toDocument(app)` gives this document back; its version is the
   * document's, and a stored graph's move is planned from `fills` (or
   * `migration`), which the app does not carry.
   */
  readonly document?: GraviewDocument;
  /** The edits that made it, in order. */
  readonly edits?: readonly DocumentEdit[];
  /** What each edit did, in words. */
  readonly said?: readonly string[];
  /** Values the edits give records already there, for the migration planner. */
  readonly fills?: readonly Fill[];
  /** Why no document came back: the change could not be said or compiled as a document, or the studio knows no document for its app (`studio-no-document`). */
  readonly documentFindings?: readonly Finding[];
}

export interface StudioOptions {
  readonly name?: string;
  readonly principal?: Principal;
  /**
   * The document the app was compiled from, said outright (FR-54). Without
   * it the studio knows the document only for the very object
   * `compileDocument` returned; a host that copies that app, or swaps its
   * policy for the signed-in seat's, says the document here.
   */
  readonly document?: GraviewDocument;
}

export function createStudio<S extends AnySchema>(base: GraviewApp<S>, options: StudioOptions = {}): Studio<S> {
  const app = studioApp(options.name ?? `${base.name} studio`);
  const seed = declarationToGraph(base) as GraphSnapshot;
  const store = new Store<StudioSchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    snapshot: seed as never,
    ...(options.principal ? { principal: options.principal } : {}),
  });
  const since = store.batches().length;
  const declaration = () => graphToDeclaration(store.snapshot() as GraphSnapshot, { base: base, name: base.name });
  const isAgent = (batch: Batch) => batch.author.kind === "agent";
  // The document the app was compiled from, if it was; the edits are read against it, or against what toDocument can say of a TypeScript app.
  const opened = options.document ?? documentOf(base);
  const noDocument: Finding | undefined = opened
    ? undefined
    : warning(
        "studio-no-document",
        "document",
        `no document is known for ${base.name}: the studio was opened on a TypeScript app, or on an app that is not the object compileDocument returned (a copy, or one with its policy swapped), so it can hand back the app but not a document`,
        "if the app was compiled from a document, say it: createStudio(app, { document })",
      );
  let against: GraviewDocument | undefined;
  const reference = () => opened ?? (against ??= toDocument(base).document);
  const made = () => documentEdits(reference(), seed, store.snapshot() as GraphSnapshot);
  const document = (): EditOutcome | undefined => (opened ? documentAfter(opened, made()) : undefined);
  /*
   * ONE JUDGE, AND FOR A DOCUMENT IT IS THE DOCUMENT'S. The studio's own
   * TypeScript reading of a document does not carry a removal into the acts
   * the way editDocument does — removing a relation left the acts that
   * connect it claiming an edge nobody declares — so the checker refused
   * changes whose document compiled clean. Opened on a document, a graph
   * is judged by compiling the document its changes make; `check`,
   * `would` and `apply` all ask here, so the verdict the studio shows, the
   * one an agent's proposal is judged by and the one Apply keeps agree.
   * A change no edit can say has no document to compile: it is judged as
   * the studio's reading, as a TypeScript app is.
   */
  const judge = (graph: GraphSnapshot): { readonly check: CheckResult; readonly compiled?: CompiledDocument | RefusedDocument; readonly said?: EditOutcome } => {
    if (opened) {
      const said = documentAfter(opened, documentEdits(opened, seed, graph));
      if (said.ok) {
        const compiled = compileDocument(said.document);
        return { check: verdictOf(base.name, compiled.findings), compiled, said };
      }
      return { check: checkApp(graphToDeclaration(graph, { base: base, name: base.name })), said };
    }
    return { check: checkApp(graphToDeclaration(graph, { base: base, name: base.name })) };
  };
  let proposed = 0;
  return {
    store,
    base,
    declaration,
    check: () => judge(store.snapshot() as GraphSnapshot).check,
    changes: () => store.batches().slice(since),
    proposals: () => store.batches().slice(since).filter((batch) => isAgent(batch) && !batch.undone),
    propose(call, agent, intent) {
      const batch = `proposal:${++proposed}`;
      try {
        store.apply(call, { author: agent, batch, intent: intent ?? `Proposed: ${call.name}` });
        return { ok: true, batch };
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }
    },
    decline(batch) {
      if (!store.canUndo(batch).ok) return false;
      store.undo(batch);
      return true;
    },
    would(call) {
      const trial = new Store<StudioSchema>({
        schema: app.schema,
        mutations: app.mutations ?? [],
        invariants: app.invariants ?? [],
        snapshot: store.snapshot(),
        ...(options.principal ? { principal: options.principal } : {}),
      });
      /*
       * SEVERAL CALLS ARE JUDGED AS WHAT THEY MAKE TOGETHER. "Remove the
       * edge from the plot, add it to the planting" breaks the build after
       * its first half and is whole after its second — so a set is applied
       * to the copy in order and only the end is checked.
       */
      try {
        for (const one of Array.isArray(call) ? call : [call as MutationCall]) {
          // A name that means a node made earlier in the set is read once that node exists.
          const resolved = resolveProposal(trial, { mutation: one.name, args: one.args });
          trial.apply({ name: one.name, args: { ...resolved.args } }, { intent: `Would: ${one.name}` });
        }
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }
      return { ok: true, check: judge(trial.snapshot() as GraphSnapshot).check };
    },
    apply() {
      const graph = store.snapshot() as GraphSnapshot;
      const judged = judge(graph);
      if (judged.check.errors > 0) return { ok: false, check: judged.check };
      const migration = migrationBetween(base, graph);
      /*
       * THE DOCUMENT'S APP, NOT THE STUDIO'S READING. Handed the document
       * and the studio's TypeScript reading beside it, a host that kept the
       * app and read it back got acts as code (`act-is-code`) — the
       * document it had just been given, lost. The app is the one the
       * document compiles to, which the compiler remembers as compiled
       * from it, so `toDocument(apply().app)` is `apply().document`.
       */
      if (judged.compiled?.ok && judged.said?.ok) {
        return { ok: true, app: judged.compiled.app, migration, document: judged.compiled.document, edits: made().edits, said: judged.said.said, fills: judged.said.fills };
      }
      const next = declaration();
      const version = migration ? migration.to : base.version;
      const app: GraviewApp<AnySchema> = {
        ...next,
        ...(version !== undefined ? { version } : {}),
        ...(migration ? { migrations: [...(base.migrations ?? []), migration] } : {}),
      };
      if (judged.said && !judged.said.ok) return { ok: true, app, migration, documentFindings: judged.said.findings };
      return { ok: true, app, migration, ...(noDocument ? { documentFindings: [noDocument] } : {}) };
    },
    files: (sourceOptions) =>
      declarationFiles(store.snapshot() as GraphSnapshot, { name: base.name, base: base, ...sourceOptions }),
    edits: () => made().edits,
    document,
    whyNoDocument: () => noDocument,
    sourceChanges: () => sourceChanges(seed, store.snapshot() as GraphSnapshot, base),
  };
}

/** What compiling a document says, as the checker's verdict: the same findings, at the document's paths, under the checker's own codes. */
function verdictOf(app: string, findings: readonly Finding[]): CheckResult {
  const said = findings.map((finding) => ({
    severity: finding.severity,
    code: finding.code.replace(/^check:/, ""),
    where: finding.path,
    message: finding.message,
    fix: finding.fix ?? "",
  }));
  const count = (severity: Finding["severity"]) => said.filter((finding) => finding.severity === severity).length;
  const errors = count("error");
  return { app, findings: said, errors, warnings: count("warning"), notes: count("note"), ok: errors === 0 };
}
