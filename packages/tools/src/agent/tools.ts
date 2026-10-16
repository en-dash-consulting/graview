import {
  actTitle,
  deriveMutations,
  derivedVia,
  nodeRefArgs,
  permits,
  permittedMutations,
  refusalOf,
  resolveModules,
  archivedFrom,
  linkedRefsOf,
  linkedRelations,
  linkedValue,
  nameOfAuthor,
  sha256Hex,
  type LinkedRecord,
  type LinkedRecords,
  type AnyMutationDefinition,
  type AnySchema,
  type GraphDiff,
  type GraviewApp,
  type NodeOfSchema,
  type Place,
  type Principal,
  type RefCandidate,
  type RefusalReason,
  type Store,
  type SubscriptionStore,
  type Violation,
} from "@graview/core";
import { answerSeenBy } from "@graview/core/seat";
import { acceptSuggestion, declineSuggestion, suggestions } from "@graview/core/tidying";
import { search, type SearchRanker } from "@graview/core/search";
import { argumentsNeverShown, mutationToolSchema, type JsonSchema } from "@graview/core/json-schema";
import { authorship, markHits } from "./untrusted.js";
import { SUBSCRIPTION_TOOLS } from "./subscription-tools.js";
import { READ_HITS } from "./bounds.js";
import {
  deriveAffordances,
  applyAffordance,
  type DeriveOptions,
} from "../derive.js";

/** A part fetched once when first asked for, and asked for again on the next ask when it did not arrive (FR-139). */
const lazily =
  <T>(load: () => Promise<T>): (() => Promise<T>) => {
    let held: Promise<T> | undefined;
    return () =>
      (held ??= load().catch((error: unknown) => {
        held = undefined;
        throw error;
      }));
  };

/*
 * The describer, fetched when a place is first asked about. A literal
 * specifier and nothing more: tools runs in workerd, which refuses an
 * `import()` whose specifier is computed at run time.
 */
const describer = lazily(() => import("@graview/core/describe"));

/*
 * The words a broken rule's line is said in (FR-159), fetched and waited
 * for by the calls that answer problems (get_violations, get_node): once
 * they are here every judgment carries its line, and a rule that wrote no
 * sentence of its own says its values in its message — what a model, and
 * a connector's chat, reads. A literal
 * specifier, as above; a call answers without them when they did not
 * arrive, and the next asks again.
 */
const lines = () => import("@graview/core/lines").catch(() => undefined);

/*
 * THE WORDS BEFORE ANY ANSWER (FR-159). Fetched before every call, not only
 * a problems call: an act's `introduces` and `resolves` are judged by the
 * engine as it applies, so a seat's first act answered without values when
 * nothing had asked for the problems yet. Handed to the engine by name, so
 * a bundler that drops an import nothing names, or a judge set aside since,
 * cannot leave them out. Fetched once; every call after waits on nothing.
 */
const judgingWithLines = async (): Promise<void> => {
  (await lines())?.judgeWithLines();
};

/*
 * The bounded reads (FR-167), fetched with the first read: a seat that is
 * never asked carries none of them. A literal specifier, as above.
 */
const reads = lazily(() => import("./reads.js"));

/*
 * The drafting engine, fetched when a view is first asked for (draft_view,
 * keep_lens): a seat that never asks carries none of it. A literal
 * specifier, as above.
 */
const drafter = lazily(() => import("../draft.js"));

/* One act on several records, fetched when a seat first does one. A literal specifier, as above. */
const several = lazily(() => import("../several.js"));

