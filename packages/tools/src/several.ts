/*
 * `@graview/tools/several` — ACTING ON SEVERAL RECORDS AT ONCE.
 *
 * Every act on a page was on one record, so marking six tasks done was six
 * rounds. A selection of several now offers the acts every chosen record
 * shares and runs one of them over all of them as ONE change: one batch in
 * the log, one undo, attributed as any act is.
 *
 * WHAT IS OFFERED is the derivation's own (`deriveAffordances` over the
 * selection, the shape the scene's multi-selection already reads): an act
 * is shared when the derivation found it for every record, in the same
 * ranked order the strip, the menu and the record page read. Beside them,
 * a choice field's values — "Set stage to Declined" — through the act that
 * a status board moves a card with (`columnReach`): a named step where one
 * sets that value, else the free act told the value. Two things are left
 * out because nobody means them of several at once: the whole-record edit
 * (every field optional — the field values stand in for it) and giving
 * every record one name. Archiving, merging and removing are offered, kept
 * behind "More" by `more`.
 *
 * WHAT IS REFUSED IS NAMED PER RECORD, AND THE REST STILL APPLY. A store's
 * batch is all-or-nothing (`applyAll` keeps none of a batch refused part
 * way), and a selection is not one thing: it is the same act on several
 * records, each judged on its own — the policy, what the seat sees, the
 * act's own condition. So each is judged first, without being told to
 * anybody (`permits`, then a rehearsal, `previewAll`), the ones refused are
 * named in words, and the rest are applied as one batch. When the batch
 * itself is refused after that — a served store whose server says no — it
 * is all-or-nothing, and the answer says none was kept.
 *
 * Also exported from `@graview/tools`. Its own entry so a face fetches it
 * with the first selection, never in its first paint.
 */
import {
  actTitle,
  counted,
  labelOf,
  refusalOf,
  type AnyMutationDefinition,
  type AnySchema,
  type ApplyResult,
  type InvariantContext,
  type MutationCall,
  type Principal,
  type RefusalReason,
  type Store,
  type Via,
} from "@graview/core";
import { columnReach } from "@graview/core/describe";
import { failureWords } from "@graview/core/words";
import { deriveAffordances, type DeriveOptions } from "./derive.js";
import type { Affordance, OpenParameter } from "./types.js";

/** One act a selection of several shares: run once over every record, its questions asked once for all. */
export interface SeveralAct {
  /** Stable for the selection: the affordance's id, or `set:<field>:<value>` for a field value. */
  readonly id: string;
  /** What it does, without a count: "Mark it done", "Set stage to Declined". */
  readonly label: string;
  /** The act it runs on each record. */
  readonly mutation: string;
  /** The argument each record goes in. */
  readonly subject: string;
  /** Arguments every call shares: a field value, or what the derivation already settled. */
  readonly args: Readonly<Record<string, unknown>>;
  /** What is still to be asked — once, for every record. */
  readonly open: readonly OpenParameter[];
  /** Kept behind "More": an act that sets the records aside or removes them. */
  readonly more?: true;
  /** Loses something a person made. */
  readonly destructive?: true;
  /** The same act as an affordance on the first record, for a face that asks its questions with the form it asks one record's with. */
  readonly affordance: Affordance;
}

/** An act that exists for these records and this seat may not take, and why. */
export interface SeveralWithheld {
  readonly label: string;
  readonly message: string;
}

export interface SeveralActs {
  readonly acts: readonly SeveralAct[];
  readonly withheld: readonly SeveralWithheld[];
}

export interface SeveralOptions<S extends AnySchema> {
  /** Who is asking: the seat every act is judged for. */
  readonly principal?: Principal;
  readonly context?: Readonly<Record<string, unknown>>;
  /** Anything else the derivation takes (pins, providers). */
  readonly derive?: Omit<DeriveOptions<S>, "principal" | "context">;
}

