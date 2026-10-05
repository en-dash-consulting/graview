import type { ArrangementWords } from "./arrange.js";
import type { InvariantDefinition } from "./invariants/types.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { Policy } from "./permissions/types.js";
import type { Brand } from "./theme/types.js";
import type { ModuleMap } from "./modules.js";
import type { GraphSnapshot } from "./graph/types.js";
import type { Primitive } from "./graph/primitives.js";
import type { AnySchema } from "./schema/schema.js";
import type { ViewRegistry } from "./views/types.js";
import type { ViewSpecsByKind } from "./document/views.js";
import type { PagesArrangement } from "./places.js";

/**
 * Everything one application declares, in one object. `graview check` and
 * the docs generator both read exactly this — an app that can be checked is
 * an app whose whole surface is declared rather than assembled at runtime.
 */
/**
 * A role bound to a node kind, an edge kind, or a field of one of the kinds
 * another role already named.
 *
 * The third form arrived with the third lens. A board binds `slots` to a kind
 * and `fill` to an edge, but `x` and `y` are FIELDS of whatever `slots` turned
 * out to be — so the binding says which role supplies the kind, and the check
 * can then verify the field actually exists on it. That is a stronger check
 * than either of the first two shapes had.
 */
export type EntityBinding =
  | { readonly kind: string }
  | { readonly edge: string }
  /**
   * A RELATIONSHIP THAT RUNS THROUGH A NODE.
   *
   * One edge kind covers the relationships that are a bare edge —
   * requirements↔deliverables, skills↔drills. It cannot express the ones
   * where the relationship IS a thing with fields of its own: a concern is
   * addressed by a practice, applied by a routine, which covers a ground.
   * "Is this concern covered on this ground?" is a two-hop question with a
   * node in the middle, and the node in the middle is not incidental — it is
   * where the cadence and the season live.
   *
   * `path` is that walk, named by edge kind, from the COLUMN end to the ROW
   * end. Each step follows an edge of that kind in either direction, because
   * an edge has two readings and which one a domain declared is not the
   * picture's business. The nodes passed through come back with the cell, so
   * pressing "mosquitoes are covered in the Back Lawn" can show WHICH
   * routine does it and when it next runs.
   *
   * Generalises well past one domain: controls↔risks through a policy,
   * tests↔behaviours through a suite, staff↔shifts through a rota line.
   * Wherever the relationship has attributes, it is a node.
   */
  | { readonly path: readonly string[] }
  | { readonly field: string; readonly on: string };

export interface LensDeclaration {
  /** Which lens: one the framework ships (`SHIPPED_LENSES`) or one this app wrote. */
  readonly name: string;
  /**
   * The roles it requires. A shipped lens knows its own, so a declaration
   * of one may leave them out (`requiredRolesOf`).
   */
  readonly requiredRoles?: readonly string[];
  /**
   * A DECLARED LENS DRAWS (FR-79). Given a title, a shipped lens is a named
   * place over the kinds it binds — a pill on the bar, a drive-in from
   * altitude, a page at `/places/<as>` — drawn by the framework from this
   * declaration alone, with no registration in the app's UI. Without one
   * it is bindings the checker holds.
   */
  readonly title?: string;
  /** The kind it is a place over, when its bindings do not say (the reach lens) or say several. */
  readonly on?: string;
  /**
   * What the lens's factory takes beyond its roles, as data — a calendar's
   * `range`, a timeline's `columns`, a coverage's `rowGroup`.
   * `SHIPPED_LENSES[name].options` lists each lens's; anything that cannot
   * be data is derived where it is drawn.
   */
  readonly options?: Readonly<Record<string, unknown>>;
  /**
   * WHERE THE REUSE WAS PROVED — for a lens this app wrote.
   *
   * "Build it against a domain it was not designed for, and if you cannot
   * write that test, say so plainly: you wrote a view" is the best
   * instruction in `graview-lens` and the one nothing can check. The checker
   * asks about every app-authored lens (`lens-authored-here`) precisely
   * because it cannot know the answer — and a question that can only ever be
   * acknowledged is one people learn to scroll past, which is what the note
   * severity exists to avoid.
   *
   * So the declaration answers it. A path to the test that builds this lens
   * in another domain quiets the note and appears in `graview describe`,
   * where a reader can go and look. It is a claim the author makes, like
   * every `description` here; what it buys is that the claim is written down
   * next to the thing it is about, rather than remembered.
   */
  readonly provenBy?: string;
  /** Defaults to `fields`, which is what every lens did before there were two. */
  readonly binds?: "fields" | "entities";
  /**
   * What the picture opens arranged by, in the arrangement grammar —
   * `{ group: "held-at", filter: "is:current" }` — so the checker can hold
   * it to the bound kind's declaration and `describe` can say it. The lens
   * options carry the same words to the picture (`arrangedBy`).
   */
  readonly arrangedBy?: ArrangementWords;
  /**
   * Per kind, each role bound to a field — `"at"` — or to a field and the
   * values that make it true — `{ field: "status", is: ["done"] }`, the
   * shape `lifecycle` reads a state in — or an entity binding.
   */
  readonly bindings?:
    | Readonly<Record<string, Readonly<Record<string, string | { readonly field: string; readonly is: readonly unknown[] }>>>>
    | Readonly<Record<string, EntityBinding>>;
}

