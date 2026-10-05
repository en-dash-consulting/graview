import type { AnySchema, Principal, Store } from "@graview/core";
import type { GuestAct, GuestEdge, GuestPlace, GuestProps, GuestTheme } from "../protocol.js";
import { plainNode, type GuestViewInput } from "./session.js";

/*
 * A WORKER VIEW IS A PLACE, WITH A MANIFEST THE HOST ENFORCES (FR-91).
 *
 * A view says once what it is and what it may touch:
 *
 *   name         what the rail says an act came through: `via: "view:<name>"`
 *   title        given one, the view is a named place on both faces
 *   attach       the kind it is a picture of, or "home": the front page's body
 *   cardinality  one record, or the kind's members
 *   reads        the other kinds and the edges it is shown, beyond its own kind
 *   acts         the acts it may ask for (FR-92 says when one applies)
 *
 * What it is handed is the viewer's sight — never more — cut down to the
 * kind it is attached to and what it reads. A record the viewer may not see
 * is in none of it, as a node, an edge or an id; a kind or an edge it did
 * not say it reads is not handed to it however visible it is.
 *
 * Pure: no DOM. A host judges a manifest and builds what a view is handed
 * anywhere a script runs, a headless check included.
 */

/** An act a view may ask for, with what the host fills in for it (FR-92). */
export interface ManifestAct {
  /** The act, by its declared name. */
  readonly act: string;
  /** What the view calls it, in `data-act`: another name for the same act with other constants. The act's own name by default. */
  readonly as?: string;
  /** Arguments the manifest fixes: the view cannot change them. */
  readonly constants?: Readonly<Record<string, string | number | boolean | null>>;
  /** The argument a pressed element's bound record (`data-record`) goes in. The act's subject argument by default. */
  readonly record?: string;
}

export interface WorkerViewManifest {
  readonly name: string;
  readonly title?: string;
  readonly attach: string;
  readonly cardinality: "one" | "many";
  readonly reads?: { readonly kinds?: readonly string[]; readonly edges?: readonly string[] };
  readonly acts?: readonly (string | ManifestAct)[];
}

/** An act of a manifest, said in full. */
export function manifestActs(manifest: WorkerViewManifest): readonly ManifestAct[] {
  return (manifest.acts ?? []).map((one) => (typeof one === "string" ? { act: one } : one));
}

/**
 * WHAT IS WRONG WITH A MANIFEST, in sentences: a kind, an edge or an act the
 * app does not declare, a name that is not a name. Empty when it is sound.
 * A host refuses to mount a view whose manifest says anything here.
 */
export function checkManifest<S extends AnySchema>(manifest: WorkerViewManifest, store: Store<S>): readonly string[] {
  const findings: string[] = [];
  const kinds = new Set<string>(store.schema.kinds as readonly string[]);
  const edges = new Set<string>(store.schema.edgeKinds);
  const acts = new Set(store.allMutations().map((mutation) => mutation.name));
  if (typeof manifest.name !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(manifest.name)) findings.push(`The view's name "${String(manifest.name)}" is not lower-case letters, digits and hyphens.`);
  if (manifest.title !== undefined && (typeof manifest.title !== "string" || manifest.title.trim() === "" || manifest.title.length > 80)) findings.push("The view's title is empty or longer than 80 characters.");
  if (manifest.attach !== "home" && !kinds.has(manifest.attach)) findings.push(`The view attaches to "${manifest.attach}", which is no kind of this app.`);
  if (manifest.cardinality !== "one" && manifest.cardinality !== "many") findings.push(`The view's cardinality is "${String(manifest.cardinality)}", not one or many.`);
  if (manifest.attach === "home" && manifest.cardinality !== "many") findings.push("A view of the home draws many records: its cardinality is many.");
  for (const kind of manifest.reads?.kinds ?? []) if (!kinds.has(kind)) findings.push(`The view reads "${kind}", which is no kind of this app.`);
  for (const edge of manifest.reads?.edges ?? []) if (!edges.has(edge)) findings.push(`The view reads the edge "${edge}", which no kind of this app declares.`);
  const named = new Set<string>();
  for (const one of manifestActs(manifest)) {
    if (!acts.has(one.act)) findings.push(`The view asks for the act "${one.act}", which this app does not declare.`);
    const as = one.as ?? one.act;
    if (named.has(as)) findings.push(`Two of the view's acts are called "${as}".`);
    named.add(as);
  }
  return findings;
}