/** The field a kind's records stand in, as its district and its board read it: its lifecycle's, else one called status, stage, state or phase. */
function stateFieldsOf(schema: AnySchema, kind: string): readonly string[] {
  const definition = schema.tryDefinition(kind);
  const fields = Object.keys(((definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}) as object);
  const lifecycle = (definition as { lifecycle?: { field?: string } } | undefined)?.lifecycle?.field;
  const named = [lifecycle, ...fields.filter((name) => /^(status|stage|state|phase)$/i.test(name))].filter((name): name is string => name !== undefined && fields.includes(name));
  // The first that is a choice (`columnReach` reaches none of a field that is not): one state, as a district has one.
  return [...new Set(named)].slice(0, 1);
}

/** The field a kind is named by, which nobody sets on several records to one value. */
function nameFieldOf(schema: AnySchema, kind: string): string {
  const roles = (schema.tryDefinition(kind) as { fieldRoles?: Readonly<Record<string, string>> } | undefined)?.fieldRoles;
  return roles?.["title"] ?? "label";
}

/**
 * THE ACTS EVERY CHOSEN RECORD SHARES, in the derivation's order, for the
 * seat that asks: the ones it may take, and the ones it may not with why.
 */
export function actsForSeveral<S extends AnySchema>(store: Store<S>, ids: readonly string[], options: SeveralOptions<S> = {}): SeveralActs {
  const nodes = ids.map((id) => store.graph.getNode(id)).filter((node) => node !== undefined);
  if (nodes.length === 0) return { acts: [], withheld: [] };
  const principal = options.principal ?? { kind: "human" };
  const set = deriveAffordances(store, nodes.map((node) => node.id), {
    ...options.derive,
    principal,
    ...(options.context ? { context: options.context } : {}),
  });
  const mutations = new Map(store.allMutations().map((mutation) => [mutation.name, mutation as unknown as AnyMutationDefinition]));
  const kinds = [...new Set(nodes.map((node) => node.kind as string))];
  const named = new Set(kinds.map((kind) => nameFieldOf(store.schema, kind)));
  /** Shared by every record, on a subject, and something a person means of several at once. */
  /*
   * The derivation's own act on the kind. One record alone may have it as a
   * rule's repair instead — the same act, kept once at the repair's score
   * ("Mark it done" on a late task) — and it is the same act here.
   */
  const fromSchema = new Set(set.affordances.filter((affordance) => affordance.provider === "schema").map((affordance) => affordance.mutation));
  const shared = (affordance: Affordance): AnyMutationDefinition | undefined => {
    const mutation = mutations.get(affordance.mutation);
    if (!mutation?.subject) return undefined;
    const alone = nodes.length === 1 && affordance.provider === "invariant" && !fromSchema.has(affordance.mutation) && affordance.args[mutation.subject.arg] === nodes[0]!.id;
    if (affordance.provider !== "schema" && !alone) return undefined;
    if (nodes.length > 1 && affordance.batch?.length !== nodes.length) return undefined;
    if (mutation.derived?.act === "edit") return undefined;
    if (affordance.open.some((parameter) => named.has(parameter.name))) return undefined;
    return mutation;
  };
  const acts: SeveralAct[] = [];
  const seen = new Set<string>();
  for (const affordance of set.affordances) {
    const mutation = shared(affordance);
    if (!mutation || seen.has(mutation.name)) continue;
    seen.add(mutation.name);
    const { [mutation.subject!.arg]: _subject, ...rest } = affordance.args;
    acts.push({
      id: affordance.id,
      label: actTitle(mutation),
      mutation: mutation.name,
      subject: mutation.subject!.arg,
      args: rest,
      open: affordance.open,
      ...(affordance.destructive || affordance.setsAside ? { more: true as const } : {}),
      ...(affordance.destructive ? { destructive: true as const } : {}),
      affordance: { ...affordance, label: actTitle(mutation) },
    });
  }
  /*
   * WHERE THEY STAND, as a board moves a card: "Move to Declined". The
   * kind's state — its lifecycle's field, else a choice called status,
   * stage, state or phase (the field its district and its board are by) —
   * and not every choice it has: seven "Set day to …" are a row of buttons
   * nobody asked for. Only where every record is one kind, only values some
   * record does not already have, and only through an act this seat may
   * run on the first of them (each is judged again as it runs).
   */
  if (kinds.length === 1) {
    const kind = kinds[0]!;
    for (const field of stateFieldsOf(store.schema, kind)) {
      for (const reach of columnReach(store.schema as AnySchema, [...mutations.values()], kind, field)) {
        if (reach.by === "none") continue;
        if (nodes.every((node) => (node as Record<string, unknown>)[field] === reach.value)) continue;
        const first = nodes.find((node) => (node as Record<string, unknown>)[field] !== reach.value)!;
        const act = reach.acts.find((one) => {
          const args = reach.by === "step" ? { [one.subject!.arg]: first.id } : { [one.subject!.arg]: first.id, [field]: reach.value };
          return store.permits({ name: one.name, args }, principal).ok;
        });
        if (!act) continue;
        const args = reach.by === "step" ? {} : { [field]: reach.value };
        // A named step is already offered under its own title; offered again it would be two buttons for one act.
        if (reach.by === "step" && acts.some((one) => one.mutation === act.name)) continue;
        const label = reach.by === "step" ? actTitle(act) : `Move to ${reach.label}`;
        const id = `set:${field}:${reach.value}`;
        acts.push({
          id,
          label,
          mutation: act.name,
          subject: act.subject!.arg,
          args,
          open: [],
          affordance: { id, label, provider: "schema", mutation: act.name, args: { [act.subject!.arg]: first.id, ...args }, open: [], score: 0, why: `every one is ${kind}`, nodeIds: nodes.map((node) => node.id) },
        });
      }
    }
  }
  // The day-to-day acts first, the field values after them, and what sets a record aside or removes it last.
  const ordered = [...acts.filter((act) => !act.more), ...acts.filter((act) => act.more)];
  const withheld = set.withheld
    .filter((affordance) => {
      const mutation = mutations.get(affordance.mutation);
      return mutation?.subject !== undefined && mutation.derived?.act !== "edit" && (nodes.length === 1 || affordance.batch?.length === nodes.length);
    })
    .map((affordance) => ({ label: actTitle(mutations.get(affordance.mutation)!), message: affordance.refusal.message }));
  return { acts: ordered, withheld };
}