export interface GraviewApp<S extends AnySchema = AnySchema> {
  readonly name: string;
  readonly schema: S;
  readonly mutations?: readonly AnyMutationDefinition<S>[];
  readonly invariants?: readonly InvariantDefinition<S>[];
  readonly views?: ViewRegistry<S, unknown>;
  /**
   * VIEWS AS DATA (FR-03): a card, a row and a page per kind, written as
   * blocks from a closed set rather than as components —
   *
   *   viewSpecs: { vendor: { card: [{ title: "{name}" }, { badge: "{status}", tone: "good" }] } }
   *
   * Domain tier on purpose: blocks are data, bound to fields by templates
   * and conditions in the rule language, so `graview check` holds every
   * name and tone to the schema without importing React, and a host can
   * accept them from a stranger because nothing in them runs. The
   * framework's own views draw them (`registerDefaultViews(schema,
   * registry, { specs })` in `@graview/primitives`, and the embed by
   * itself): `card` at one × summary, `row` at one × glyph, `page` above
   * the default at one × full. A document's `views` compile to this.
   */
  readonly viewSpecs?: ViewSpecsByKind;
  /**
   * Roles a lens requires an app to bind, and what it binds them to.
   *
   * Two shapes, because there turned out to be two kinds of lens. A `fields`
   * lens maps a KIND's own field names onto its roles — the timeline asks an
   * app which of its fields are `start` and `end`. An `entities` lens maps
   * roles onto whole kinds and edges — the coverage matrix asks which kind is
   * the rows, which is the columns, and which edge fills a cell.
   *
   * The first shape was assumed to be the only one until a second lens
   * existed, which is the usual way that assumption gets found.
   */
  readonly lenses?: readonly LensDeclaration[];
  /**
   * HOW THE HOME IS ARRANGED AND WHERE THE APP OPENS (FR-80): the kinds in
   * order, the kinds the home leaves off, and the place it opens on. Both
   * faces honour it — the routed face's gallery and nav, the city's order —
   * and `graview check` names a kind or place it cannot find.
   */
  readonly pages?: PagesArrangement;
  /**
   * Who may run what. Declared on the app so `graview check` can read it —
   * a mutation no role can ever run and a role that may do nothing are both
   * mistakes in the declaration, findable before anyone meets a button they
   * cannot press.
   */
  readonly policy?: Policy;
  /**
   * The name, the palette and the typography this installation wears.
   *
   * Declared so `graview check` can verify it: a custom palette can be wrong
   * in ways nobody notices — a secondary colour that clears 4.5:1 on a dark
   * ground and fails badly on paper — and contrast is a property the
   * framework can measure rather than trust.
   */
  readonly brand?: Brand;
  /**
   * Named parts of the declaration a workspace can turn on and off.
   *
   * Declared on the app so `graview check` can hold the boundaries: a
   * module naming a kind nobody declared, a requirement naming a module
   * nobody wrote, or an always-on kind whose edge reaches into a module —
   * a line that would dangle the moment someone turns that module off.
   */
  readonly modules?: ModuleMap;
  /**
   * The intelligence this installation runs on, declared.
   *
   * Three kinds share one seam: `graph` (structural derivations, no model),
   * `llm` (a model behind one completion function), `external` (someone
   * else's agent over the derived tool surface). `may` narrows a provider
   * to named mutations — the allowlist `graview check` can verify and a
   * hosted deployment can meter. "Add AI" is an entry here, never a second
   * path to the store.
   */
  readonly intelligence?: readonly IntelligenceProviderDeclaration[];
  /**
   * The declaration's data-schema version, and the migrations that carry a
   * stored graph forward through it.
   *
   * OP-LOG-NATIVE on purpose: a migration answers with primitives — the
   * same vocabulary every other change speaks — so applying one is itself
   * logged, attributed, and invertible (a patch carries its before). The
   * `ship` engine runs them; `graview check` verifies the chain reaches
   * this version with no gaps, because a migration discovered missing at
   * deploy time is the most expensive place to discover it.
   */
  readonly version?: number;
  readonly migrations?: readonly MigrationDeclaration[];
  /**
   * Settings that belong to the READER rather than to the installation.
   *
   * Text size, motion, anything else a person sets for themselves and keeps
   * in their own browser. Declared here for the same reason everything else
   * is: the profile pane draws exactly what the app declares, so adding a
   * setting is a line in the declaration rather than a control somebody
   * wires into a shell — and `graview check` can refuse one nothing could
   * ever honour, which is a control that does nothing.
   */
  readonly settings?: readonly SettingDeclaration[];
}

