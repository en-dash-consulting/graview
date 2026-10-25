import { localeFor, timeZoneFor, type AnySchema, type FileKind, type Principal, type Store } from "@graview/core";
import { fileFieldKind } from "./marks.js";
import type { GuestAct, GuestEdge, GuestPlace, GuestProps, GuestTheme } from "../protocol.js";
import type { GuestPictures } from "./pictures.js";
import { choicesOf, plainNode, readAcross, type GuestViewInput } from "./session.js";

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
 *   replaces     "page", for a view of one record drawn alone in place of
 *                the record's own fields (FR-149); left out, it sits above
 *                them and they stay editable. On a view of many, drawn in
 *                place of the kind's list page (FR-203); left out, the list
 *                is the app's own
 *   accepts      the fields files dropped on it go in (FR-193): each a kind
 *                and its image, video or file field — `[{ kind: "moment",
 *                field: "photo" }]` — for an element it draws marked
 *                `data-drop="<kind>"` (drop.ts)
 *   pictures     true, or { width }: each file on a record it is handed
 *                comes as a `GuestFile`, a picture with an address the
 *                host made from the bytes (FR-175, pictures.ts); and it
 *                may place a record's video (`<graview-video>`) and open
 *                the host's full-screen viewer (`data-lightbox`, media.ts)
 *   bleed        true: on a phone the pages face draws it edge to edge —
 *                the page's 20px side gutter taken back for it, the
 *                safe areas kept — and at a desk the column's width
 *   gestures     true: the host forwards a wheel, a drag and a pinch over
 *                what it listens on (`graview.on("wheel" | "drag" |
 *                "pinch", …)`), once a frame, and takes a wheel from the
 *                page only there (gestures.ts)
 *   heading      "own": a place's view that draws its own heading — its
 *                place on Pages says the title to a screen reader only,
 *                and no count over it
 *   flows        false: a fixed canvas (a map, a chart) keeps the place's
 *                frame on Pages; left out, its place flows with the page
 *   scene        { maxHeight }: the tallest its preview on the Scene is
 *                drawn, in pixels; left out, the box the Scene gives it
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
  /**
   * What a view of one record replaces (FR-149). Left out, the view is drawn
   * above the record's own fields, which stay editable: on the scene the
   * record drawn at full, on Pages the record's page. `"page"` draws the
   * view alone in their place, and the record is then changed only through
   * the view. On a view of a kind's many records (FR-203), `"page"` draws
   * it under the heading of the kind's list page (`/<plural>`) in place of
   * the list; left out, the list page is the app's own and a titled view is
   * at its own place only. Not on the home.
   */
  readonly replaces?: "page";
  /**
   * The pictures on the records it is handed (FR-175): `true`, or
   * `{ width }`, the widest it draws a picture in CSS pixels (1 200 by
   * default). Each file a record holds is then handed as a `GuestFile` —
   * a picture with `src`, an address the host made from the bytes, made
   * smaller where it is wider than `width`; a document by its name, type
   * and size — never as the host's path to it. Left out, a file is handed
   * as the record keeps it.
   */
  readonly pictures?: GuestPictures;
  /**
   * WHAT FILES DROPPED ON IT BECOME (FR-193): each a kind of the app and a
   * field of it that holds a picture, a video or a file. An element the view
   * draws with `data-drop="<kind>"` (and `data-drop-connect="<relation>:<record
   * id>"`) is then a drop target the host draws and takes files at — a tap
   * that opens the picker on a phone — storing each through the host's files
   * into the field its type fits. A view that hears `drop` is told the files;
   * one that does not gets a record of the kind per file, linked as
   * `data-drop-connect` says, all in one change.
   */
  readonly accepts?: readonly ManifestAccept[];
  /**
   * WHETHER IT TAKES GESTURES (0.1.42): `true`, and the host forwards a
   * wheel (`deltaX`, `deltaY`, `deltaMode`, `ctrlKey`, `metaKey`), a drag
   * (`pointerdown`, `pointermove`, `pointerup`) and a pinch (Safari's
   * gesture, or a trackpad's Control-wheel) over an element the view
   * listens on with `graview.on("wheel" | "drag" | "pinch", selector, …)`,
   * at most once an animation frame with the deltas coalesced. The page's
   * own scrolling and zoom are taken from it only there. Left out, a view
   * hears clicks, typing and choices, and no gesture.
   */
  readonly gestures?: boolean;
  /**
   * EDGE TO EDGE ON A PHONE: `true`, and where the pages face draws the
   * view — the home's body, a place, a record's page — on a phone (a face 680 pixels
   * wide or less), the view's box takes back the page's side gutter (20px
   * either side, `--graview-page-gutter`) and keeps the device's safe areas,
   * so it is the phone's width less those. At a desk it is the column's
   * width, as any view is. Left out, the view is drawn inside the gutter,
   * and what it draws past its box is clipped there, a negative margin
   * included.
   */
  readonly bleed?: boolean;
  /**
   * WHO SAYS ITS TITLE (Roadmap f-place-header-repeats-view-title). Left
   * out, a titled view's place on Pages says its title and how much it is
   * over above the view. `"own"` is a view that draws its own heading: the
   * place keeps its title for a screen reader and the keyboard, draws
   * neither it nor the count, and the way to the kind's list stays. Only
   * for a view that is a place.
   */
  readonly heading?: "own";
  /**
   * WHETHER ITS PLACE FLOWS WITH THE PAGE (Roadmap f-view-content-height).
   * Left out, a titled view's place on Pages is drawn in the page's column
   * as tall as the view draws — its content height, which the host measures
   * and the view never says — with no frame that scrolls inside the page.
   * `false` is a view that is a fixed canvas, a map or a chart drawn to a
   * box: its place keeps the frame a board or a calendar is drawn in.
   */
  readonly flows?: boolean;
  /**
   * HOW IT IS DRAWN ON THE SCENE (Roadmap f-view-content-height). A view of
   * a kind's members is drawn there as a card like the Scene's other
   * pictures: its title, as much of the view as fits — at most its content
   * height, at most the box the Scene gives it — faded at the foot where
   * there is more, and Open, to its place. `maxHeight` holds that preview
   * lower, in pixels (80 to 4000).
   */
  readonly scene?: { readonly maxHeight?: number };
}

