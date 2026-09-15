import type { InvariantDefinition } from "./invariants/types.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { Policy } from "./permissions/types.js";
import type { Brand } from "./theme/types.js";
import type { ModuleMap } from "./modules.js";
import type { GraphSnapshot } from "./graph/types.js";
import type { Primitive } from "./graph/primitives.js";
import type { AnySchema } from "./schema/schema.js";
import type { ViewRegistry } from "./views/types.js";

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
  | { readonly field: string; readonly on: string };

export interface LensDeclaration {
  readonly name: string;
  readonly requiredRoles: readonly string[];
  /** Defaults to `fields`, which is what every lens did before there were two. */
  readonly binds?: "fields" | "entities";
  readonly bindings?:
    | Readonly<Record<string, Readonly<Record<string, string>>>>
    | Readonly<Record<string, EntityBinding>>;
}

export interface GraviewApp<S extends AnySchema = AnySchema> {
  readonly name: string;
  readonly schema: S;
  readonly mutations?: readonly AnyMutationDefinition<S>[];
  readonly invariants?: readonly InvariantDefinition<S>[];
  readonly views?: ViewRegistry<S, unknown>;
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

export interface IntelligenceProviderDeclaration {
  readonly name: string;
  readonly kind: "graph" | "llm" | "external";
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