/* Notify me (Roadmap f-notify-subscriptions), fetched with a seat's first subscribe, unsubscribe or list. A literal specifier, as above. */
const subscribing = lazily(() => import("./subscribe-run.js"));

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
   * THE HOST'S RANKER (`HostAi.near`): asked by `search_graph` when the
   * exact hits are few, with only the records this seat sees, its near hits
   * answered after the exact ones as `near: true`.
   */
  readonly near?: SearchRanker | undefined;
  /**
   * The app whose places `describe_place` describes: its home, its lenses,
   * its views and its arrangement (FR-89). Without it a seat can still be
   * told what a kind's list, a record's page and the derived home show.
   */
  readonly app?: GraviewApp<S>;
  /**
   * DRAWING A VIEW AND KEEPING IT: `draft_view` is listed — a read that
   * drafts a lens from an ask, or judges one the model wrote, under this
   * seat's sight — and, when the host can write the app's declaration,
   * `keep_lens`, which hands `keep` the checked `add-lens` edit. Unsaid,
   * neither is listed.
   */
  readonly drafts?: DraftTools;
  /**
   * WHAT A CHANGE CAME THROUGH, read at each call: the op log's `via`. A
   * seat whose proposal a model made says `ai:<name>` here, so the log
   * keeps which provider proposed it while the reader is shown none.
   */
  readonly via?: string | (() => string | undefined);
  /**
   * THE HOST'S WAY TO READ ANOTHER APP'S RECORDS (FR-171): what `find_linked`
   * answers through, as this seat. Unsaid, it says this host reads no other app.
   */
  readonly linked?: LinkedRecords;
  /**
   * WHERE "NOTIFY ME" IS KEPT (Roadmap f-notify-subscriptions): given, the
   * seat lists `subscribe`, `unsubscribe` and `list_subscriptions`, which
   * keep its person's subscriptions here — the same store the menu's sheet
   * and Activity's list keep them in. Unsaid, none of them is listed.
   */
  readonly subscriptions?: SubscriptionStore;
  /**
   * WHOSE SUBSCRIPTIONS THEY ARE: the person at the keyboard the seat sits
   * with — a chat in a page, whose agent acts for nobody in the log. Unsaid,
   * the person the seat acts for (`onBehalfOf`), else the seat itself.
   */
  readonly subscriber?: Principal;
}

/** Whether an app has a relation to another app's kind. */
const linksAnotherApp = (schema: AnySchema): boolean => schema.definitions.some((definition) => linkedRelations(definition).size > 0);

/** A far record as a tool answers it: the value to link it by, then what it is there. */
const linkedAnswer = (record: LinkedRecord) => ({
  value: linkedValue(record),
  label: record.label,
  ...(record.describe ? { describe: record.describe } : {}),
  ...(record.card ? { card: record.card } : {}),
  fields: record.fields,
  ...(record.app ? { app: record.app } : {}),
});

/** `find_linked`: another app's records, found or read through the host, as this seat (FR-171). */
async function findLinked(seen: Store<AnySchema>, principal: Principal, args: Record<string, unknown>, host: LinkedRecords | undefined): Promise<ToolResult<AnySchema>> {
  const asked = String(args["relation"] ?? "");
  const [kindAsked, nameAsked] = asked.includes(".") ? (asked.split(".", 2) as [string, string]) : [undefined, asked];
  const every = seen.schema.definitions.flatMap((definition) => [...linkedRelations(definition)].map(([name, relation]) => ({ kind: definition.kind, name, relation })));
  const found = every.filter((one) => one.name === nameAsked && (kindAsked === undefined || one.kind === kindAsked));
  if (found.length !== 1) {
    const known = every.map((one) => `${one.kind}.${one.name}`).join(", ") || "none";
    return { ok: false, error: `${found.length === 0 ? `No relation to another app is called "${asked}"` : `"${asked}" names a relation of several kinds`}. The relations to other apps are: ${known}.` };
  }
  const { kind, name, relation } = found[0]!;
  if (!host) return { ok: false, error: `This seat cannot read ${relation.address}: its host reads no other app's records. Nothing was changed.` };
  const viewer = { kind: principal.kind, ...(principal.id === undefined ? {} : { id: principal.id }), ...(principal.roles ? { roles: principal.roles } : {}) };
  const of = typeof args["of"] === "string" ? args["of"] : undefined;
  if (of !== undefined) {
    const node = seen.graph.getNode(of) as (Record<string, unknown> & { kind: string }) | undefined;
    if (!node || node.kind !== kind) return { ok: false, error: `No ${kind} "${of}".` };
    const refs = linkedRefsOf(node[name], relation);
    const answers = await Promise.all(refs.map((ref) => Promise.resolve().then(() => host.resolve(ref, viewer)).catch(() => null)));
    return {
      ok: true,
      data: { relation: `${kind}.${name}`, app: relation.address, records: answers.map((answer, at) => (answer === null ? { value: linkedValue(refs[at]!), missing: true } : "denied" in answer ? { denied: true, said: "linked record (no access)" } : linkedAnswer(answer))) },
      reads: [of],
    };
  }
  const limit = typeof args["limit"] === "number" && args["limit"] > 0 ? Math.min(args["limit"], READ_HITS) : READ_HITS;
  const answer = await Promise.resolve()
    .then(() => host.find({ address: relation.address, kinds: relation.kinds, query: String(args["query"] ?? ""), limit }, viewer))
    .catch(() => [] as const);
  if (!Array.isArray(answer)) return { ok: true, data: { relation: `${kind}.${name}`, app: relation.address, denied: true, said: "linked record (no access)" } };
  return { ok: true, data: { relation: `${kind}.${name}`, app: relation.address, records: answer.map(linkedAnswer), link: `edit-${kind} with ${name} set to a record's value` } };
}

