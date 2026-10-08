import {
  answerSeenBy,
  deriveMutations,
  derivedVia,
  mutationToolSchema,
  nodeRefArgs,
  permits,
  permittedMutations,
  refusalOf,
  resolveModules,
  search,
  sha256Hex,
  type AnyMutationDefinition,
  type AnySchema,
  type GraphDiff,
  type GraviewApp,
  type JsonSchema,
  type NodeOfSchema,
  type Place,
  type Principal,
  type RefCandidate,
  type RefusalReason,
  type Store,
} from "@graview/core";
import { computedValues } from "@graview/core/blocks";
import { authorship, markComputed, markGraph, markHits, markNode } from "./untrusted.js";
import {
  deriveAffordances,
  applyAffordance,
  type DeriveOptions,
} from "../derive.js";

/*
 * The describer, fetched when a place is first asked about, and asked for
 * again on the next ask when it did not arrive (FR-139). A literal
 * specifier and nothing more: tools runs in workerd, which refuses an
 * `import()` whose specifier is computed at run time.
 */
let describing: Promise<typeof import("@graview/core/describe")> | undefined;
const describer = () =>
  (describing ??= import("@graview/core/describe").catch((error: unknown) => {
    describing = undefined;
    throw error;
  }));

/**
 * WHAT A TOOL DOES, in the words every MCP directory asks for (FR-10).
 *
 * Derived from the declaration, never written per tool: a read is
 * read-only; an act that removes or severs loses something; an act whose
 * second run changes nothing the first did not is idempotent. Nothing a
 * Graview tool does reaches outside the graph it was derived from.
 */
export interface ToolAnnotations {
  readonly title: string;
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: false;
}

export interface ToolDefinition {
  /**
   * The name a model calls. MCP-safe — letters, digits, `_` and `-`, at
   * most 64, starting with a letter or `_` — so every client's tool layer
   * takes it. An act whose own name is already safe keeps it.
   */
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  /** False for the read tools, true for anything that changes the graph. */
  readonly mutating: boolean;
  readonly annotations: ToolAnnotations;
  /** The declared name of the act this tool runs; absent on the read tools. */
  readonly act?: string;
}

/** What a name given for a node argument was taken to mean (FR-33). */
export interface Resolved {
  /** The argument it was given for. */
  readonly argument: string;
  /** What the caller said. */
  readonly given: string;
  /** The record it was taken to mean, and what it is called. */
  readonly id: string;
  readonly label: string;
}

export type ToolResult<S extends AnySchema> =
  | {
      readonly ok: true;
      readonly data: unknown;
      readonly diff?: GraphDiff<NodeOfSchema<S>>;
      /**
       * The nodes this call LOOKED AT.
       *
       * A diff can only ever show what changed, and an agent that reassigns
       * one run after reading the whole week is doing something different
       * from one that reassigns it after reading nothing. The runtime is the
       * only place that knows, so it says so — and an interface can then draw
       * attention as well as change.
       */
      readonly reads?: readonly string[];
    }
  | {
      readonly ok: false;
      readonly error: string;
      /**
       * Why, as a code an agent can branch on (`refusalOf`, FR-46): `refused`
       * when the act's own rule said no (FR-119), `invalid` for the call as
       * sent, `forbidden`, `missing`. Absent when no act was judged — a name
       * that resolved to nothing or to several, a tool that is not there.
       */
      readonly reason?: RefusalReason;
      /** The roles that could, when the policy knows them. */
      readonly wouldNeed?: readonly string[];
      /** The argument a name could not be resolved for, when that is why. */
      readonly argument?: string;
      /** The records a name could mean, when it could mean several. */
      readonly candidates?: readonly RefCandidate[];
    };