/** One act over several records: the act, the argument each record goes in, and what every call shares. */
export interface SeveralCall {
  readonly mutation: string;
  readonly subject: string;
  readonly args?: Readonly<Record<string, unknown>>;
  /** What the gesture is called in the log and the undo: the act's title when unsaid. */
  readonly label?: string;
}

/** A record the act was not run on, and why, in words. */
export interface SeveralRefusal {
  readonly id: string;
  /** The record as a person knows it. */
  readonly label: string;
  readonly message: string;
  readonly reason: RefusalReason;
}

export interface SeveralOutcome<S extends AnySchema> {
  /** The one batch every change is in — what one undo takes back. Absent when nothing changed. */
  readonly batch?: string;
  /** What the log calls the gesture: "Mark it done — 3 tasks". */
  readonly intent?: string;
  /** The records it changed. */
  readonly applied: readonly string[];
  /** The records it would not have changed: already so. */
  readonly unchanged: readonly string[];
  /** The records it was not run on, each with why. */
  readonly refused: readonly SeveralRefusal[];
  /** True when the batch itself was refused after each record passed: none was kept. */
  readonly allOrNothing?: true;
  /** The store's own answer for the batch, when one was applied. */
  readonly result?: ApplyResult<S>;
}

export interface ActOnSeveralOptions {
  /** Who acts: the log's author, and the seat the policy judges. */
  readonly author?: Principal;
  readonly via?: Via;
  readonly context?: InvariantContext;
}