/** The `add-lens` edit `keep_lens` hands the host. */
export interface KeptLensEdit {
  readonly op: "add-lens";
  readonly title: string;
  readonly lens: string;
  readonly on: string;
  readonly bindings?: Readonly<Record<string, unknown>>;
  readonly options?: Readonly<Record<string, unknown>>;
}

/** What a host gives a seat that may draw views: its model, for an ask no template reads, and how a kept lens is written. */
export interface DraftTools {
  readonly complete?: (prompt: string) => Promise<string>;
  /** Write the `add-lens` edit into the app's declaration (a document host's write); absent, `keep_lens` is not listed. */
  readonly keep?: (edit: KeptLensEdit) => Promise<{ readonly ok: true; readonly said?: string } | { readonly ok: false; readonly error: string }>;
}

const read =(title: string): ToolAnnotations => ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

/** Which records a read reaches (FR-173): the live ones unless it asks. */
const ARCHIVED_ARG = {
  description: "Which records: false (the default) the live ones, true only the archived ones, \"all\" both. An archived record is set aside, not gone: unarchive-<kind> brings it back.",
  anyOf: [{ type: "boolean" }, { type: "string", enum: ["all"] }],
} as const;

/** Where a page of a read starts (FR-167). */
const OFFSET = { type: "number", description: "Where the page starts; 0 when unsaid." } as const;