export interface ToolRuntimeOptions<S extends AnySchema> {
  /**
   * Who this seat acts as. A principal is an author with roles, so the seat's
   * attribution and its authorization are the same fact — there is no way to
   * write as one participant and be permitted as another.
   */
  readonly author?: Principal;
  /**
   * Options for the seat's own deriveAffordances calls. A FUNCTION is read
   * fresh on every call — which is how a person's pins, toggled in the
   * menu after this runtime was built, still reach the agent's tool list.
   * The strip, the pointer menu and the seat must never disagree about
   * the same acts.
   */
  readonly derive?: DeriveOptions<S> | (() => DeriveOptions<S>);
  /** Refuse every mutating tool. Useful for a read-only agent seat. */
  readonly readOnly?: boolean;
  /**
   * The places the app's pictures name, so `search_graph` can answer "where
   * do I go for X" as well as "where is X". The store cannot see pictures;
   * whoever built the runtime beside a view registry can.
   */
  readonly places?: readonly Place[] | (() => readonly Place[]);
  /**
   * The app whose places `describe_place` describes: its home, its lenses,
   * its views and its arrangement (FR-89). Without it a seat can still be
   * told what a kind's list, a record's page and the derived home show.
   */
  readonly app?: GraviewApp<S>;
}

const read = (title: string): ToolAnnotations => ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

