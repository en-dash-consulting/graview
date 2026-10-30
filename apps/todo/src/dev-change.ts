import { createSchema, Store, type AnyNodeDefinition, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { composeAppChange } from "@graview/core/compose";
import { rememberDocument, toDocument, type GraviewDocument } from "@graview/core/document";
import type { ComposeChangeHost, ProposeChangeHost } from "@graview/tools/reshape";

/**
 * YES CHANGES THE APP, IN DEVELOPMENT (Roadmap f-menu-type-anything): a host
 * for `pnpm dev` — never a build, never a harness — that lends the quick
 * ask's plan its composer (`composeChange`) and applies the plan
 * (`onProposeChange`) to this running app.
 *
 * The app is declared in code, so its declaration is read as a document
 * once (`toDocument`) and held in memory, and a plan's traits are composed
 * onto it and judged by the checker (`composeAppChange`). What the change
 * adds — new kinds, new links on the kinds it has, the acts and rules the
 * traits bring — is laid over the code app itself, so every act and view it
 * had stays; a new store is made over the same records, the plan's records
 * are applied in it as one change, and the page swaps app and store in
 * place (`swap`), the frame and the card that asked kept. One undo puts the
 * app and the records back as they stood. Nothing is written to the
 * checkout: the change is kept until this page reloads, and the card says
 * so.
 */
export interface DevApp {
  readonly app: GraviewApp<AnySchema>;
  readonly store: Store<AnySchema>;
}

export interface DevAppChanges {
  readonly composeChange: ComposeChangeHost;
  readonly onProposeChange: ProposeChangeHost;
  /** The app and the store the page shows now. */
  current(): DevApp;
}

/** What the change adds, laid over the code app: its kinds, its new links, its new acts and rules. */
function laidOver(code: GraviewApp<AnySchema>, compiled: GraviewApp<AnySchema>): GraviewApp<AnySchema> {
  const kinds = new Set<string>(code.schema.kinds);
  const extended = code.schema.definitions.map((definition) => {
    const changed = compiled.schema.tryDefinition(definition.kind) as AnyNodeDefinition | undefined;
    const had = (definition.edges ?? {}) as Record<string, unknown>;
    const added = Object.fromEntries(Object.entries((changed?.edges ?? {}) as Record<string, unknown>).filter(([name]) => !(name in had)));
    return Object.keys(added).length > 0 ? ({ ...definition, edges: { ...had, ...added } } as AnyNodeDefinition) : definition;
  });
  const fresh = compiled.schema.definitions.filter((definition) => !kinds.has(definition.kind));
  const schema = createSchema([...extended, ...fresh] as readonly AnyNodeDefinition[]);
  const named = new Set((code.mutations ?? []).map((mutation) => mutation.name));
  const ruled = new Set((code.invariants ?? []).map((invariant) => invariant.name));
  /* Who may run what it adds, and who sees a kind it adds: the change's own grants and sight, over the code app's. */
  const added = new Set((compiled.mutations ?? []).map((mutation) => mutation.name).filter((name) => !named.has(name)));
  const grants = (compiled.policy?.grants ?? []).flatMap((grant) => {
    if (!Array.isArray(grant.mutations)) return [];
    const mutations = (grant.mutations as readonly string[]).filter((name) => added.has(name));
    return mutations.length > 0 ? [{ ...grant, mutations }] : [];
  });
  const sees = ((compiled.policy as { readonly sees?: readonly { readonly kinds?: readonly string[] }[] } | undefined)?.sees ?? []).filter((one) => (one.kinds ?? []).some((kind) => !kinds.has(kind)));
  const policy = code.policy
    ? { ...code.policy, grants: [...code.policy.grants, ...grants], ...(sees.length > 0 ? { sees: [...((code.policy as { readonly sees?: readonly unknown[] }).sees ?? []), ...sees] } : {}) }
    : code.policy;
  return {
    ...code,
    ...(policy ? { policy } : {}),
    schema,
    mutations: [...(code.mutations ?? []), ...(compiled.mutations ?? []).filter((mutation) => !named.has(mutation.name))],
    invariants: [...(code.invariants ?? []), ...(compiled.invariants ?? []).filter((invariant) => !ruled.has(invariant.name))],
  } as GraviewApp<AnySchema>;
}

/**
 * The dev host over `start`: `swap` puts an app and its store on the page in
 * place; the records are applied as `principal`. A changed app's store is
 * made as the app says — its policy and modules with its schema, acts and
 * rules — over the records the page holds.
 */
export function devAppChanges(start: DevApp, swap: (next: DevApp) => void, options: { readonly principal?: Principal } = {}): DevAppChanges {
  let current = start;
  const documents = new WeakMap<object, GraviewDocument>();
  const documentOfCode = (app: GraviewApp<AnySchema>): GraviewDocument => {
    let document = documents.get(app);
    if (!document) {
      document = toDocument(app as never).document;
      documents.set(app, document);
      // So the quick ask's plan finds it (`documentOfApp`), as it finds a compiled app's.
      rememberDocument(app, document);
    }
    return document;
  };
  documentOfCode(start.app);

  const composeChange: ComposeChangeHost = (change) => {
    const composed = composeAppChange(change);
    if (!composed.ok) return composed;
    return { ok: true, document: composed.document, app: laidOver(current.app, composed.app), said: composed.said };
  };

  const onProposeChange: ProposeChangeHost = (proposal) => {
    const before = current;
    const document = documentOfCode(before.app);
    // The plan's edits — the least the ask needs — or a reshape's traits.
    const composed = composeAppChange(proposal.edits ? { document, edits: proposal.edits } : { document, add: proposal.add, drop: proposal.drop });
    if (!composed.ok) return "declined";
    const app = laidOver(before.app, composed.app);
    rememberDocument(app, composed.document);
    documents.set(app, composed.document);
    const modules = (app as { readonly modules?: unknown }).modules;
    const store = new Store<AnySchema>({
      ...(app.policy ? { policy: app.policy } : {}),
      ...(modules ? { modules } : {}),
      schema: app.schema,
      mutations: app.mutations ?? [],
      invariants: app.invariants ?? [],
      snapshot: before.store.graph.snapshot() as never,
    } as never);
    // The plan's records, as one change, said as the AI's.
    if (proposal.records && proposal.records.length > 0) store.applyAll(proposal.records, { ...(options.principal ? { author: options.principal } : {}), ...(proposal.via ? { via: proposal.via as never } : {}) });
    current = { app, store };
    swap(current);
    return {
      applied: true,
      note: "Kept until this page reloads: the app's code is not changed.",
      undo: () => {
        current = before;
        swap(before);
      },
    };
  };
  return { composeChange, onProposeChange, current: () => current };
}
