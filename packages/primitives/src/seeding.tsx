import { pluralOf, beginning, counted, providerCan, type AnySchema, type Beginning, type Principal, type Store } from "@graview/core";
import { kindCardId } from "@graview/layout/view";
import {
  createViews,
  GraviewProvider,
  useApplyAffordance,
  useGraph,
  useGraview,
  useGraviewIfAny,
  useLocalIntelligence,
} from "@graview/react";
import {
  applyPlan,
  dependentsOf,
  deriveAffordances,
  firstJsonObject,
  resolveProposal,
  validateProposals,
  without,
  type Affordance,
  type AffordanceSet,
  type Plan,
  type PlanEntry,
  type PlanOptions,
  type PlannedCall,
} from "@graview/tools";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnswerArgs } from "./workbench/index.js";
import { MUTED_TEXT, Panel } from "./primitives/index.js";

/**
 * THE SURFACES A BLANK GRAPH NEEDS, derived like every other surface.
 *
 * The framework derives a home, a list per kind, a record per node, a form
 * per act and a problems page. It did not derive THE WAY IN — the one state
 * every product ships in and the one its author never sees, because their own
 * graph has had data in it since the first afternoon.
 *
 * Three surfaces, and all three read the same thing: `beginning()`, the chain
 * the declaration already states.
 */

/** The kinds, in the order a blank installation can fill them. */
/*
 * ROOM FOR THE LIST'S OWN NUMBERS.
 *
 * A numbered list's markers hang in its left padding, and 1.25rem holds one
 * digit and its stop. The eleventh kind of an app read "1…9, 0, 1": the "1"
 * of "10" was clipped off by the panel. The padding grows with the widest
 * number the list will show — a digit is 1ch, the stop and the gap after it
 * another one and a half.
 */
export function markerRoom(count: number): string {
  return `${String(Math.max(1, count)).length + 1.5}ch`;
}

function chainOf<S extends AnySchema>(store: { schema: S; allMutations: () => readonly unknown[] }): Beginning {
  return beginning({
    name: "",
    schema: store.schema,
    mutations: store.allMutations() as never,
  });
}

export interface BeginProps<S extends AnySchema = AnySchema> {
  /** What to say once every kind has something in it. Absent, it says nothing. */
  readonly whenFull?: ReactNode;
  /**
   * What goes around the DOOR, and only the door.
   *
   * On the routed face the door wants a page's column and landmark around
   * it — `PageMain` — and `whenFull` is a whole page that brings its own.
   * A Home that wrapped the two together put the derived home's `main`
   * inside a second `main` and its gallery inside a reading column, one
   * card wide at a desk. The frame is applied to the door alone; what
   * comes when the graph is full is returned exactly as it was given.
   */
  readonly frame?: (door: ReactNode) => ReactNode;
  readonly title?: string;
  /**
   * The level of the door's heading. A framed door is a page of its own —
   * the routed face's first screen on an empty graph — so it is the page's
   * level-one heading unless this says otherwise.
   */
  readonly heading?: 1 | 2 | 3 | 4;
  /**
   * The store, for a face that has no provider.
   *
   * The way in belongs on BOTH faces — the scene's first screen and the
   * routed face's home are the same question — and only the scene has a
   * provider. Given a store this reads it; inside a provider it needs
   * nothing.
   */
  readonly store?: Store<S>;
  /**
   * Who is beginning. Without it a guarded store answers as an unroled
   * human, which is refused everything — so a seat that may not act must
   * still be TOLD, rather than shown an empty page.
   */
  readonly principal?: Principal;
}

/**
 * THE WAY IN, derived.
 *
 * A ten-kind app on an empty graph has one door and nine silent districts.
 * This is the door, the order behind it, and — for the kinds that are not
 * ready yet — what they are waiting for, in the declaration's own words.
 *
 * Nothing here is configured. The chain comes from `creates` and the acts'
 * own node references; the acts come from the same derivation the actions
 * strip reads, so an act offered here is an act that can actually run, with
 * its open questions asked by the same walk that asks them anywhere else.
 */
/**
 * THE WAY IN BELONGS ON BOTH FACES, and only one of them has a provider.
 *
 * The scene is always inside a `GraviewProvider`; the routed face carries
 * its store in a `PageContext` instead. Everything these surfaces are made
 * of — the affordance derivation, the walk that asks an act's open
 * questions, applying a plan as one turn — reads the provider, so rather
 * than teach each of them a second way to find a store, this puts one up
 * when there is none. The registry is empty because nothing here draws a
 * view.
 *
 * The SEAT comes with it. A surface handed a guarded store and no principal
 * is refused everything, which draws as a page with no way in and no reason
 * given — the exact wall these surfaces exist to take down.
 */