const READ_TOOLS: readonly ToolDefinition[] = [
  {
    name: "search_graph",
    title: "Find by name",
    description:
      "Find things by name: records whose name or readable fields carry the words, and the kinds, places and rules the words name — each with why it matched. Reach for this before get_graph when you know what something is called. Words match the start of words, case and accents aside; key:value tokens narrow as a list's filter does (done:false, is:any for past records, kind:<kind>). Pass subject (a node id) to get the acts you may run on it as hits too.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words, with optional key:value conditions." },
        limit: { type: "number", description: "Most hits to return; 20 when unsaid." },
        subject: { type: "string", description: "A node id whose acts to include." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Find by name"),
  },
  {
    name: "get_graph",
    title: "Read the whole graph",
    description:
      "Read the whole graph: every node with its fields, and every edge. Start here when you need the shape of the domain rather than one thing in it.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Read the whole graph"),
  },
  {
    name: "get_node",
    title: "Read one node",
    description:
      "Read one node, its edges, and the violations that implicate it, with its computed values: read-only fields worked out from what you can see, which no act sets. Use this to check a thing before you change it.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "A node's id, or its name." } },
      required: ["id"],
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Read one node"),
  },
  {
    name: "get_violations",
    title: "List the problems",
    description:
      "List every invariant violation the graph currently has, with the repairs that would resolve each one. Read this before proposing work: a rule that is already broken is more urgent than anything you could add.",
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "object",
          description: "Evaluation context, e.g. { weekStart }.",
        },
      },
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("List the problems"),
  },
  {
    name: "get_affordances",
    title: "Ask what can be done",
    description:
      "Ask what can legally be done with a selection, ranked. Prefer these over composing a mutation by hand: they are derived from the schema, the invariants and the shape of the graph, so they cannot name an action that does not exist.",
    inputSchema: {
      type: "object",
      properties: {
        selection: {
          type: "array",
          items: { type: "string" },
          description: "Node ids.",
        },
        context: { type: "object" },
      },
      required: ["selection"],
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Ask what can be done"),
  },
  {
    name: "describe_place",
    title: "Say what a place shows",
    description:
      "Say what one place of the app shows you, as a person in your seat would see it: its headings, its figures as drawn, its lists with each record's title and what its card or row says, the headings a list is grouped under, what an empty list says, and any block that could not be worked out. Pass a place's slug (\"home\", a lens's address like \"the-offers\", a kind's like \"offers\") or a record's id, and width 390 for a phone. Use it after a change to check what somebody now sees, instead of guessing.",
    inputSchema: {
      type: "object",
      properties: {
        place: { type: "string", description: "\"home\", a place's slug, or a record's id." },
        width: { type: "number", description: "The screen's width in CSS pixels; 390 is a phone, 1440 when unsaid." },
      },
      required: ["place"],
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Say what a place shows"),
  },
  {
    name: "preview_mutation",
    title: "Try an act without applying it",
    description:
      "Try a mutation without applying it: get back the diff it would produce and any invariant it would break. Do this when you are unsure, rather than applying and undoing.",
    inputSchema: {
      type: "object",
      properties: {
        mutation: { type: "string" },
        args: { type: "object" },
      },
      required: ["mutation", "args"],
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Try an act without applying it"),
  },
  {
    name: "undo_batch",
    title: "Undo a batch",
    description:
      "Undo one batch of operations. Fails, naming the blocking operation, when a later operation read what it wrote.",
    inputSchema: {
      type: "object",
      properties: {
        batch: { type: "string" },
        include: { type: "array", items: { type: "string" } },
      },
      required: ["batch"],
      additionalProperties: false,
    },
    mutating: true,
    annotations: { title: "Undo a batch", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
];

/**
 * One tool call, as it happens.
 *
 * The claim was that watching an agent needs no bespoke observability
 * because its edits produce the same diffs a human's do. True, and not
 * enough: a diff says what changed, never what was CONSIDERED. An agent that
 * reads six nodes and then reassigns one run appears, through diffs alone,
 * as a single unexplained write — the interface can only offer a spinner and
 * a toast. Emitting the calls themselves is what turns that into something a
 * person can follow, and read-only calls are the interesting half.
 */
export interface ToolCall {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly mutating: boolean;
  /** `running` on the way in; `ok` or `failed` on the way out. */
  readonly phase: "running" | "ok" | "failed";
  readonly error?: string;
  readonly at: string;
  /**
   * The nodes a settled read-only call looked at. Absent while running, and
   * absent for a mutating call — a change already reports its own reads
   * through the op log, and reporting them twice would double-count.
   */
  readonly reads?: readonly string[];
}

export interface ToolRuntime<S extends AnySchema> {
  readonly definitions: readonly ToolDefinition[];
  /**
   * The surface's fingerprint: `sha256:` of every definition, canonically.
   * A stateless host cannot push `tools/list_changed`; it compares this.
   */
  readonly hash: string;
  /**
   * Who this seat writes as.
   *
   * Exposed because a read has to be attributed to the SAME participant the
   * writes are, or one agent looking at the graph and then changing it reads
   * as two people editing at once.
   */
  readonly author?: ToolRuntimeOptions<S>["author"];
  call(name: string, args: Record<string, unknown>): Promise<ToolResult<S>>;
  /** Every applied change, whoever caused it. */
  onDiff(listener: (diff: GraphDiff<NodeOfSchema<S>>) => void): () => void;
  /** Every call, mutating or not, as it starts and as it settles. */
  onCall(listener: (call: ToolCall) => void): () => void;
}

/** Said on every act whose arguments name records: a name is resolved as well as an id (FR-33). */
export const BY_NAME = "An argument that names a record takes its id or its name.";

const READ_NAMES: readonly string[] = READ_TOOLS.map((tool) => tool.name);
const MAX_NAME = 64;

/**
 * A NAME EVERY CLIENT'S TOOL LAYER TAKES.
 *
 * MCP allows more than some model APIs do; the intersection is letters,
 * digits, `_` and `-`, at most 64, beginning with a letter or `_`. Accents
 * fall away ("café" is `cafe`), anything else is `_`, a name that begins
 * otherwise is `act_…`. Already safe — `add-vendor` — is left alone.
 */
function safeName(name: string): string {
  let safe = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9_-]/g, "_");
  if (safe.length === 0) safe = "act";
  if (!/^[A-Za-z_]/.test(safe)) safe = `act_${safe}`;
  return safe.slice(0, MAX_NAME);
}

/**
 * Every act's tool name, deterministically. The read tools keep theirs; the
 * acts are named in declaration order, over EVERY act and not only what one
 * seat may run, so a name never depends on who is asking. A name already
 * taken gets `_2`, `_3`… — an act called `get_node` is `get_node_2`.
 */
function toolNames(acts: readonly string[]): ReadonlyMap<string, string> {
  const taken = new Set(READ_NAMES);
  const names = new Map<string, string>();
  for (const act of acts) {
    const base = safeName(act);
    let name = base;
    for (let n = 2; taken.has(name); n += 1) name = `${base.slice(0, MAX_NAME - `_${n}`.length)}_${n}`;
    taken.add(name);
    names.set(act, name);
  }
  return names;
}

const humanized = (name: string): string => {
  const words = name.replace(/[-_]+/g, " ").trim();
  return words.length === 0 ? name : words[0]!.toUpperCase() + words.slice(1);
};

/** One act as the tool a model is offered: its schema, its title and what it does. */
function actTool(mutation: AnyMutationDefinition, name: string): ToolDefinition {
  const tool = mutationToolSchema(mutation);
  const title = tool.title ?? humanized(mutation.name);
  const description = tool.nodeRefs.length > 0 ? `${tool.description}${/[.!?]$/.test(tool.description) ? "" : "."} ${BY_NAME}` : tool.description;
  return {
    name,
    title,
    description,
    inputSchema: tool.inputSchema,
    mutating: true,
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: mutation.destructive === true || (mutation.severs?.length ?? 0) > 0,
      idempotentHint: mutation.idempotent === true,
      openWorldHint: false,
    },
    act: mutation.name,
  };
}

/** JSON with every object's keys sorted — the form two equal surfaces share. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

/** The surface's fingerprint. */
export function surfaceHash(definitions: readonly ToolDefinition[]): string {
  return `sha256:${sha256Hex(canonical(definitions))}`;
}

/** The surface, from every act there is and the ones this seat may run. */
function surfaceOf(
  acts: readonly AnyMutationDefinition[],
  permitted: ReadonlySet<string>,
  readOnly: boolean,
): { readonly definitions: readonly ToolDefinition[]; readonly names: ReadonlyMap<string, string> } {
  const names = toolNames(acts.map((act) => act.name));
  const definitions = readOnly
    ? READ_TOOLS.filter((tool) => !tool.mutating)
    : [...READ_TOOLS, ...acts.filter((act) => permitted.has(act.name)).map((act) => actTool(act, names.get(act.name)!))];
  return { definitions, names };
}

export interface ToolDefinitionsOptions {
  /** Only the read tools, as a read-only seat lists them. */
  readonly readOnly?: boolean;
  /** The modules this workspace has on, when the app declares modules; every one otherwise. */
  readonly enabledModules?: readonly string[];
}

/**
 * THE TOOL SURFACE WITHOUT A STORE.
 *
 * A host listing a hosted app's tools for one seat built a whole store —
 * graph, log, invariants — to read the same definitions the declaration
 * already holds. This is the runtime's own derivation from the app alone:
 * the same names, titles, schemas and hints `createToolRuntime` gives that
 * principal, and the hash a stateless host compares to learn the surface
 * moved.
 */
export function toolDefinitions<S extends AnySchema>(
  app: Pick<GraviewApp<S>, "schema" | "mutations" | "policy" | "modules">,
  principal: Principal = { kind: "agent" },
  options: ToolDefinitionsOptions = {},
): { readonly definitions: readonly ToolDefinition[]; readonly hash: string } {
  const declared = (app.mutations ?? []) as unknown as readonly AnyMutationDefinition[];
  const every = [...declared, ...deriveMutations(app.schema as AnySchema, declared as never)] as AnyMutationDefinition[];
  const modules = resolveModules(app.modules, options.enabledModules);
  const acts = every.filter(
    (act) => !modules.disabledMutations.has(act.name) && !(act.derived !== undefined && modules.disabledKinds.has(act.derived.kind)),
  );
  // As the store narrows: declared acts by the policy, derived ones through the acts they ride.
  const permitted = new Set([
    ...permittedMutations(app.policy, principal, acts.filter((act) => !act.derived)).map((act) => act.name),
    ...acts
      .filter((act) => act.derived !== undefined && permits(app.policy, principal, act.name, act.derived.kind, derivedVia(app.schema as AnySchema, every as never, act as never)).ok)
      .map((act) => act.name),
  ]);
  const { definitions } = surfaceOf(acts, permitted, options.readOnly === true);
  return { definitions, hash: surfaceHash(definitions) };
}

/**
 * Tool definitions generate ONCE from the schema and are transport-agnostic.
 *
 * The MCP adapter and the in-app adapter are two thin wrappers over the same
 * runtime, so an external agent and a surface inside the interface are using
 * literally the same actions and emitting literally the same diffs. That is
 * why watching an agent work needs no bespoke observability layer.
 */
export function createToolRuntime<S extends AnySchema>(
  store: Store<S>,
  options: ToolRuntimeOptions<S> = {},
): ToolRuntime<S> {
  const principal: Principal = options.author ?? { kind: "agent" };
  /*
   * Only what this seat MAY do.
   *
   * The narrowing is the store's, not the runtime's: a seat holding a
   * principal gets tools for what that principal can run, and there is no
   * second list to keep in step with the policy. A seat that then calls a
   * mutation it was not given still hits the store's refusal, because the
   * schema is a convenience and the enforcement is elsewhere.
   */
  const acts = store.allMutations() as unknown as AnyMutationDefinition[];
  const permitted = new Set(store.permittedMutations(principal).map((mutation) => mutation.name));
  const { definitions, names } = surfaceOf(acts, permitted, options.readOnly === true);
  const hash = surfaceHash(definitions);
  /** A tool's name, or an act's declared one, as the act it runs. */
  const actNamed = (name: string): string | undefined => {
    if (READ_NAMES.includes(name)) return undefined;
    for (const [act, tool] of names) if (tool === name) return act;
    return names.has(name) ? name : undefined;
  };

  /*
   * A NAME FOR A RECORD IS RESOLVED BEFORE THE ACT RUNS (FR-33): every
   * argument that names a record, given as a label or the start of one,
   * among the records this seat may see. One match is the record, and the
   * result says so; several are refused with every candidate; none says so.
   */
  const resolve = (
    act: string,
    given: Record<string, unknown>,
  ): { readonly args: Record<string, unknown>; readonly resolved: readonly Resolved[] } | Extract<ToolResult<S>, { ok: false }> => {
    const mutation = acts.find((one) => one.name === act);
    if (!mutation) return { args: given, resolved: [] };
    const args = { ...given };
    const resolved: Resolved[] = [];
    for (const ref of nodeRefArgs(mutation.input)) {
      const value = args[ref.name];
      if (typeof value !== "string" || value.trim() === "") continue;
      const found = store.resolveRef(ref, value, principal);
      if (!found.ok) {
        const hint = found.reason === "none" ? ` Nothing was changed. Use search_graph to look it up, then pass its id as ${ref.name}.` : " Nothing was changed.";
        return { ok: false, error: `${found.message}${hint}`, argument: ref.name, candidates: found.candidates };
      }
      if (found.by === "id") continue;
      args[ref.name] = found.id;
      resolved.push({ argument: ref.name, given: value, id: found.id, label: found.label });
    }
    return { args, resolved };
  };

  /**
   * The call itself, separated from the announcing so that every exit —
   * including an early return for an unknown tool — is reported exactly once.
   */
  const run = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult<S>> => {
    try {
      // The listed name first; an act's declared name reaches it too, unless a listed tool holds that name.
      const definition = definitions.find((tool) => tool.name === name) ?? definitions.find((tool) => tool.act === name);
      if (!definition) {
        /*
         * A tool this seat may not use EXISTS, and saying "unknown" would be
         * a lie an agent then reasons from — it would conclude the capability
         * is missing and go looking for a workaround. The same honesty the
         * interface owes a person: it is there, you may not use it, here is
         * who can.
         */
        const withheld = actNamed(name);
        if (withheld) {
          const verdict = store.permits({ name: withheld, args }, principal);
          if (!verdict.ok) return { ok: false, error: verdict.refusal.message, reason: "forbidden" };
        }
        return {
          ok: false,
          error: `Unknown tool "${name}". Available: ${definitions.map((t) => t.name).join(", ")}`,
        };
      }
      if (definition.mutating && options.readOnly) {
        return {
          ok: false,
          error: `"${name}" changes the graph, and this seat is read-only.`,
          reason: "forbidden",
        };
      }

      if (definition.act !== undefined) {
        const named = resolve(definition.act, args);
        if ("ok" in named) return named;
        // What the act did, as this seat may be told it: an act may touch what its own seat may not see (FR-55).
        const result = answerSeenBy(
          store,
          principal,
          store.apply({ name: definition.act, args: named.args }, { ...(options.author ? { author: options.author } : {}) }),
        );
        return {
          ok: true,
          data: {
            batch: result.batch,
            intent: result.intent,
            introduces: result.introduces,
            resolves: result.resolves,
            ...(named.resolved.length > 0 ? { resolved: named.resolved } : {}),
          },
          diff: result.diff,
        };
      }

      // Reads go through what this seat may see, and other people's words come back as data.
      const seen = store.seenBy(principal);
      switch (definition.name) {
        case "search_graph": {
          const places = typeof options.places === "function" ? options.places() : options.places;
          const subject = typeof args["subject"] === "string" ? args["subject"] : undefined;
          const found = search(seen, String(args["query"] ?? ""), {
            principal,
            limit: typeof args["limit"] === "number" ? args["limit"] : 20,
            ...(places ? { places } : {}),
            ...(subject ? { subject, from: [subject] } : {}),
          });
          return {
            ok: true,
            data: markHits(found, authorship(seen, principal)),
            // What came back was looked at: the records named, and nothing else.
            reads: found.hits.flatMap((hit) => (hit.about === "node" ? [hit.id] : [])),
          };
        }

        case "get_graph": {
          const snapshot = seen.graph.snapshot();
          return {
            ok: true,
            data: markGraph(snapshot, authorship(seen, principal)),
            reads: snapshot.nodes.map((node) => node.id),
          };
        }

        case "get_node": {
          const asked = String(args["id"] ?? "");
          let id = asked;
          let resolved: Resolved | undefined;
          if (!seen.graph.getNode(asked)) {
            // Not an id this seat sees: a name, as an act's argument takes one.
            const found = asked.trim() === "" ? undefined : store.resolveRef({ name: "id", kinds: ["*"] }, asked, principal);
            if (found?.ok) {
              id = found.id;
              resolved = { argument: "id", given: asked, id, label: found.label };
            } else if (found?.reason === "ambiguous") return { ok: false, error: found.message, argument: "id", candidates: found.candidates };
            else return { ok: false, error: `No node "${asked}".` };
          }
          const node = seen.graph.getNode(id)!;
          const out = seen.graph.outEdges(id);
          const inbound = seen.graph.inEdges(id);
          const by = authorship(seen, principal);
          // Worked out over what this seat sees, never the store's whole graph (FR-83, FR-55).
          const worked = computedValues(seen.schema, seen.graph as never, node as never);
          return {
            ok: true,
            data: {
              node: markNode(node, by),
              ...(Object.keys(worked.values).length > 0 ? { computed: markComputed(id, worked.values, by) } : {}),
              ...(Object.keys(worked.refused).length > 0 ? { uncomputed: worked.refused } : {}),
              out,
              in: inbound,
              violations: seen
                .violations()
                .filter((violation) => violation.nodeIds.includes(id)),
              ...(resolved ? { resolved: [resolved] } : {}),
            },
            // Asking about a node is asking about its neighborhood: the
            // answer names them, so looking at it looked at them.
            reads: [id, ...out.map((edge) => edge.to), ...inbound.map((edge) => edge.from)],
          };
        }

        case "describe_place": {
          const app = options.app ?? ({ name: "", schema: store.schema } as unknown as GraviewApp<S>);
          const width = typeof args["width"] === "number" && Number.isFinite(args["width"]) && args["width"] > 0 ? args["width"] : 1440;
          /*
           * The describer is fetched when a place is first asked about, not
           * with the seat: a page whose assistant is never asked carries
           * none of it (FR-112's coverage made it a few kB).
           */
          const { describePlace } = await describer();
          // Described for this seat: what it may see, and nothing else (FR-55).
          const said = describePlace(store, principal, String(args["place"] ?? ""), { app, width });
          if (!said.ok) return { ok: false, error: `${said.error} The places are: ${said.places.join(", ")}.` };
          const reads = new Set<string>();
          const walk = (parts: readonly unknown[]) => {
            for (const part of parts as { t: string; groups?: { items: { id: string; parts: unknown[] }[] }[] }[]) {
              for (const group of part.groups ?? []) for (const item of group.items) {
                reads.add(item.id);
                walk(item.parts);
              }
            }
          };
          walk(said.description.parts);
          return { ok: true, data: said.description, reads: [...reads] };
        }

        case "get_violations": {
          const violations = seen.violations(
            args["context"] as Record<string, unknown> | undefined,
          );
          return {
            ok: true,
            data: violations,
            reads: [...new Set(violations.flatMap((violation) => violation.nodeIds))],
          };
        }

        case "get_affordances": {
          const selection = (args["selection"] as string[]) ?? [];
          // Derived from what this seat sees: a record it may not see has no acts to offer, nor a name (FR-02).
          const derived = deriveAffordances(seen, selection, {
            ...(typeof options.derive === "function" ? options.derive() : options.derive),
            // The seat asks as ITSELF, so what it is offered is what it may
            // do — and what it may not is stated rather than hidden, which
            // is how an agent learns a capability exists that it lacks.
            ...(options.author ? { principal: options.author } : {}),
            ...(args["context"]
              ? { context: args["context"] as Record<string, unknown> }
              : {}),
          });
          return { ok: true, data: derived, reads: selection.filter((id) => seen.graph.has(id)) };
        }

        case "preview_mutation": {
          const asked = String(args["mutation"]);
          const act = actNamed(asked) ?? asked;
          const named = resolve(act, (args["args"] as Record<string, unknown>) ?? {});
          if ("ok" in named) return named;
          // A preview reads what it acts on: one naming a record this seat may not see is refused as one naming nothing (FR-55).
          const missing = store.missingFor({ name: act, args: named.args }, principal);
          if (missing) return { ok: false, error: missing.message, reason: "missing" };
          const preview = answerSeenBy(store, principal, store.preview({ name: act, args: named.args }, undefined, { author: principal }));
          return { ok: true, data: named.resolved.length > 0 ? { ...preview, resolved: named.resolved } : preview };
        }

        case "undo_batch": {
          const batch = String(args["batch"]);
          const include = (args["include"] as string[]) ?? [];
          // Judged over the log as this seat sees it, so a refusal never quotes a change it may not see (FR-16).
          const check = seen.canUndo([batch, ...include]);
          if (!check.ok) return { ok: false, error: check.message };
          const result = answerSeenBy(
            store,
            principal,
            store.undo([batch, ...include], { ...(options.author ? { author: options.author } : {}) }),
          );
          return { ok: true, data: result, diff: result.diff };
        }

        default:
          return { ok: false, error: `Unknown tool "${name}".` };
      }
    } catch (error) {
      // The sentence it always said, and the reason a program branches on (FR-119).
      const { reason, wouldNeed } = refusalOf(error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        reason,
        ...(wouldNeed ? { wouldNeed } : {}),
      };
    }
  };

  const watchers = new Set<(call: ToolCall) => void>();
  const announce = (call: ToolCall) => {
    for (const watcher of watchers) watcher(call);
  };

  return {
    definitions,
    hash,
    ...(options.author ? { author: options.author } : {}),

    onDiff(listener) {
      return store.subscribe(listener);
    },

    onCall(listener) {
      watchers.add(listener);
      return () => watchers.delete(listener);
    },

    async call(name, args) {
      const mutating =
        (definitions.find((tool) => tool.name === name) ?? definitions.find((tool) => tool.act === name))?.mutating ?? false;
      const started = { name, args, mutating, at: new Date().toISOString() };
      announce({ ...started, phase: "running" });
      const settle = <T extends ToolResult<S>>(result: T): T => {
        announce(
          result.ok
            ? {
                ...started,
                phase: "ok",
                ...(!mutating && result.reads ? { reads: result.reads } : {}),
              }
            : { ...started, phase: "failed", error: result.error },
        );
        return result;
      };
      return settle(await run(name, args));
    },
  };
}

export { applyAffordance };