export interface WorkerViewPropsInput {
  readonly manifest: WorkerViewManifest;
  /** Where the view is drawn: the record, or the members, the face hands it. */
  readonly input?: GuestViewInput;
  readonly theme?: GuestTheme;
  /** The app's named places, which the view may link to (FR-93). */
  readonly places?: readonly GuestPlace[];
}

/**
 * WHAT A WORKER VIEW IS HANDED: the viewer's sight, limited to its manifest.
 * For a kind, the record (`one`) or the members (`many`; every member the
 * viewer sees when the face names none); for the home, nothing of its own.
 * Then every record of the kinds it reads, and the edges of the kinds it
 * reads among all of those — every one read through `seenBy(principal)`.
 */
export function workerViewProps<S extends AnySchema>(store: Store<S>, principal: Principal, given: WorkerViewPropsInput): GuestProps {
  const { manifest } = given;
  const input = given.input ?? {};
  const seen = store.seenBy(principal);
  const graph = seen.graph;
  const attached = manifest.attach === "home" ? undefined : manifest.attach;
  const node = attached && manifest.cardinality === "one" && input.node ? graph.getNode(input.node.id) : undefined;
  const own = node && node.kind === attached ? [node] : [];
  const members =
    attached && manifest.cardinality === "many"
      ? input.nodes
        ? input.nodes.flatMap((member) => {
            const found = graph.getNode(member.id);
            return found && found.kind === attached ? [found] : [];
          })
        : graph.nodesOfKind(attached as never)
      : [];
  const read = (manifest.reads?.kinds ?? []).filter((kind) => kind !== attached || manifest.cardinality === "one").flatMap((kind) => graph.nodesOfKind(kind as never));
  const listed = new Map<string, unknown>();
  for (const one of [...members, ...read]) if (!own.some((mine) => mine.id === one.id)) listed.set(one.id, one);
  const shown = new Set([...own.map((one) => one.id), ...listed.keys()]);
  const edgeKinds = new Set(manifest.reads?.edges ?? []);
  const edges: GuestEdge[] = [];
  for (const id of shown) {
    for (const edge of graph.outEdges(id)) {
      if (edgeKinds.has(edge.kind) && shown.has(edge.to)) edges.push({ kind: edge.kind, from: edge.from, to: edge.to });
    }
  }
  const declared = new Set(manifestActs(manifest).map((one) => one.act));
  const acts: GuestAct[] = store
    .permittedMutations(principal)
    .filter((mutation) => declared.has(mutation.name))
    .map((mutation) => ({
      name: mutation.name,
      title: mutation.title ?? mutation.name,
      ...(mutation.description !== undefined ? { description: mutation.description } : {}),
      ...(mutation.subject ? { subject: { kinds: mutation.subject.kinds as readonly string[] | "*", arg: mutation.subject.arg } } : {}),
    }));
  const visible = (ids: readonly string[] | undefined) => ids?.filter((id) => shown.has(id));
  return {
    view: manifest.name,
    ...(own[0] ? { node: plainNode(store, own[0]) } : {}),
    nodes: [...listed.values()].map((one) => plainNode(store, one)),
    edges,
    ...(manifest.title !== undefined ? { label: manifest.title } : input.label !== undefined ? { label: input.label } : {}),
    cardinality: manifest.cardinality,
    ...(input.fidelity !== undefined ? { fidelity: input.fidelity } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.selected !== undefined ? { selected: input.selected } : {}),
    ...(input.implicated ? { implicated: visible(input.implicated) } : {}),
    ...(input.flagged ? { flagged: visible(input.flagged) } : {}),
    acts,
    ...(given.theme ? { theme: given.theme } : {}),
    ...(given.places ? { places: given.places.map(({ as, title, kind }) => ({ as, title, kind })) } : {}),
  };
}