/**
 * One thing a reader may set for themselves.
 *
 * `honoured` is a CLOSED SET, and that is the point of declaring settings
 * at all: the shell knows two ways to carry a person's answer to every
 * surface at once, and a setting that names neither is a control nobody
 * could act on. The checker says so before anybody meets it.
 *
 *   "root-font-size"  — a CSS length set on <html>. Every surface the
 *                       framework draws is sized in `rem`, so one answer
 *                       resizes the whole app, the routed face included,
 *                       without a single component hearing about it.
 *   "root-attribute"  — `data-graview-<name>` on <html>, for the theme's
 *                       own CSS (and an app's) to read. How motion is
 *                       carried: the stylesheet already honours the
 *                       system's preference; this lets a person override it.
 */
export interface SettingDeclaration {
  /** Kebab-case, unique in the app; becomes the storage key and the attribute. */
  readonly name: string;
  /** What a person is choosing, in their words. */
  readonly title: string;
  readonly description?: string;
  readonly honoured: "root-font-size" | "root-attribute";
  /** The answers, in order. At least two — one choice is not a setting. */
  readonly options: readonly { readonly value: string; readonly label: string }[];
  /** Where a reader who has never chosen starts. Must be one of the options. */
  readonly initial: string;
}

export interface MigrationDeclaration {
  readonly from: number;
  readonly to: number;
  readonly title: string;
  /** Primitives that carry a `from`-shaped stored graph to `to`. */
  readonly apply: (snapshot: GraphSnapshot) => readonly Primitive[];
}

/**
 * THE FOUR DOORS a browser app has to a model.
 *
 *   "paste"  — a prompt to copy out and an answer to paste back. Works
 *              everywhere, needs nothing, and is the floor every provider
 *              should keep: a person with a model open in another tab.
 *   "mcp"    — an assistant already holding the tool surface reaches in.
 *   "key"    — the person's own key, typed into this browser. Whoever
 *              declares this owes an answer about where the key lives.
 *   "local"  — a process on this machine, spawned by the dev server and
 *              called from the page. Free, private, and only ever there
 *              while somebody is running the app from a terminal.
 */