function Lifted<S extends AnySchema>({
  store,
  principal,
  what,
  children,
}: {
  readonly store?: Store<S>;
  readonly principal?: Principal;
  readonly what: string;
  readonly children: ReactNode;
}) {
  const provided = useGraviewIfAny<S>();
  if (provided !== null) return <>{children}</>;
  if (!store) throw new Error(`<${what}> needs a store: pass one, or put it inside a <GraviewProvider>.`);
  return (
    <GraviewProvider
      store={store}
      views={createViews(store.schema)}
      {...(principal ? { principal } : {})}
    >
      {children}
    </GraviewProvider>
  );
}

export function Begin<S extends AnySchema>(props: BeginProps<S> = {}) {
  return (
    <Lifted what="Begin" {...(props.store ? { store: props.store } : {})} {...(props.principal ? { principal: props.principal } : {})}>
      <BeginInside {...props} />
    </Lifted>
  );
}

function BeginInside<S extends AnySchema>({ whenFull, frame, title = "Begin", heading = frame ? 1 : undefined }: BeginProps<S>) {
  const { store, principal } = useGraview<S>();
  const nodes = useGraph();
  /* Without the kinds kept from this seat: a stranger is not told the store has no test drives. */
  const chain = useMemo(() => {
    const whole = chainOf(store);
    const kept = store.kindsKeptFrom(principal);
    return kept.size === 0 ? whole : { ...whole, order: whole.order.filter((entry) => !kept.has(entry.kind)) };
  }, [store, principal]);
  const counts = useMemo(() => {
    const found: Record<string, number> = {};
    for (const entry of chain.order) found[entry.kind] = store.graph.nodesOfKind(entry.kind).length;
    return found;
  }, [chain, store, nodes]);

  /*
   * Derived once, here, rather than inside each row — because whether this
   * surface should be on screen AT ALL depends on the answer.
   */
  const ways = useMemo(() => {
    const found: Record<string, AffordanceSet> = {};
    for (const entry of chain.order) {
      if ((counts[entry.kind] ?? 0) > 0) continue;
      if (!entry.needs.every((needed) => (counts[needed] ?? 0) > 0)) continue;
      found[entry.kind] = deriveAffordances(store, [kindCardId(entry.kind)], {
        kindSelection: [entry.kind],
        ...(principal ? { principal } : {}),
      });
    }
    return found;
  }, [store, principal, chain, counts, nodes]);

  const empty = chain.order.filter((entry) => (counts[entry.kind] ?? 0) === 0);
  const startable = Object.values(ways).some((way) => way.affordances.length > 0);
  const standing = chain.order.some((entry) => (counts[entry.kind] ?? 0) > 0);

  /*
   * WHEN TO STAND DOWN — and the answer is not "when every kind has one".
   *
   * A working property found this: Maple Street is planted, tended and
   * inspected, and this panel was still on its front page, headed "what has
   * to exist before the rest of it can", because two kinds were empty —
   * invitations and people — and the seat reading the page was a keeper,
   * who may not invite anybody. Nothing on the list was anything that
   * reader could do, so the list was a chore board of other people's work.
   *
   * So: stand down when nothing here is startable BY THIS SEAT and the
   * graph is standing anyway. The empty graph keeps the opposite rule —
   * there, "you may not, and here is who may" is the single most useful
   * sentence on the screen, and hiding it would put a person in front of a
   * blank page with no explanation, which is the wall this exists to end.
   */
  /*
   * THE KEYBOARD OUTLIVES THE DOOR IT WENT THROUGH.
   *
   * Answering "Add a song" from the keyboard made the first song — and the
   * row that asked went away with it, or the whole door did, standing down
   * for the home it hands back to. Either way the element the keyboard was
   * on left the document and took focus to <body>. So the door remembers
   * where the keyboard was, and when that is gone it lands on the next way
   * in, else on the heading of whatever now stands here.
   */
  const box = useRef<HTMLDivElement | null>(null);
  const kept = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const was = kept.current;
    if (!was || was.isConnected || document.activeElement !== document.body) return;
    kept.current = null;
    const next =
      box.current?.querySelector<HTMLElement>('[data-testid^="begin-"]:is(button, a):not([disabled])') ??
      box.current?.querySelector<HTMLElement>("h1, h2, h3");
    if (!next) return;
    if (!next.matches("button, a, input, select, textarea, [tabindex]")) next.tabIndex = -1;
    next.focus();
  });
  const held = (children: ReactNode) => (
    <div
      ref={box}
      style={{ display: "contents" }}
      onFocus={(event) => {
        kept.current = event.target as HTMLElement;
      }}
    >
      {children}
    </div>
  );

  if (empty.length === 0 || (!startable && standing)) return whenFull === undefined ? null : held(whenFull);

  const door = (
    <Panel title={title} subtitle="What has to exist before the rest of it can." fit {...(heading ? { heading } : {})}>
      <ol data-testid="begin" style={{ margin: 0, paddingLeft: markerRoom(chain.order.length), display: "grid", gap: 10 }}>
        {chain.order.map((entry) => {
          const has = counts[entry.kind] ?? 0;
          const plural = pluralOf(store.schema, entry.kind);
          const ready = entry.needs.every((needed) => (counts[needed] ?? 0) > 0);
          return (
            <li key={entry.kind} data-begin-kind={entry.kind} data-begin-ready={ready || undefined}>
              <strong>{plural}</strong>{" "}
              <span style={{ fontVariantNumeric: "tabular-nums", ...MUTED_TEXT }}>
                {has === 0 ? "none yet" : has}
              </span>
              {entry.depth === null ? (
                <div style={{ fontSize: "0.875rem", ...MUTED_TEXT }}>
                  Nothing here makes {plural.toLowerCase()} — they arrive with the data.
                </div>
              ) : has > 0 ? null : ready ? (
                <BeginHere kind={entry.kind} derived={ways[entry.kind]!} />
              ) : (
                <div style={{ fontSize: "0.875rem", ...MUTED_TEXT }}>
                  {/* Only what is still missing: "waiting for Showrooms and Cars" was said beside 4 showrooms and 340 cars. */}
                  Waiting for {entry.needs.filter((kind) => (counts[kind] ?? 0) === 0).map((kind) => pluralOf(store.schema, kind)).join(" and ")}.
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
  return held(frame ? frame(door) : door);
}
function BeginHere({ kind, derived }: { readonly kind: string; readonly derived: AffordanceSet }) {
  const { affordances, withheld } = derived;
  const { apply } = useApplyAffordance();
  const [asking, setAsking] = useState<Affordance | null>(null);

  /*
   * WITHHELD, NOT HIDDEN — the same honesty the actions strip gives.
   *
   * A guarded store answers an unroled seat by refusing everything, and a
   * first screen that responds to that by drawing nothing is the exact
   * failure this surface exists to end: a person looking at a page with no
   * way in and no reason given. Say who could instead.
   */
  if (affordances.length === 0 && withheld.length > 0) {
    return (
      <div data-testid={`begin-withheld-${kind}`} style={{ fontSize: "0.875rem", marginTop: 4, ...MUTED_TEXT }}>
        {withheld[0]!.refusal.message}
      </div>
    );
  }
  if (affordances.length === 0) return null;
  if (asking) {
    return (
      <AnswerArgs
        affordance={asking}
        onApply={(args) => {
          apply(asking, args);
          setAsking(null);
        }}
        onCancel={() => setAsking(null)}
      />
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {affordances.map((affordance) => (
        <button
          key={affordance.id}
          type="button"
          data-testid={`begin-${affordance.mutation}`}
          onClick={() => (affordance.open.length === 0 ? apply(affordance, {}) : setAsking(affordance))}
          style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 10px", fontSize: "0.875rem" }}
        >
          {affordance.label}
        </button>
      ))}
    </div>
  );
}

export interface PlanReviewProps<S extends AnySchema> {
  readonly plan: Plan;
  /** Applied under one batch; the handle comes back for the undo. */
  readonly onApplied?: (batch: string, applied: number) => void;
  readonly onDiscard?: () => void;
  readonly title?: string;
  /**
   * Let a person decline an entry. A review nobody can disagree with is not
   * a review, and declining the area declines the tree standing in it — the
   * plan says what points at what, so the cascade is stated before the press
   * rather than discovered after it.
   */
  readonly declinable?: boolean;
  /** Passed on when the plan is re-made after a decline. */
  readonly options?: PlanOptions<S>;
  /**
   * What a follow-up act adds, in the product's words. Given the entry and
   * the names of everything else in the plan; return null to fall back to
   * the mutation's own title, which is always at least true.
   */
  readonly also?: (entry: PlanEntry, names: ReadonlyMap<string, string>) => string | null;
  /** Anything the product wants said above the list — a summary, a warning. */
  readonly header?: ReactNode;
  /** Render without the panel around it, for a product with its own frame. */
  readonly bare?: boolean;
  /** A name for the turn, so the activity rail reads as one thing. */
  readonly batch?: string;
  /** For the routed face, which has no provider. See `<Begin>`. */
  readonly store?: Store<S>;
  readonly principal?: Principal;
}

/**
 * ONE ROW PER THING, NOT PER ACT.
 *
 * A proposal becomes several calls — a feature with an inspection interval
 * is `place-feature` and then `set-inspection-interval`; a concern is
 * `raise-concern` and one `contend-with` per area it touches. A review that
 * listed the calls showed "Large central tree" and then "central-tree"
 * underneath it, which reads as the model repeating itself. It was not; the
 * review was. A person decides about the tree, and everything the plan says
 * about the tree goes with that decision.
 *
 * Which thing a call is about is already declared: `as` names the one it
 * makes, and `subject.arg` — the same seam affordances are derived through
 * — names the argument holding the one it acts on. Nothing new to write.
 */
interface PlanRow {
  readonly key: string;
  /** The plan's own name for what this row makes, when it makes one. */
  readonly name?: string;
  /** The node it acts on, when that node is already standing in the graph. */
  readonly about?: string;
  readonly entries: readonly PlanEntry[];
}

function rowsOf(
  plan: Plan,
  about: (mutation: string) => { readonly subjectArg?: string; readonly makes: boolean },
): readonly PlanRow[] {
  const rows: PlanRow[] = [];
  const byOwner = new Map<string, number>();
  for (const entry of plan.entries) {
    const made = entry.call.as;
    const { subjectArg, makes } = about(entry.call.mutation);
    /*
     * A call that MAKES something is always its own row, named or not — the
     * oak stands in the lawn and depends on it, but nobody thinks of the oak
     * as a detail of the lawn. Only a call that modifies or connects belongs
     * to the thing it is about.
     */
    if (made !== undefined || makes) {
      if (made !== undefined) byOwner.set(made, rows.length);
      rows.push({ key: made ?? `${entry.call.mutation}:${entry.at}`, ...(made ? { name: made } : {}), entries: [entry] });
      continue;
    }
    /*
     * What it acts on is either something this plan is making — a
     * `{ $plan: name }` — or something already in the graph, in which case
     * the id is the owner. A plan that outlines an area and then places a
     * tree on it is two things; one that outlines an area and marks a
     * position on the SAME area is one.
     */
    const raw = subjectArg === undefined ? undefined : entry.call.args[subjectArg];
    const planned = planRefName(raw);
    const standing = typeof raw === "string" ? raw : undefined;
    const owner = planned ?? standing ?? entry.dependsOn[0];
    const at = owner === undefined ? undefined : byOwner.get(owner);
    if (at !== undefined) {
      rows[at] = { ...rows[at]!, entries: [...rows[at]!.entries, entry] };
      continue;
    }
    const key = owner ?? `${entry.call.mutation}:${entry.at}`;
    byOwner.set(key, rows.length);
    rows.push({
      key,
      ...(planned !== undefined ? { name: planned } : {}),
      ...(standing !== undefined ? { about: standing } : {}),
      entries: [entry],
    });
  }
  return rows;
}

/**
 * What to call a row — the THING, wherever its name can be found.
 *
 * A call that makes something carries the name in its arguments. A call that
 * acts on something already standing does not, and asking it to would be
 * asking a plan to repeat what the graph already knows: the node is right
 * there with a label on it. Only when neither holds a name does the row fall
 * back to reading as the act, which is the case where the act IS the only
 * thing there is to say.
 */
function labelOf(
  row: PlanRow,
  titleOf: (mutation: string) => { readonly title?: string } | undefined,
  labelIn: (id: string) => string | undefined,
): { readonly text: string; readonly named: boolean } {
  const first = row.entries[0]!;
  const label = first.call.args["label"];
  if (typeof label === "string" && label.length > 0) return { text: label, named: true };
  const standing = row.about === undefined ? undefined : labelIn(row.about);
  if (standing !== undefined && standing.length > 0) return { text: standing, named: true };
  return { text: titleOf(first.call.mutation)?.title ?? first.call.mutation, named: false };
}

const planRefName = (value: unknown): string | undefined =>
  typeof value === "object" && value !== null && typeof (value as { $plan?: unknown }).$plan === "string"
    ? (value as { $plan: string }).$plan
    : undefined;

/**
 * WHAT A MODEL WANTS TO DO, BEFORE IT DOES IT.
 *
 * In the order it will run, with what it makes counted, and the refusals
 * struck through with their reason rather than dropped — the same honesty
 * the actions strip gives a seat that may not act. Applying is one press and
 * one turn, so taking it back is one press too.
 */
/*
 * THE REVIEW'S PARTS SAY WHAT THEY ARE, and their look is a rule rather
 * than a style attribute, so a product dressing its review reaches them with
 * `[data-graview-part="plan-apply"]` and no `!important`. Written at the
 * weight of two elements: above the theme's bare `button` rule, which
 * arrives later as an adopted sheet and would otherwise win the tie, and
 * below any attribute or class an app writes.
 */
const PLAN_REVIEW_CSS = `
ol li:where([data-graview-part="plan-row"][data-plan-refused]),
ol li:where([data-graview-part="plan-row"][data-plan-declined]) {
  text-decoration: line-through;
  opacity: 0.6;
}
li > button:where([data-graview-part="plan-decline"]) {
  margin-left: 8px;
  min-height: max(1.5rem, 24px);
  padding: 0 8px;
  font-size: 0.8125rem;
  text-decoration: none;
}
div:where([data-graview-part="plan-actions"]) {
  display: flex;
  gap: 8px;
}
div > button:where([data-graview-part="plan-apply"]),
div > button:where([data-graview-part="plan-discard"]) {
  min-height: max(1.5rem, 24px);
  padding: 2px 12px;
}
`;

export function PlanReview<S extends AnySchema>(props: PlanReviewProps<S>) {
  return (
    <Lifted what="PlanReview" {...(props.store ? { store: props.store } : {})} {...(props.principal ? { principal: props.principal } : {})}>
      <PlanReviewInside {...props} />
    </Lifted>
  );
}

function PlanReviewInside<S extends AnySchema>({
  plan,
  onApplied,
  onDiscard,
  title = "What this would do",
  declinable = false,
  options,
  also,
  header,
  bare = false,
  batch,
}: PlanReviewProps<S>) {
  const { store, principal, noteSeat } = useGraview<S>();
  const [done, setDone] = useState<{ batch: string; applied: number; why?: string } | null>(null);
  const [declined, setDeclined] = useState<readonly string[]>([]);
  /* What is left after the declines, ordered and judged like any other plan. */
  const kept = declined.length === 0 ? plan : without(store, plan, declined, options ?? {});
  const titleOf = (mutation: string) => store.allMutations().find((m) => m.name === mutation);
  const rows = rowsOf(plan, (mutation) => {
    const declared = titleOf(mutation);
    return {
      ...(declared?.subject?.arg ? { subjectArg: declared.subject.arg } : {}),
      makes: (declared?.creates?.length ?? 0) > 0,
    };
  });
  const named = (id: string) => (store.graph.getNode(id) as { label?: string } | undefined)?.label;
  const shown = new Map(rows.map((row) => [row.key, labelOf(row, titleOf, named)] as const));
  /*
   * THE LEAST SURE FIRST. A plan whose calls carry a confidence is read in
   * that order — the row a model was least sure of is the one a person
   * should read first, and the survey's review already knew it. A plan
   * that carries none keeps the order it will run in. Display only: the
   * press applies the plan in its own order regardless.
   */
  const sureOf = (row: PlanRow): number | undefined => {
    const held = row.entries.map((entry) => entry.call.confidence).filter((c): c is number => typeof c === "number");
    return held.length > 0 ? Math.min(...held) : undefined;
  };
  const anySure = rows.some((row) => sureOf(row) !== undefined);
  const ordered = anySure
    ? [...rows].sort((a, b) => (sureOf(a) ?? 1) - (sureOf(b) ?? 1))
    : rows;
  const names = new Map(
    rows.flatMap((row) => (row.name === undefined ? [] : [[row.name, shown.get(row.key)!.text] as const])),
  );
  /* "1 zone, 2 features" — the kind's own word when there is one of it. */
  const makes = Object.entries(kept.makes)
    .map(
      ([kind, count]) =>
        counted(store.schema, kind, count),
    )
    .join(", ");
  /*
   * WHAT CARRIED IT OUT. A row struck through because something it points
   * at was declined says which one, by name: "goes with Back Lawn". A count
   * on the parent is only useful while the parent is on screen, and the
   * thing a person is looking at when they wonder is the child.
   */
  const carriedBy = new Map<string, string>();
  for (const name of declined) {
    for (const entry of dependentsOf(plan, name)) {
      const row = rows.find((one) => one.entries.includes(entry));
      if (row === undefined || row.name === name) continue;
      if (row.name !== undefined && declined.includes(row.name)) continue;
      if (!carriedBy.has(row.key)) carriedBy.set(row.key, name);
    }
  }

  const live = rows.filter(
    (row) =>
      !row.entries.some((entry) => entry.refusal !== undefined) &&
      !(row.name !== undefined && declined.includes(row.name)) &&
      row.entries.some((entry) => kept.entries.some((other) => other.call === entry.call)),
  ).length;

  const Frame = bare
    ? ({ children }: { readonly children: ReactNode }) => (
        <div>
          <p style={{ margin: "0 0 .4rem", fontSize: "0.875rem", ...MUTED_TEXT }}>
            {`${live} of ${rows.length} to run${makes ? `, making ${makes}` : ""}.`}
          </p>
          {children}
        </div>
      )
    : ({ children }: { readonly children: ReactNode }) => (
        <Panel title={title} subtitle={`${live} of ${rows.length} to run${makes ? `, making ${makes}` : ""}.`} fit>
          {children}
        </Panel>
      );

  return (
    <Frame>
      <style>{PLAN_REVIEW_CSS}</style>
      {header}
      {anySure ? (
        <p data-testid="plan-least-sure" style={{ margin: "0 0 .4rem", fontSize: "0.8125rem", ...MUTED_TEXT }}>
          Least sure first.
        </p>
      ) : null}
      <ol data-testid="plan" style={{ margin: 0, paddingLeft: markerRoom(ordered.length), display: "grid", gap: 6 }}>
        {ordered.map((row) => {
          const sure = sureOf(row);
          const first = row.entries[0]!;
          const refused = row.entries.find((entry) => entry.refusal !== undefined);
          const name = row.name;
          const out =
            refused !== undefined ||
            (name !== undefined && declined.includes(name)) ||
            !kept.entries.some((other) => other.call === first.call);
          /* What would go with it, said before the press rather than after. */
          const goesWith =
            name === undefined
              ? []
              : [...dependentsOf(plan, name)].filter((entry) => !row.entries.includes(entry));
          /*
           * The follow-ups, in the product's words where it has any. When
           * the row is named by the thing, the FIRST act is a follow-up too
           * — "Back Lawn / drawn with 4 corners". When it is named by the
           * act, the first one has already been said.
           */
          const rest = row.entries
            .slice(shown.get(row.key)!.named ? 0 : 1)
            .map((entry) => also?.(entry, names) ?? titleOf(entry.call.mutation)?.title ?? entry.call.mutation)
            .filter((part): part is string => Boolean(part))
            .join(" · ");
          return (
            <li
              key={row.key}
              data-plan-row={row.key}
              data-plan-refused={refused ? "" : undefined}
              data-plan-declined={out && !refused ? "" : undefined}
              data-graview-part="plan-row"
            >
              <span>{shown.get(row.key)!.text}</span>
              {first.call.why ? <span style={{ ...MUTED_TEXT }}> — {first.call.why}</span> : null}
              {sure !== undefined ? (
                <span
                  data-testid="plan-sure"
                  data-plan-sure={sure.toFixed(2)}
                  title="How sure the proposer was"
                  style={{ marginLeft: 6, fontSize: "0.75rem", color: sure < 0.5 ? "var(--graview-warn)" : "var(--graview-ink-faint)" }}
                >
                  {Math.round(sure * 100)}% sure
                </span>
              ) : null}
              {declinable && !refused && name !== undefined && !done ? (
                <button
                  type="button"
                  data-testid={`plan-decline-${name}`}
                  data-graview-part="plan-decline"
                  title={
                    goesWith.length > 0
                      ? `Declining this also drops ${goesWith.length} that point at it`
                      : "Drop this one"
                  }
                  onClick={() =>
                    setDeclined((current) =>
                      current.includes(name) ? current.filter((one) => one !== name) : [...current, name],
                    )
                  }
                >
                  {declined.includes(name) ? "Keep it" : "Not this"}
                </button>
              ) : null}
              {rest ? (
                <div data-testid={`plan-also-${row.key}`} style={{ fontSize: "0.8125rem", textDecoration: "none", ...MUTED_TEXT }}>
                  {rest}
                </div>
              ) : null}
              {declinable && carriedBy.has(row.key) ? (
                <div
                  data-testid={`plan-carried-${row.key}`}
                  style={{ fontSize: "0.8125rem", textDecoration: "none", ...MUTED_TEXT }}
                >
                  goes with {names.get(carriedBy.get(row.key)!) ?? carriedBy.get(row.key)}
                </div>
              ) : null}
              {declinable && goesWith.length > 0 && !refused ? (
                <div data-testid="plan-goes-with" style={{ fontSize: "0.8125rem", textDecoration: "none", ...MUTED_TEXT }}>
                  {goesWith.length} {goesWith.length === 1 ? "other goes" : "others go"} with it.
                </div>
              ) : null}
              {refused ? (
                <div data-testid="plan-refusal" style={{ fontSize: "0.8125rem", color: "var(--graview-warn)", textDecoration: "none" }}>
                  {refused.refusal!.message}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {done ? (
        <p data-testid="plan-done" style={{ margin: 0, fontSize: "0.875rem", ...MUTED_TEXT }}>
          {done.why
            ? `Stopped after ${done.applied}: ${done.why}`
            : `Done — ${done.applied} applied as one turn.`}
        </p>
      ) : (
        <div data-graview-part="plan-actions">
          <button
            type="button"
            data-testid="plan-apply"
            data-graview-part="plan-apply"
            disabled={kept.ready.length === 0}
            onClick={() => {
              const result = applyPlan(store, kept, {
                ...(principal ? { author: principal } : {}),
                ...(batch ? { batch } : {}),
                /*
                 * The seat's body walks to each target BEFORE the op lands,
                 * in the plan's order: cause and effect co-located, and the
                 * mark then lights where it is standing.
                 */
                before: (entry, args) => {
                  if (!principal || principal.kind !== "agent") return;
                  const subject = store.allMutations().find((m) => m.name === entry.call.mutation)?.subject?.arg;
                  const target = subject ? args[subject] : undefined;
                  noteSeat({ type: "about-to-write", author: principal, ids: typeof target === "string" ? [target] : [] });
                },
              });
              setDone({
                batch: result.batch,
                applied: result.applied,
                ...(result.stoppedAt ? { why: result.stoppedAt.why } : {}),
              });
              onApplied?.(result.batch, result.applied);
            }}
          >
            Apply {kept.ready.length === 1 ? "it" : "all"}
          </button>
          {onDiscard ? (
            <button type="button" data-testid="plan-discard" data-graview-part="plan-discard" onClick={onDiscard}>
              Discard
            </button>
          ) : null}
        </div>
      )}
    </Frame>
  );
}

/** The long edge, in pixels. Enough to see a blockage, not a print. */
export const PHOTO_MAX_EDGE = 1280;
/** JPEG quality. What a model is asked to look at is texture, not a print. */
export const PHOTO_QUALITY = 0.7;

/**
 * A file from a camera or the filesystem, down to something sendable.
 *
 * Browser-only: it is the one part of the photograph path that needs a
 * canvas. It ALWAYS re-encodes, even when the original is small, so what
 * comes out is one known format rather than whatever the phone produced —
 * HEIC and 12-bit PNGs both arrive here and neither belongs in a snapshot
 * or on the wire.
 *
 * Every product that lets a model look at something wrote this, and the one
 * that did not sent six megabytes per frame and wondered why it was slow.
 */
export async function downscale(
  file: Blob,
  maxEdge = PHOTO_MAX_EDGE,
  quality = PHOTO_QUALITY,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("This browser will not give us a canvas to resize with.");
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}

export interface IntakeProps {
  /** Data URLs, in the order they were given, already made smaller. */
  readonly onPhotos: (photos: readonly string[]) => void;
  readonly accept?: string;
  readonly label?: string;
  /**
   * The most one ask may carry. A model's context is finite and so is the
   * patience of whoever is waiting, so this is a number a product states
   * rather than a wall it discovers.
   */
  readonly most?: number;
  /** How many are already chosen, when the product is holding them. */
  readonly chosen?: number;
  /** The long edge to resize to before handing them over. */
  readonly maxEdge?: number;
  readonly quality?: number;
  /** Said when more were offered than there was room for. */
  readonly onTrouble?: (message: string) => void;
}

/**
 * PHOTOGRAPHS IN. A drop zone and a file input over one handler, because a
 * product that lets a model look at something has to get the something in,
 * and every one of them wrote this — including the downscaling, which is
 * not a detail: a phone photograph is three to six megabytes, and a dozen
 * of them at full size will exhaust a browser's whole storage quota and
 * lose the graph along with them.
 *
 * It says what it does, every time, because "and none is kept" is the
 * sentence a person actually wants before they hand over pictures of their
 * house.
 */
export function Intake({
  onPhotos,
  accept = "image/*",
  label = "Photographs",
  most,
  chosen = 0,
  maxEdge,
  quality,
  onTrouble,
}: IntakeProps) {
  const [over, setOver] = useState(false);
  const take = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const offered = [...files];
    const room = most === undefined ? offered.length : most - chosen;
    if (room <= 0) {
      onTrouble?.(`There is room for no more — ${most} is the most one ask may carry. Send the rest as a second ask.`);
      return;
    }
    if (offered.length > room) {
      onTrouble?.(
        `That is ${offered.length} photographs and there is room for ${room} more — ${most} is the most one ask ` +
          `may carry. The first ${room} were kept; send the rest as a second ask.`,
      );
    }
    try {
      const read: string[] = [];
      for (const file of offered.slice(0, room)) read.push(await downscale(file, maxEdge, quality));
      onPhotos(read);
    } catch (error) {
      onTrouble?.(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <label
      data-testid="intake"
      data-intake-over={over || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        void take(event.dataTransfer?.files ?? null);
      }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        minHeight: "4rem",
        padding: "var(--graview-pad-sm, 8px)",
        border: `1px dashed ${over ? "var(--graview-accent)" : "var(--graview-edge)"}`,
        borderRadius: "var(--graview-radius-sm, 8px)",
        color: "var(--graview-ink-muted)",
        fontSize: "0.875rem",
        cursor: "pointer",
      }}
    >
      <span>{label} — drop them here, or choose</span>
      <span data-testid="intake-terms" style={{ fontSize: "0.8125rem" }}>
        {most === undefined ? "" : `${chosen} of ${most} chosen — `}each is made smaller before it is sent, and none
        is kept
      </span>
      <input
        type="file"
        multiple
        accept={accept}
        onChange={(event) => void take(event.target.files)}
        data-testid="intake-files"
        /*
         * TRANSPARENT AND FULL-BLEED, not visually hidden.
         *
         * The obvious way to hide a file input is the visually-hidden
         * pattern, and a product's own accessibility audit caught what that
         * costs: the input is still focusable and still a control, so it is
         * a 1x1 target with a 1x1 focus ring, and a keyboard lands on
         * something nobody can see. Stretching it over the whole box
         * instead keeps the native picker, keeps the drop zone, and makes
         * the target the size the box already is.
         */
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
      />
    </label>
  );
}

export interface DoorProps {
  /** The declared provider this door is for. */
  readonly provider: string;
  /** What to ask it, built by the app from its own graph. */
  readonly prompt: string;
  readonly photos?: readonly string[];
  /** Proposals read out of whatever came back. */
  readonly onProposals: (proposals: readonly PlannedCall[]) => void;
}

/**
 * THE DOORS A PROVIDER DECLARED, drawn.
 *
 * `reach: ["paste", "local"]` is the declaration; this is what it looks like.
 * Paste is the floor and works everywhere — a prompt to copy out, an answer
 * to paste back — and needs no key, no network and no permission. `local` is
 * the machine under the dev server, offered only when something is actually
 * answering there. A door the provider did not declare is not drawn.
 */
export function Door<S extends AnySchema>({ provider, prompt, photos = [], onProposals }: DoorProps) {
  const { store } = useGraview<S>();
  const declared = store.intelligence.find((candidate) => candidate.name === provider);
  const reach = declared?.reach ?? [];
  const local = useLocalIntelligence(declared?.bridge);
  const [pasted, setPasted] = useState("");
  const [said, setSaid] = useState<string | null>(null);

  const read = (text: string) => {
    const answer = firstJsonObject(text) as { proposals?: readonly PlannedCall[] } | null;
    /*
     * A model names things the way a person does, so a label that means
     * exactly one node is read as that node before the gate sees it — as
     * the seat reads it. `resolveProposal` keeps the rest of the call.
     */
    const proposals = (Array.isArray(answer?.proposals) ? answer!.proposals : []).map(
      (proposal) => resolveProposal(store, proposal) as PlannedCall,
    );
    const kept = validateProposals(store, proposals, declared?.may) as readonly PlannedCall[];
    if (kept.length === 0) {
      setSaid("Nothing in that answer was a call this app knows, so nothing was taken from it.");
      return;
    }
    setSaid(null);
    /*
     * `as`, `why` and `confidence` are the model's own and survive
     * validation: the gate keeps or drops each call whole. Reading them
     * back by position from the answer handed a call the name of whichever
     * call had stood in its place before the gate dropped one.
     */
    onProposals(kept);
  };

  if (!declared) return null;
  /*
   * A DOOR IS FOR PROSE. Every door here carries words out and words back
   * — a prompt copied, an answer pasted, a process asked on this machine —
   * and a decision provider has none to give: it answers typed questions
   * with typed answers, through the questions the declaration derives, not
   * through a prompt. Drawing it a door would be offering a chat to a
   * thing that cannot talk.
   */
  if (!providerCan(declared, "prose")) return null;
  return (
    <div data-testid="door" data-door-reach={reach.join(",")} style={{ display: "grid", gap: 8 }}>
      {reach.includes("local") ? (
        <div>
          <button
            type="button"
            data-testid="door-local"
            disabled={local.state !== "open"}
            onClick={() => {
              if (local.state !== "open") return;
              void local
                .ask(prompt, photos)
                .then(read)
                .catch((error: unknown) => setSaid(error instanceof Error ? error.message : String(error)));
            }}
            style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}
          >
            {local.state === "open" ? `Ask ${provider} on this machine` : "Nothing running on this machine"}
          </button>
          {local.state === "closed" ? (
            <div style={{ fontSize: "0.8125rem", ...MUTED_TEXT }}>{local.reason}</div>
          ) : null}
        </div>
      ) : null}

      {reach.includes("paste") ? (
        <div style={{ display: "grid", gap: 6 }}>
          <button
            type="button"
            data-testid="door-copy"
            onClick={() => void navigator.clipboard?.writeText?.(prompt)}
            style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}
          >
            Copy the prompt
          </button>
          <label style={{ display: "grid", gap: 4, fontSize: "0.875rem", ...MUTED_TEXT }}>
            Paste the answer
            <textarea
              data-testid="door-paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={4}
              style={{ font: "var(--graview-font-mono, 12px ui-monospace)", padding: 6 }}
            />
          </label>
          <button
            type="button"
            data-testid="door-read"
            disabled={pasted.trim().length === 0}
            onClick={() => read(pasted)}
            style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}
          >
            Read it
          </button>
        </div>
      ) : null}

      {said ? (
        <p data-testid="door-said" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-warn)" }}>
          {said}
        </p>
      ) : null}
    </div>
  );
}