/**
 * RUN ONE ACT OVER SEVERAL RECORDS AS ONE CHANGE.
 *
 * Each record is judged on its own first — may this seat run it there, and
 * would it run (the act's condition, what the seat sees) — without telling
 * anybody, and the ones refused are named. Those it would change are then
 * applied as ONE batch with one undo; those already so are counted apart.
 */
export function actOnSeveral<S extends AnySchema>(store: Store<S>, act: SeveralCall, ids: readonly string[], options: ActOnSeveralOptions = {}): SeveralOutcome<S> {
  const author = options.author;
  const mutation = store.allMutations().find((one) => one.name === act.mutation);
  const words = (error: unknown) => failureWords(store.schema as AnySchema, store.allMutations() as never, error);
  const labelOfId = (id: string) => {
    const node = store.graph.getNode(id);
    return node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : id;
  };
  const refused: SeveralRefusal[] = [];
  const unchanged: string[] = [];
  let going: { readonly id: string; readonly call: MutationCall }[] = [];
  for (const id of [...new Set(ids)]) {
    const call: MutationCall = { name: act.mutation, args: { ...act.args, [act.subject]: id } };
    if (!mutation) {
      refused.push({ id, label: labelOfId(id), message: `There is no act “${act.mutation}”.`, reason: "invalid" });
      continue;
    }
    const verdict = store.permits(call, author);
    if (!verdict.ok) {
      refused.push({ id, label: labelOfId(id), message: verdict.refusal.message, reason: "forbidden" });
      continue;
    }
    if (!store.wouldChange(call, author)) {
      unchanged.push(id);
      continue;
    }
    going.push({ id, call });
  }
  /*
   * JUDGED TOGETHER FIRST, one by one only when that refuses: a rehearsal
   * of the whole batch is one copy of the graph, and the common case. A
   * record refused alone is named and left out; the rest are judged again,
   * since a record may only have passed beside one that was left out.
   */
  const rehearse = (calls: readonly MutationCall[]) => store.previewAll(calls, { ...(author ? { author } : {}), ...(options.context ? { context: options.context } : {}) });
  for (let round = 0; going.length > 0; round += 1) {
    try {
      rehearse(going.map((one) => one.call));
      break;
    } catch (error) {
      const still: typeof going = [];
      for (const one of going) {
        try {
          rehearse([one.call]);
          still.push(one);
        } catch (alone) {
          refused.push({ id: one.id, label: labelOfId(one.id), message: words(alone), reason: refusalOf(alone).reason });
        }
      }
      // Each passes alone and together they do not: nothing more can be told apart, so the batch's own refusal is every one's.
      if (still.length === going.length || round > going.length) {
        for (const one of still) refused.push({ id: one.id, label: labelOfId(one.id), message: words(error), reason: refusalOf(error).reason });
        going = [];
        break;
      }
      going = still;
    }
  }
  if (going.length === 0) return { applied: [], unchanged, refused };
  const title = act.label ?? (mutation ? actTitle(mutation) : act.mutation);
  const kinds = [...new Set(going.map((one) => store.graph.getNode(one.id)?.kind as string | undefined))];
  const intent = `${title} — ${kinds.length === 1 && kinds[0] ? counted(store.schema as AnySchema, kinds[0], going.length) : `${going.length} records`}`;
  try {
    const result = store.applyAll(
      going.map((one) => one.call),
      { intent, ...(author ? { author } : {}), ...(options.via ? { via: options.via } : {}) },
    );
    return { batch: result.batch, intent, applied: going.map((one) => one.id), unchanged, refused, result };
  } catch (error) {
    // Refused as a whole after every record passed: a batch is all-or-nothing, and none of it was kept.
    const message = words(error);
    const reason = refusalOf(error).reason;
    return { applied: [], unchanged, refused: [...refused, ...going.map((one) => ({ id: one.id, label: labelOfId(one.id), message, reason }))], allOrNothing: true };
  }
}