export type IntelligenceReach = "paste" | "mcp" | "key" | "local";

/**
 * WHAT KIND OF THING ANSWERS.
 *
 *   "graph"    — the declaration itself: starter data and the repairs an
 *                invariant already named. Keyless, always there.
 *   "llm"      — a model reached through one completion function. Prose in,
 *                prose out, proposals read out of the prose.
 *   "external" — somebody's own agent, arriving over the derived tool
 *                surface with its own model behind it.
 *   "decision" — a model that answers TYPED questions and nothing else: a
 *                Choice over named options, a Score over an ordered rubric,
 *                a truth with a confidence. It writes no prose and cannot
 *                propose an arbitrary call, so a chat seat must not offer
 *                it, a field that wants filling should, and the checker
 *                refuses it an act whose arguments it could not decide.
 */
export type IntelligenceKind = "graph" | "llm" | "external" | "decision";

/** What a provider of some kind can be asked for. */
export type IntelligenceCapability = "prose" | "decide" | "propose";

/**
 * The capabilities each kind serves, derived from the kind alone — so a
 * surface asks whether a provider CAN before it offers one, rather than
 * remembering which names talk.
 */
export function providerCan(
  provider: { readonly kind: IntelligenceKind },
  capability: IntelligenceCapability,
): boolean {
  return capabilitiesOf(provider.kind).includes(capability);
}

/**
 * THE LADDER HAS TWO AXES, and this is the table that keeps a switch from
 * lying about it. Prose is one axis — a Responder answers in it, and a
 * decision provider has none. A decision is the other — which surface is
 * this, does this practice address that concern — and it can be answered
 * by the graph's own rules, by a decision provider exactly, or by a model
 * with the whole parse-and-refuse layer behind it. A kind declares which
 * it serves; a surface asks for a capability, never for a kind; and what a
 * kind cannot serve falls down to the graph, which is keyless and always
 * there.
 */
export function capabilitiesOf(kind: IntelligenceKind): readonly IntelligenceCapability[] {
  switch (kind) {
    case "graph":
      return ["decide", "propose"];
    case "decision":
      return ["decide"];
    case "llm":
    case "external":
      return ["prose", "decide", "propose"];
    default:
      return [];
  }
}

/** What a capability is for, in a reader's words. */
export function describeCapability(capability: IntelligenceCapability): string {
  switch (capability) {
    case "prose":
      return "talks — answers in sentences";
    case "decide":
      return "decides — answers a typed question with a confidence";
    case "propose":
      return "proposes — offers calls to declared acts";
    default:
      return capability;
  }
}

export interface IntelligenceProviderDeclaration {
  readonly name: string;
  readonly kind: IntelligenceKind;
  readonly description?: string;
  /** Mutation names this provider may propose or call. Absent means all. */
  readonly may?: readonly string[];
  /**
   * How words and photographs actually REACH this provider.
   *
   * A provider could be named and bounded and not reached: the declaration
   * said what a model may do and nothing about how a person's photograph
   * gets to it, so nothing derived from it could say either — a seat could
   * not offer "send from here" or "copy the prompt" according to what was
   * declared, the checker could not ask a keyed provider where its key
   * lives, and the docs could not list the doors. Absent means the provider
   * says nothing about its doors, which is what every app said until now.
   */
  readonly reach?: readonly IntelligenceReach[];
  /**
   * Where a `local` reach answers: the dev-server path the bridge serves.
   *
   * Named here so the same string is the checker's evidence that a local
   * reach was actually wired, and the path `useLocalIntelligence()` probes.
   */
  readonly bridge?: string;
  /** Where a `key` reach keeps the key, in the app's own words. */
  readonly keyStorage?: string;
}

export function defineApp<S extends AnySchema>(app: GraviewApp<S>): GraviewApp<S> {
  return app;
}