const READ_TOOLS: readonly ToolDefinition[] = [
  {
    name: "search_graph",
    title: "Find by name",
    description:
      "Find things by name: records whose name or readable fields carry the words, and the kinds, places and rules the words name — each with why it matched. Reach for this before get_graph when you know what something is called. Words match the start of words, case and accents aside; key:value tokens narrow as a list's filter does (done:false, is:any for past records, kind:<kind>). Pass subject (a node id) to get the acts you may run on it as hits too. When few records match exactly, records with a near word follow — a typo, another form of the word, a meaning — each with near: true and why.matched, the record's own word that answered.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words, with optional key:value conditions." },
        limit: { type: "number", description: "Most hits to return; at most 20." },
        subject: { type: "string", description: "A node id whose acts to include." },
        archived: ARCHIVED_ARG,
      },
      required: ["query"],
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Find by name"),
  },
  {
    name: "get_graph",
    title: "Read the graph",
    description:
      "Read the graph, 25 nodes a page: their fields, the edges out of them, and how many more. Start here when you need the shape of the domain rather than one thing in it.",
    inputSchema: {
      type: "object",
      properties: { offset: OFFSET, archived: ARCHIVED_ARG },
      additionalProperties: false,
    },
    mutating: false,
    annotations: read("Read the graph"),
  },
  {
    name: "get_node",
    title: "Read one node",
    description:
      "Read one node: its fields, its links (id, kind and label, 20 each way a page), the violations that implicate it, and its computed values: read-only fields worked out from what you can see, which no act sets. Use this to check a thing before you change it.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "A node's id, or its name." },
        offset: OFFSET,
      },
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
      "List the invariant violations the graph currently has, 20 a page, with the repairs that would resolve each one. Read this before proposing work: a rule that is already broken is more urgent than anything you could add.",
    inputSchema: {
      type: "object",
      properties: {
        offset: OFFSET,
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
  /*
   * WHAT WAITS FOR A PERSON (`suggest`, `@graview/core/tidying`): a change the app's own actor
   * was not sure enough of to make. Listed as this seat may see them, and
   * accepted or declined as the person would from the Suggested tray.
   */
  {
    name: "list_suggestions",
    title: "List what is suggested",
    description:
      "List the suggestions waiting for a person: changes the app's own actor proposed and did not make, each with its id, what it would do, who suggested it, what it was based on and how sure (0 to 1). Nothing changes until one is accepted (accept_suggestion) or declined (decline_suggestion); a declined one is never suggested again.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    mutating: false,
    annotations: read("List what is suggested"),
  },
  {
    name: "accept_suggestion",
    title: "Accept a suggestion",
    description: "Make a waiting suggestion's change, as this seat, carrying what it was based on. Returns the batch (undo_batch takes it back).",
    inputSchema: { type: "object", properties: { suggestion: { type: "string", description: "The suggestion's id, from list_suggestions." } }, required: ["suggestion"], additionalProperties: false },
    mutating: true,
    annotations: { title: "Accept a suggestion", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "decline_suggestion",
    title: "Decline a suggestion",
    description: "Decline a waiting suggestion: nothing changes, the decline is kept in the log, and the same change is never suggested or made by the app's own actor again.",
    inputSchema: { type: "object", properties: { suggestion: { type: "string", description: "The suggestion's id, from list_suggestions." } }, required: ["suggestion"], additionalProperties: false },
    mutating: true,
    annotations: { title: "Decline a suggestion", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

/*
 * ONE ACT ON SEVERAL RECORDS (`@graview/tools/several`): what a person does
 * with a selection on a list, the seat does with this — the same judging,
 * the same one batch, the same refusals named per record.
 */
const ACT_ON_SEVERAL: ToolDefinition = {
  name: "act_on_several",
  title: "Do one act to several records",
  description:
    "Run one act on several records at once, as one change with one undo. act is the act (its tool name or its declared name), records the records it runs on (ids or names; each goes in the act's subject), args what every call shares (\"Set stage to Declined\" is args { stage: \"declined\" }). Each record is judged on its own: one this seat may not change is named with why, and the rest still apply. Returns the batch (undo_batch takes it all back), the records changed, those already so, and those refused.",
  inputSchema: {
    type: "object",
    properties: {
      act: { type: "string", description: "The act to run on each record." },
      records: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 200, description: "Ids or names of the records." },
      args: { type: "object", description: "Arguments every call shares, besides the record." },
    },
    required: ["act", "records"],
    additionalProperties: false,
  },
  mutating: true,
  annotations: { title: "Do one act to several records", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
};

const LENS_SPEC = {
  type: "object",
  description: "A lens, as draft_view returns one.",
  properties: {
    title: { type: "string" },
    lens: { type: "string" },
    on: { type: "string" },
    bindings: { type: "object" },
    options: { type: "object" },
  },
  required: ["title", "lens", "on"],
} as const;

/** `draft_view`: a read. Nothing is written, and the draft is judged under the seat's sight. */
const DRAFT_VIEW: ToolDefinition = {
  name: "draft_view",
  title: "Draw a view",
  description:
    'Draw a view of the data from words ("a board of tasks by status", "who covers what") as a lens the app could keep; or check a lens you wrote (lens); or change the one on screen (current, with ask: "only this month"). Returns the lens and its add-lens edit, or one sentence saying why not. Writes nothing.',
  inputSchema: {
    type: "object",
    properties: {
      ask: { type: "string", description: "What to see, in words." },
      lens: LENS_SPEC,
      current: LENS_SPEC,
    },
    additionalProperties: false,
  },
  mutating: false,
  annotations: read("Draw a view"),
};

/** `keep_lens`: changes the app's declaration, through the host's own write. */
const KEEP_LENS: ToolDefinition = {
  name: "keep_lens",
  title: "Keep a view as a lens",
  description:
    "Keep a lens draft_view drew as one of the app's places: checked again, then written as the add-lens edit. Returns the remove-lens edit that takes it back.",
  inputSchema: { ...LENS_SPEC, additionalProperties: false },
  mutating: true,
  annotations: { title: "Keep a view as a lens", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

/**
 * `find_linked`: a read of ANOTHER APP'S records (FR-171), through the host,
 * as this seat. Listed only for an app with a relation to another app's
 * kind; linking one is the record's own edit, which takes `<kind>:<id>`.
 */
const FIND_LINKED: ToolDefinition = {
  name: "find_linked",
  title: "Find a record in another app",
  description:
    'A relation may go to a kind in another app (describe_app lists them under "Linked from other apps"). With relation and words, list the records there this seat may link — each with the value to link it by ("house:h1"), its name and its describe line. With of (a record id here), read the records that record links, as this seat may see them there. Linking one is the record\'s edit (edit-<kind>) with the relation set to the value. Another app this seat may not open answers denied, and nothing of it. Writes nothing; never changes the other app.',
  inputSchema: {
    type: "object",
    properties: {
      relation: { type: "string", description: "The relation, by name (forHouse) or as <kind>.<relation> (scenario.forHouse)." },
      query: { type: "string", description: "Words to find by, in the other app's names; empty for the first few." },
      of: { type: "string", description: "A record here whose linked records to read, instead of finding." },
      limit: { type: "number", description: "Most records to return; at most 20." },
    },
    required: ["relation"],
    additionalProperties: false,
  },
  mutating: false,
  annotations: read("Find a record in another app"),
};

/** The drafting tools a seat lists: none, draft_view, or draft_view and keep_lens. */
function draftTools(drafts: "draw" | "keep" | undefined, readOnly: boolean): readonly ToolDefinition[] {
  if (drafts === undefined) return [];
  return drafts === "keep" && !readOnly ? [DRAFT_VIEW, KEEP_LENS] : [DRAFT_VIEW];
}

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

const READ_NAMES: readonly string[] = [...READ_TOOLS.map((tool) => tool.name), ACT_ON_SEVERAL.name, DRAFT_VIEW.name, KEEP_LENS.name, FIND_LINKED.name, ...SUBSCRIPTION_TOOLS.map((tool) => tool.name)];
const MAX_NAME = 64;

/**
 * A NAME EVERY CLIENT'S TOOL LAYER TAKES.
 *
 * MCP allows more than some model APIs do; the intersection is letters,
 * digits, `_` and `-`, at most 64, beginning with a letter or `_`. Accents
 * fall away ("café" is `cafe`), anything else is `_`, a name that begins
 * otherwise is `act_…`. Already safe — `add-vendor` — is left alone.
 */
/**
 * A violation as a tool answers it: without the parts a page draws its line
 * with. The message says the line already where the rule wrote no sentence
 * of its own (`@graview/core/lines`, fetched by the calls that answer
 * problems), and a model reads words, not a drawing's pieces.
 */
function withoutLine<V extends { readonly line?: unknown }>(violation: V): Omit<V, "line"> {
  const { line: _line, ...rest } = violation;
  return rest;
}

/** An answer's problems — what it introduces, resolves and leaves — each as a tool answers it (`withoutLine`). */
function spokenProblems<A extends { readonly introduces?: readonly Violation[]; readonly resolves?: readonly Violation[]; readonly violationsAfter?: readonly Violation[] }>(answer: A): A {
  return {
    ...answer,
    ...(answer.introduces ? { introduces: answer.introduces.map(withoutLine) } : {}),
    ...(answer.resolves ? { resolves: answer.resolves.map(withoutLine) } : {}),
    ...(answer.violationsAfter ? { violationsAfter: answer.violationsAfter.map(withoutLine) } : {}),
  };
}

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

/** A tool's schema without the arguments a seat is not offered: their properties, and the requirement of any. */
function without(schema: JsonSchema, kept: ReadonlySet<string>): JsonSchema {
  if (kept.size === 0) return schema;
  const properties = Object.fromEntries(Object.entries((schema["properties"] ?? {}) as Record<string, JsonSchema>).filter(([name]) => !kept.has(name)));
  const required = ((schema["required"] ?? []) as string[]).filter((name) => !kept.has(name));
  return { ...schema, properties, ...(schema["required"] ? { required } : {}) };
}

/**
 * One act as the tool a model is offered: its schema, its title and what
 * it does — without an argument that writes a field the seat's sight never
 * shows it, so the tool does not name one (Roadmap f-field-sight).
 */
function actTool(mutation: AnyMutationDefinition, name: string, kept: ReadonlySet<string>): ToolDefinition {
  const tool = mutationToolSchema(mutation);
  const title = actTitle(mutation);
  const description = tool.nodeRefs.length > 0 ? `${tool.description}${/[.!?]$/.test(tool.description) ? "" : "."} ${BY_NAME}` : tool.description;
  return {
    name,
    title,
    description,
    inputSchema: without(tool.inputSchema, kept),
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

/** JSON with every object's keys sorted — the form two equal surfaces share, and two equal calls (FR-167). */
export function canonical(value: unknown): string {
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
  drafts: "draw" | "keep" | undefined,
  /** The arguments of an act this seat is not offered (`argumentsNeverShown`). */
  kept: (act: AnyMutationDefinition) => ReadonlySet<string>,
  /** Whether the app links another app's records (FR-171): `find_linked` is listed. */
  links = false,
  /** Whether the host keeps subscriptions: `subscribe`, `unsubscribe` and `list_subscriptions` are listed. */
  subscribes = false,
): { readonly definitions: readonly ToolDefinition[]; readonly names: ReadonlyMap<string, string> } {
  const names = toolNames(acts.map((act) => act.name));
  const drawing = [...draftTools(drafts, readOnly), ...(links ? [FIND_LINKED] : []), ...(subscribes ? SUBSCRIPTION_TOOLS : [])];
  const definitions = readOnly
    ? [...READ_TOOLS.filter((tool) => !tool.mutating), ...drawing]
    : [...READ_TOOLS, ACT_ON_SEVERAL, ...drawing, ...acts.filter((act) => permitted.has(act.name)).map((act) => actTool(act, names.get(act.name)!, kept(act)))];
  return { definitions, names };
}

export interface ToolDefinitionsOptions {
  /** Only the read tools, as a read-only seat lists them. */
  readonly readOnly?: boolean;
  /** The modules this workspace has on, when the app declares modules; every one otherwise. */
  readonly enabledModules?: readonly string[];
  /** List `draft_view` ("draw"), or it and `keep_lens` ("keep"), as a runtime given `drafts` (with `drafts.keep`) lists them. */
  readonly drafts?: "draw" | "keep";
  /** List `subscribe`, `unsubscribe` and `list_subscriptions`, as a runtime given `subscriptions` lists them. */
  readonly subscriptions?: boolean;
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
  const { definitions } = surfaceOf(acts, permitted, options.readOnly === true, options.drafts, (act) => argumentsNeverShown(app.schema as AnySchema, app.policy, principal, act as never), linksAnotherApp(app.schema as AnySchema), options.subscriptions === true);
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
  const { definitions, names } = surfaceOf(
    acts,
    permitted,
    options.readOnly === true,
    options.drafts ? (options.drafts.keep ? "keep" : "draw") : undefined,
    (act) => argumentsNeverShown(store.schema as AnySchema, store.policy, principal, act as never),
    linksAnotherApp(store.schema as AnySchema),
    options.subscriptions !== undefined,
  );
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
      await judgingWithLines();
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
          store.apply(
            { name: definition.act, args: named.args },
            { ...(options.author ? { author: options.author } : {}), ...viaNow(options.via) },
          ),
        );
        return {
          ok: true,
          data: {
            batch: result.batch,
            intent: result.intent,
            introduces: result.introduces.map(withoutLine),
            resolves: result.resolves.map(withoutLine),
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
          const asked = search(seen, String(args["query"] ?? ""), {
            principal,
            rank: options.near,
            // An agent's find reaches the live records unless it asks (FR-173).
            archived: archivedFrom(args["archived"]),
            limit: typeof args["limit"] === "number" && args["limit"] > 0 ? Math.min(args["limit"], READ_HITS) : READ_HITS,
            ...(places ? { places } : {}),
            ...(subject ? { subject, from: [subject] } : {}),
          });
          // The host's ranker's near hits, when it was asked: an agent waits for them, as the strip shows them when they come.
          const found = asked.later ? await asked.later : asked;
          return {
            ok: true,
            data: (await reads()).searchRead(found, markHits(found, authorship(seen, principal))),
            // What came back was looked at: the records named, and nothing else.
            reads: found.hits.flatMap((hit) => (hit.about === "node" ? [hit.id] : [])),
          };
        }

        case "get_graph": {
          /* A page of records, the edges out of them, and how many more (FR-167): the whole graph was one answer of 28,000 tokens. */
          return { ok: true, ...(await reads()).graphRead(seen, authorship(seen, principal), args) };
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
          /* Its fields and its links as ids, kinds and labels, a page each way (FR-167): never the neighborhood's own fields. */
          const answer = (await reads()).nodeRead(seen, authorship(seen, principal), id, args);
          return { ok: true, data: resolved ? { ...answer.data, resolved: [resolved] } : answer.data, reads: answer.reads };
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

        case "find_linked":
          return findLinked(seen as unknown as Store<AnySchema>, principal, args, options.linked) as Promise<ToolResult<S>>;

        case "draft_view":
        case "keep_lens": {
          // Drawn and judged as this seat sees the app, by the engine fetched for it (FR-55).
          const app = options.app ?? ({ name: "", schema: store.schema } as unknown as GraviewApp<S>);
          return (await drafter()).runDraftTool(definition.name, args, { app, principal, ...(options.drafts ? { drafts: options.drafts } : {}) }) as Promise<ToolResult<S>>;
        }

        case "get_violations": {
          const every = seen.violations(
            args["context"] as Record<string, unknown> | undefined,
          );
          /* A page of problems, and how many more (FR-167). */
          return { ok: true, ...(await reads()).violationsRead(every, args) };
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
          const spoken = spokenProblems(preview);
          return { ok: true, data: named.resolved.length > 0 ? { ...spoken, resolved: named.resolved } : spoken };
        }

        case "act_on_several": {
          const asked = String(args["act"] ?? "");
          const act = actNamed(asked) ?? asked;
          const mutation = acts.find((one) => one.name === act);
          if (!mutation || !permitted.has(act)) {
            const verdict = mutation ? store.permits({ name: act, args: {} }, principal) : undefined;
            if (verdict && !verdict.ok) return { ok: false, error: verdict.refusal.message, reason: "forbidden" };
            return { ok: false, error: `There is no act "${asked}" this seat may run. Nothing was changed.`, reason: "invalid" };
          }
          const subject = mutation.subject;
          if (!subject) return { ok: false, error: `"${actTitle(mutation)}" does not act on a record, so it cannot be run on several. Nothing was changed.`, reason: "invalid" };
          const given = Array.isArray(args["records"]) ? (args["records"] as unknown[]).filter((one): one is string => typeof one === "string" && one.trim() !== "") : [];
          if (given.length === 0) return { ok: false, error: "Name at least one record. Nothing was changed.", reason: "invalid" };
          // Each record by its id or its name (FR-33), among those this seat may see; a name that is not one record refuses the whole call.
          const ids: string[] = [];
          const resolved: Resolved[] = [];
          for (const value of given.slice(0, 200)) {
            const found = store.resolveRef({ name: subject.arg, kinds: subject.kinds as readonly string[] }, value, principal);
            if (!found.ok) return { ok: false, error: `${found.message} Nothing was changed.`, argument: "records", candidates: found.candidates };
            ids.push(found.id);
            if (found.by !== "id") resolved.push({ argument: "records", given: value, id: found.id, label: found.label });
          }
          const shared = resolve(act, { ...((args["args"] as Record<string, unknown> | undefined) ?? {}) });
          if ("ok" in shared) return shared;
          const outcome = (await several()).actOnSeveral(store, { mutation: act, subject: subject.arg, args: shared.args }, ids, {
            author: principal,
            ...viaNow(options.via),
          });
          const seenResult = outcome.result ? answerSeenBy(store, principal, outcome.result) : undefined;
          return {
            ok: true,
            data: {
              ...(outcome.batch ? { batch: outcome.batch, intent: outcome.intent } : {}),
              applied: outcome.applied,
              unchanged: outcome.unchanged,
              refused: outcome.refused.map((one) => ({ record: one.id, label: one.label, error: one.message, reason: one.reason })),
              ...(outcome.allOrNothing ? { keptNone: true } : {}),
              ...(seenResult ? { introduces: seenResult.introduces.map(withoutLine), resolves: seenResult.resolves.map(withoutLine) } : {}),
              ...(resolved.length > 0 || shared.resolved.length > 0 ? { resolved: [...resolved, ...shared.resolved] } : {}),
            },
            ...(seenResult ? { diff: seenResult.diff } : {}),
          };
        }

        case "subscribe":
        case "unsubscribe":
        case "list_subscriptions": {
          // Kept for the person this seat acts for, judged as they see the app (Roadmap f-notify-subscriptions).
          const answer = await (await subscribing()).runSubscriptionTool(definition.name, args, {
            store: store as unknown as Store<AnySchema>,
            principal: options.subscriber ?? principal,
            app: options.app?.name ?? "app",
            subscriptions: options.subscriptions!,
          });
          return answer.ok ? { ok: true, data: answer.data } : { ok: false, error: answer.error };
        }

        case "list_suggestions": {
          // As this seat may see them; what the actor based each on is its words, handed over as data (FR-10).
          const waiting = suggestions(store, principal).map((one) => {
            const by = nameOfAuthor(one.author, { graph: seen.graph as never, schema: store.schema });
            return {
              id: one.id,
              intent: one.intent,
              by,
              at: one.at,
              about: one.about,
              ...(one.lineage ? { basis: { untrusted: true as const, authoredBy: by, text: one.lineage.basis }, ...(one.lineage.confidence !== undefined ? { confidence: one.lineage.confidence } : {}) } : {}),
            };
          });
          return { ok: true, data: { suggestions: waiting }, reads: [...new Set(waiting.flatMap((one) => one.about))] };
        }

        case "accept_suggestion":
        case "decline_suggestion": {
          const id = String(args["suggestion"] ?? "");
          const as = { author: principal, ...viaNow(options.via) };
          const done = definition.name === "accept_suggestion" ? acceptSuggestion(store, id, as) : declineSuggestion(store, id, as);
          const result = answerSeenBy(store, principal, done);
          return { ok: true, data: { batch: result.batch, intent: result.intent, introduces: result.introduces.map(withoutLine), resolves: result.resolves.map(withoutLine) }, diff: result.diff };
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
          return { ok: true, data: spokenProblems(result), diff: result.diff };
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
      const result = await run(name, args);
      // No read hands a model more than a read may (FR-167): what does not fit is cut, and says so.
      return settle(result.ok && !mutating ? { ...result, data: (await reads()).withinReadChars(name, result.data) } : result);
    },
  };
}

export { applyAffordance };

/** The channel a runtime's change came through right now, as `ApplyOptions` spells it. */
function viaNow(via: ToolRuntimeOptions<AnySchema>["via"]): { readonly via?: string } {
  const now = typeof via === "function" ? via() : via;
  return now ? { via: now } : {};
}