/** A field files dropped on a view go in (FR-193): a kind, and its image, video or file field. */
export interface ManifestAccept {
  readonly kind: string;
  readonly field: string;
}

/** What a kind's field holds, where it holds files: a picture, a video or a file, one or a list of them. Undefined where it holds none. */
export function fileFieldOf<S extends AnySchema>(store: Store<S>, kind: string, field: string): { readonly as: FileKind; readonly list: boolean } | undefined {
  const definition = store.schema.tryDefinition(kind);
  const schema = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape?.[field];
  return schema === undefined ? undefined : fileFieldKind(schema);
}

/** What `accepts` says wrongly, in sentences; empty when it is sound. */
function acceptsProblems<S extends AnySchema>(accepts: unknown, store: Store<S>): readonly string[] {
  if (accepts === undefined) return [];
  if (!Array.isArray(accepts)) return ['The view\'s accepts is a list of { "kind": <a kind>, "field": <its image, video or file field> }.'];
  const problems: string[] = [];
  const kinds = new Set<string>(store.schema.kinds as readonly string[]);
  for (const one of accepts as unknown[]) {
    const { kind, field } = (one ?? {}) as { kind?: unknown; field?: unknown };
    if (typeof kind !== "string" || typeof field !== "string") problems.push('Each of the view\'s accepts is { "kind": <a kind>, "field": <its image, video or file field> }.');
    else if (!kinds.has(kind)) problems.push(`The view accepts files for "${kind}", which is no kind of this app.`);
    else if (!fileFieldOf(store, kind, field)) problems.push(`The view accepts files into ${kind}'s "${field}", which holds no picture, video or file.`);
    else if (!store.allMutations().some((mutation) => (mutation.creates ?? []).includes(kind) && Object.hasOwn((mutation.input as { shape?: object } | undefined)?.shape ?? {}, field))) problems.push(`No act of this app makes a "${kind}" with its "${field}", so a file dropped could become nothing.`);
  }
  return problems;
}

/** What `pictures` asks for, said wrongly, in sentences; empty when it is sound. */
function picturesProblems(pictures: unknown): readonly string[] {
  if (pictures === undefined || pictures === true) return [];
  if (typeof pictures !== "object" || pictures === null || Array.isArray(pictures)) return ['The view\'s pictures is true, or { "width": <the widest it draws a picture, in pixels> }.'];
  const { width, ...rest } = pictures as { width?: unknown };
  const problems: string[] = [];
  if (Object.keys(rest).length > 0) problems.push(`The view's pictures says ${Object.keys(rest).map((key) => `"${key}"`).join(", ")}: only "width" is read.`);
  if (width !== undefined && !(Number.isInteger(width) && (width as number) >= 16 && (width as number) <= 4_096)) problems.push("The view's pictures width is a whole number of pixels from 16 to 4096.");
  return problems;
}

/** What `scene` says wrongly, in sentences; empty when it is sound. */
function sceneProblems(scene: unknown): readonly string[] {
  if (scene === undefined) return [];
  if (typeof scene !== "object" || scene === null || Array.isArray(scene)) return ['The view\'s scene is { "maxHeight": <the tallest its preview on the Scene is drawn, in pixels> }.'];
  const { maxHeight, ...rest } = scene as { maxHeight?: unknown };
  const problems: string[] = [];
  if (Object.keys(rest).length > 0) problems.push(`The view's scene says ${Object.keys(rest).map((key) => `"${key}"`).join(", ")}: only "maxHeight" is read.`);
  if (maxHeight !== undefined && !(Number.isInteger(maxHeight) && (maxHeight as number) >= 80 && (maxHeight as number) <= 4_000)) problems.push("The view's scene maxHeight is a whole number of pixels from 80 to 4000.");
  return problems;
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
  if (manifest.replaces !== undefined && manifest.replaces !== "page") findings.push(`The view's replaces is "${String(manifest.replaces)}": the one thing a view replaces is "page", or leave it out to draw the view above the record's own fields.`);
  else if (manifest.replaces === "page" && manifest.attach === "home") findings.push('The home\'s view is the home already: replaces "page" is for a view of a kind, of one record (its page) or of many (its list).');
  if (manifest.gestures !== undefined && typeof manifest.gestures !== "boolean") findings.push(`The view's gestures is "${String(manifest.gestures)}": it is true, or left out.`);
  if (manifest.bleed !== undefined && typeof manifest.bleed !== "boolean") findings.push(`The view's bleed is "${String(manifest.bleed)}": it is true, or left out.`);
  if (manifest.heading !== undefined && (manifest.heading !== "own" || manifest.attach === "home" || manifest.cardinality !== "many" || manifest.title === undefined)) findings.push(`The view's heading is "${String(manifest.heading)}": it is "own" on a view that is a place (a title, cardinality many), or left out.`);
  if (manifest.flows !== undefined && typeof manifest.flows !== "boolean") findings.push(`The view's flows is "${String(manifest.flows)}": it is false for a view that keeps its place's frame, or left out.`);
  else if (manifest.flows === false && (manifest.attach === "home" || manifest.cardinality !== "many" || manifest.title === undefined)) findings.push("Only a view that is a place keeps a frame: flows false needs a title and cardinality many on a kind.");
  findings.push(...sceneProblems(manifest.scene));
  if (manifest.scene !== undefined && (manifest.attach === "home" || manifest.cardinality !== "many")) findings.push("Only a view of a kind's members is drawn on the Scene as a card: scene needs cardinality many on a kind.");
  findings.push(...picturesProblems(manifest.pictures));
  findings.push(...acceptsProblems(manifest.accepts, store));
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

/**
 * THE RELATIONS A VIEW USES AND IS NOT HANDED (Roadmap f-reads-edges-warning):
 * a manifest's `reads.kinds` hands a view those records, and only
 * `reads.edges` the links between them, so a view that walks a relation it
 * does not read draws every record beside nothing. Said only of a relation
 * that joins two kinds the view is handed AND that its code names, as a
 * quoted string (`"madeBy"`, `'madeBy'`, `` `madeBy` ``): a view of seasons
 * that reads games and draws no era is never told to read `eras`. A view
 * that names no relation is told of none.
 */
export function unreadEdges<S extends AnySchema>(store: Pick<Store<S>, "schema">, manifest: Pick<WorkerViewManifest, "attach" | "reads">, source: string): readonly string[] {
  const kinds = [...new Set([...(manifest.attach === "home" ? [] : [manifest.attach]), ...(manifest.reads?.kinds ?? [])])];
  if (kinds.length < 2) return [];
  const read = new Set(manifest.reads?.edges ?? []);
  const named = (edge: string) => new RegExp(`(["'\`])${edge.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`).test(source);
  return store.schema.edgeKinds.filter((name) => {
    const edge = store.schema.edge(name);
    return !read.has(name) && edge !== undefined && edge.from.some((kind) => kinds.includes(kind)) && (edge.to === "*" || edge.to.some((kind) => kinds.includes(kind))) && named(name);
  });
}

/** "\"models\" names madeBy but does not read it, so …: add \"madeBy\" to its manifest's reads.edges.", or nothing when it reads every relation it names. */
export function unreadEdgesSentence<S extends AnySchema>(store: Pick<Store<S>, "schema">, manifest: Pick<WorkerViewManifest, "name" | "attach" | "reads">, source: string): string | undefined {
  const edges = unreadEdges(store, manifest, source);
  if (edges.length === 0) return undefined;
  const joined = (words: readonly string[], last: string) => (words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} ${last} ${words[words.length - 1]}`);
  return `"${manifest.name}" names ${joined(edges, "and")} but does not read ${edges.length > 1 ? "them" : "it"}, so the view is handed no such links: add ${joined(
    edges.map((edge) => `"${edge}"`),
    "and",
  )} to its manifest's reads.edges.`;
}

export interface WorkerViewPropsInput {
  readonly manifest: WorkerViewManifest;
  /** Where the view is drawn: the record, or the members, the face hands it. */
  readonly input?: GuestViewInput;
  readonly theme?: GuestTheme;
  /** The app's named places, which the view may link to (FR-93). */
  readonly places?: readonly GuestPlace[];
  /**
   * A record's computed values, worked out over the graph it is handed —
   * the viewer's (`computedOn`, `@graview/guest/host/computed`). Apart, so
   * registering a view carries no evaluator: the host fetches it before a
   * view whose kinds have computed values starts (`readsComputed`).
   */
  readonly computed?: ComputedOn;
}

/** A record's computed values over the viewer's graph, by name; none for a kind that has none. */
export type ComputedOn = (graph: unknown, node: unknown) => Readonly<Record<string, unknown>>;

/** Whether any kind a view is handed records of has computed values: its own kind's, or one it reads. */
export function readsComputed<S extends AnySchema>(store: Store<S>, manifest: WorkerViewManifest): boolean {
  const kinds = [...(manifest.attach === "home" ? [] : [manifest.attach]), ...(manifest.reads?.kinds ?? [])];
  return kinds.some((kind) => Object.keys((store.schema.tryDefinition(kind as never) as { readonly computed?: object } | undefined)?.computed ?? {}).length > 0);
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
  /* What it reads across kinds (session.ts's `readAcross`, the frame guest's rule too): a view of many never reads more of its own kind than the face handed it. */
  const ownIds = new Set([...own, ...members].map((one) => one.id));
  const read = readAcross(graph, ownIds, { kinds: (manifest.reads?.kinds ?? []).filter((kind) => kind !== attached || manifest.cardinality === "one"), edges: manifest.reads?.edges ?? [] });
  const listed = new Map<string, unknown>();
  for (const one of [...members, ...(read.nodes as typeof members)]) if (!own.some((mine) => mine.id === one.id)) listed.set(one.id, one);
  const shown = new Set([...own.map((one) => one.id), ...listed.keys()]);
  const edges: GuestEdge[] = [...read.edges];
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
  /*
   * A RECORD'S COMPUTED VALUES, BESIDE ITS FIELDS (Roadmap f-computed-in-views):
   * what its page shows, so a view need not count again from the edges. Worked
   * out over the viewer's graph (`seenBy`), as every page works them out, so a
   * record or a field the viewer may not see adds nothing to one.
   */
  const computed = given.computed;
  const plain = (one: unknown) => (computed ? { ...plainNode(store, one), ...computed(graph, one) } : plainNode(store, one));
  return {
    view: manifest.name,
    ...(own[0] ? { node: plain(own[0]) } : {}),
    nodes: [...listed.values()].map(plain),
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
    // The locale and the clock every other surface says a day and a time in (Roadmap f-app-time-zone).
    locale: localeFor(),
    timeZone: timeZoneFor(),
    // Each option of the handed records' choices, by its label (Roadmap f-option-labels).
    ...choicesOf(store.schema, [...own, ...listed.values()]),
    // A link names a place by its slug, so each slug once: a picture over several kinds is one place to a view.
    ...(given.places ? { places: given.places.filter((place, at, all) => all.findIndex((other) => other.as === place.as) === at).map(({ as, title, kind }) => ({ as, title, kind })) } : {}),
  };
}
