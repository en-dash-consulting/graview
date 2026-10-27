import { ARCHIVED, freshAddress, humanizeField, isWithheld, labelOf, nameOfAuthor, type AnySchema, type Author, type Batch, type Operation } from "@graview/core";
import { viaSaid } from "@graview/core/words";
import { lineageWords } from "@graview/core/provenance";
import { digestWords, foldDigests, typedRowWords } from "@graview/core/tidying";
import { lazyModule, POPOVER_STYLE, useGoTo, useGraview, useLiveStore, usePlayback, usePopover } from "@graview/react/provider";
import { prefetchTimeline } from "../past-bar.js";
import type { ToolCall } from "@graview/tools";
import { Suspense, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { VISUALLY_HIDDEN } from "../primitives/index.js";
import { NamedRecord } from "./named-record.js";
import { ACTIVITY_CHIPS, ACTIVITY_HEAD, ACTIVITY_ROW, ACTIVITY_WORDS } from "./activity-rows.js";
import { nameOf } from "./answer-args.js";
import { NotifiedDoor, useNotifiedCount } from "../notify-door.js";
import { useInteractions, type ActivityShows } from "./ai-feed.js";
import type { AiInteraction } from "@graview/core/catalog";
import { retryingImport } from "@graview/core/retry";

/* The AI's rows and its filter, fetched with the first entry there is to draw (Roadmap f-activity-ai-entries). */
const aiRows = /* @__PURE__ */ lazyModule(retryingImport(() => import("./ai-entries.js")));
const InteractionRow = /* @__PURE__ */ aiRows.part((module, props: { readonly entry: AiInteraction; readonly undo: (batch: string) => ReactNode }) => <module.InteractionRow {...props} />, { quiet: true, as: "li" });
const ActivityFilter = /* @__PURE__ */ aiRows.part((module, props: ComponentProps<typeof import("./ai-entries.js").ActivityFilter>) => <module.ActivityFilter {...props} />, { quiet: true, as: "div" });


export interface Change {
  readonly intent: string;
  readonly author: string;
  /** The author's own id, for seats that are not the person at the keyboard. */
  readonly authorId?: string;
  /** The whole author — their own name, and who they acted for (FR-06, FR-17). */
  readonly by?: Author;
  /** What the change came through, when it said ("via Claude"). */
  readonly via?: string;
  /** What it was based on and how sure, in words, when its maker said (FR-172). */
  readonly basis?: string;
  readonly touched: readonly string[];
  /**
   * What a record it touched was called, read from the records the log
   * carries — its adding or its removal, in this change or a later one —
   * since a record taken back or removed is no longer in the graph to ask.
   */
  readonly named?: Readonly<Record<string, string>>;
  readonly batch: string;
  /**
   * A RUN OF TYPING (Roadmap f-collab-text): one person's consecutive runs
   * into one field, one row — every batch, oldest first, taken back
   * together; `batch` is the last.
   */
  readonly batches?: readonly string[];
  /** When it was made. */
  readonly at?: string;
  /** The AI interaction it came from (lineage `interaction`), whose entry draws it. */
  readonly interaction?: string;
  /** The moment just after it: `pastOf(store, seq)` shows the app as it was once it was made (Roadmap f-playback). */
  readonly seq: number;
  /**
   * A CHANGE YOU CANNOT SEE (FR-16): every op of it was withheld from this
   * seat. Shown as having happened, with nothing it touched and no undo.
   */
  readonly withheld?: true;
  /**
   * A DIGEST: consecutive batches by the app's own actor, folded into one
   * row ("Tidied 6 things today"), which expands to each change with its
   * own undo and lineage, newest first. A person's change and a chat
   * seat's never fold.
   */
  readonly digest?: readonly Change[];
}

/** Whether an op takes a record out of the counts: removes it, or sets it aside (an archive, or the one a merge folds away). */
const takesOut = (op: Operation): boolean =>
  // An undo says what it took back in its own intent.
  op.undoes === undefined &&
  op.primitives.some((primitive) => primitive.op === "remove-node" || (primitive.op === "patch-node" && primitive.after[ARCHIVED] === true && primitive.before[ARCHIVED] !== true));

/**
 * WHAT A BATCH'S ROW SAYS (Roadmap f-activity-names-merges): what it was
 * for — its caller's own words, an agent's "Cursor: merge-actor,
 * edit-threat", else its first op's sentence — and then, by each op's own
 * sentence, every one that takes a record out of the counts: "Merge
 * @tanstack/react-router into @tanstack/*", a removal, an archive. A count
 * that drops (software 79 → 78) is then said where the change is, whatever
 * the batch called itself. An op this seat may not see is not said.
 */
export function batchWords(batch: Pick<Batch, "intent" | "ops">): string {
  const out = [...new Set(batch.ops.filter((op) => !isWithheld(op) && takesOut(op)).map((op) => op.intent))].filter((said) => said !== batch.intent);
  return out.length === 0 ? batch.intent : `${batch.intent} — ${out.join("; ")}`;
}

/** One batch as a row of Activity. */
const changeOf = (store: { readonly schema: AnySchema }, batch: Batch, carried: ReadonlyMap<string, string> = carriedNames(store, [batch])): Change => ({
  intent: batchWords(batch),
  author: batch.author.kind,
  ...(batch.author.id ? { authorId: batch.author.id } : {}),
  by: batch.author,
  ...(batch.ops[0]?.via ? { via: batch.ops[0].via } : {}),
  ...(batch.lineage ? { basis: lineageWords(batch.lineage) } : {}),
  // What a withheld op touched is not said, even the part this seat may see.
  touched: [...new Set(batch.ops.filter((op) => !isWithheld(op)).flatMap((op) => op.writes))],
  ...namesOf(batch.ops.filter((op) => !isWithheld(op)).flatMap((op) => op.writes), carried),
  batch: batch.id,
  at: batch.at,
  ...(batch.lineage?.interaction ? { interaction: batch.lineage.interaction } : {}),
  seq: batch.ops.at(-1)!.seq + 1,
  ...(batch.ops.every(isWithheld) ? { withheld: true as const } : {}),
});

/**
 * The last few changes, with who made them — READ FROM THE LOG, not
 * accumulated from a subscription.
 *
 * The difference showed up the moment the desk started recording its own
 * navigation: opening an app unmounts the rail, so the subscription version
 * lost exactly the change it had just made, and anything that happened before
 * the rail first mounted had never been there at all. The op log is the
 * state; deriving from it means nothing is lost by a component coming and
 * going, which is the whole reason history is a fold rather than a stack.
 *
 * A human edit and an agent edit render the same way, because the log cannot
 * tell them apart.
 */
export function useRecentChanges(limit = 4): readonly Change[] {
  const { store: shown, principal } = useGraview<AnySchema>();
  /* What has happened is now's, whichever moment the face draws (Roadmap f-playback). */
  const store = useLiveStore(shown, principal);
  const length = store.log.length;
  /*
   * A suggestion and its declining are the Suggested tray's to say, not
   * rows here; a run of the app's own actor's batches is one row, a digest
   * (`foldDigests`).
   */
  return useMemo(() => {
      const batches = store.batches();
      const carried = carriedNames(store, batches);
      return foldDigests(batches, (id) => store.log.get(id))
        .reverse()
        .slice(0, limit)
        .map((row): Change => {
          if ("batch" in row) {
            const change = changeOf(store, row.batch, carried);
            // Typing, said as one: "Wrote in Notes (+42 −3)", the record beside it as every row names one.
            return row.typed ? { ...change, intent: typedRowWords(row.typed, store.schema, store.graph), batches: row.typed.batches.filter((batch) => !batch.undone).map((batch) => batch.id) } : change;
          }
          const changes = [...row.digest.batches].reverse().map((batch) => changeOf(store, batch, carried));
          return {
            // Today on the app's clock, as the digest's own day is read: a UTC today called an evening's tidying "on Oct 18" on Oct 18.
            intent: digestWords(row.digest),
            author: row.digest.author.kind,
            ...(row.digest.author.id ? { authorId: row.digest.author.id } : {}),
            by: row.digest.author,
            touched: [...new Set(changes.flatMap((change) => change.touched))],
            batch: "",
            ...(changes[0]?.at ? { at: changes[0].at } : {}),
            seq: changes[0]?.seq ?? 0,
            digest: changes,
          };
        });
    },
    // The log only grows at its end, an undo too: its length says when to read it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, length, limit],
  );
}

/**
 * THE NAME OF EVERY RECORD THE LOG CARRIES WHOLE: an add carries the record
 * it made and a removal the record it took, so a record since taken back
 * is named by them, never shown by its id. A vendor added and then taken
 * back left its adding row saying "vendor:scene-way-one" — its removal was
 * named, its adding was not. The latest carrying wins: the name it last had.
 * A withheld op says nothing, not even a name.
 */
function carriedNames(store: { readonly schema: AnySchema }, batches: readonly Batch[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const batch of batches)
    for (const op of batch.ops)
      if (!isWithheld(op))
        for (const primitive of op.primitives as readonly { readonly op: string; readonly node?: { readonly id: string; readonly kind: string } }[])
          if ((primitive.op === "add-node" || primitive.op === "remove-node") && primitive.node) names.set(primitive.node.id, labelOf(store.schema.tryDefinition(primitive.node.kind), primitive.node as never));
  return names;
}

/** The carried names of the records a change touched. */
function namesOf(touched: readonly string[], carried: ReadonlyMap<string, string>): { readonly named?: Record<string, string> } {
  const named: Record<string, string> = {};
  for (const id of touched) {
    const name = carried.get(id);
    if (name !== undefined) named[id] = name;
  }
  return Object.keys(named).length > 0 ? { named } : {};
}

/** Who made a change, as Activity says it: "you" for the person at the keyboard, else their name and the channel. */
function Who({ change }: { readonly change: Change }) {
  const { store, principal, seats, people } = useGraview<AnySchema>();
  return (
    <strong style={{ fontWeight: 600 }}>
      {change.author === "human" && change.by?.onBehalfOf === undefined && (change.authorId === undefined || principal.id === undefined || change.authorId === principal.id)
        ? "you"
        : nameOfAuthor(change.by ?? { kind: change.author as never, id: change.authorId }, { graph: store.graph as never, schema: store.schema, seats, people })}
      {viaSaid(change.via) ? <span style={{ fontWeight: 400, color: "var(--graview-ink-muted)" }}>, {viaSaid(change.via)}</span> : null}
    </strong>
  );
}

/**
 * A DIGEST: the app's own actor's run of changes as one row — "Graview,
 * tidying · Tidied 6 things today" — which opens to each change with its
 * own lineage and its own undo, so one of them is taken back without the
 * rest, and the row says how many in the meantime.
 */
function DigestRow({ change, goes }: { readonly change: Change; readonly goes: (id: string) => ((id: string) => void) | null }) {
  const { store } = useGraview<AnySchema>();
  const [open, setOpen] = useState(false);
  const each = change.digest ?? [];
  return (
    <li data-testid="activity-digest" style={{ ...ACTIVITY_ROW, gap: 5 }}>
      <div data-graview-activity-head="" style={ACTIVITY_HEAD}>
        <span data-graview-activity-words="" style={ACTIVITY_WORDS}>
          <Who change={change} /> <span style={{ color: "var(--graview-ink-muted)" }}>{change.intent}</span>
        </span>
        <button
          type="button"
          data-testid="digest-toggle"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          style={{ marginLeft: "auto", flex: "0 0 auto", display: "inline-flex", alignItems: "center", minHeight: 24, minWidth: 24, padding: "1px 8px", fontSize: "0.75rem" }}
        >
          {open ? "Hide" : "Show each"}
        </button>
      </div>
      {open ? (
        <ol data-testid="digest-changes" style={{ margin: 0, padding: "0 0 0 10px", listStyle: "none", display: "grid", gap: 6, borderLeft: "1px solid var(--graview-edge)" }}>
          {each.map((one) => (
            <li key={one.batch} data-testid="digest-change" style={ACTIVITY_ROW}>
              <div data-graview-activity-head="" style={ACTIVITY_HEAD}>
                <span data-graview-activity-words="" style={ACTIVITY_WORDS}>
                  <span style={{ color: "var(--graview-ink-muted)" }}>{one.intent}</span>
                  {one.basis ? <span data-graview-lineage="" style={{ color: "var(--graview-ink-faint)" }}> · {one.basis}</span> : null}
                </span>
                {one.withheld ? null : <UndoTurn batch={one.batch} />}
              </div>
              {one.touched.length > 0 ? (
                <div data-touched={one.touched.join(" ")} style={ACTIVITY_CHIPS}>
                  {one.touched.slice(0, 4).map((id) => (
                    <NamedRecord key={id} id={id} label={store.graph.has(id) ? nameOf(store, id) : (one.named?.[id] ?? nameOf(store, id))} go={goes(id)} testId="activity-record" />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

/**
 * Drop one turn, keeping everything since.
 *
 * Undoing out of order is legal exactly when no later live op read something
 * it wrote — a checkable condition rather than a policy — so when it fails
 * the button says how many other turns would have to come along, which is
 * what the check already returns.
 */
export function UndoTurn({ batch }: { readonly batch: string | readonly string[] }) {
  /*
   * WHO IS UNDOING. Undo is a change and the store judges it like one —
   * "what you may undo is what you may have done" — so it has to be told
   * who is asking, exactly as every act taken from the strip is. It was not:
   * the control called `store.undo(batch)` with no author, so the store
   * judged an anonymous principal, who may do nothing once a policy exists.
   * In any app with one, a person could not take back the edit they had
   * just made, and the row they made it on said "you".
   */
  const { store: shown, principal, noteSeat } = useGraview<AnySchema>();
  /* Taken back from now's log; not offered at all while somebody looks back (Roadmap f-playback). */
  const store = useLiveStore(shown, principal);
  const lookingBack = usePlayback()?.open ?? false;
  const length = store.log.length;
  const [refused, setRefused] = useState<string | null>(null);
  const check = useMemo(
    () => store.canUndo(batch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, batch, length],
  );

  // Offered only when the store would take it back for this seat: an undo shown and then refused is the watch's "offered then refused".
  const may = useMemo(
    () => (check.ok ? store.mayUndo(batch, principal) : { ok: true as const }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, batch, length, principal, check],
  );
  if (lookingBack || (!check.ok && check.ops.length === 0) || !may.ok) return null;
  const blocked = !check.ok;
  const alsoNeeded = blocked ? check.includeBatches : [];

  return (
    <span style={{ marginLeft: "auto", flex: "0 0 auto", display: "grid", justifyItems: "end", gap: 2 }}>
    <button
      type="button"
      data-testid="undo-turn"
      title={
        blocked ? `${check.message} — undo those too` : "Take this back, keeping everything since"
      }
      /*
       * A REFUSAL IS A RESULT, said on the control that asked for it.
       *
       * `store.canUndo` answers the questions the LOG can answer — a later
       * op read what this one wrote — and not the one the SCHEMA answers:
       * taking back a migration that added a required field leaves a node
       * the declaration refuses. That threw out of the click handler, which
       * is an unhandled error in a console nobody is reading and a button
       * that looked like it did nothing.
       */
      onClick={() => {
        setRefused(null);
        try {
          /* Taking an agent's turn back walks its body home: the log and the body agree. */
          const asked = typeof batch === "string" ? [batch] : batch;
          const turned = store.log.all().find((op) => asked.includes(op.batch) && op.author.kind === "agent");
          store.undo(blocked ? [...asked, ...alsoNeeded] : typeof batch === "string" ? batch : [...batch], { author: principal });
          if (turned) noteSeat({ type: "home", author: turned.author });
        } catch (error) {
          setRefused(error instanceof Error ? error.message : String(error));
        }
      }}
      /*
       * A TARGET, not just a word. At 11px in a 1px-tall padding this was a
       * 38x18 control — the only way to take a turn back, and under the 24
       * WCAG 2.2 asks for on both counts. The rail row grows by six pixels;
       * the alternative is an undo you have to aim at.
       */
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        minWidth: 24,
        padding: "1px 8px",
        fontSize: "0.75rem",
        ...(blocked ? { borderColor: "var(--graview-warn)", color: "var(--graview-warn)" } : {}),
      }}
    >
      {blocked ? `undo +${alsoNeeded.length}` : "undo"}
    </button>
      {refused ? (
        <span
          data-testid="undo-refused"
          role="alert"
          style={{ fontSize: "0.75rem", lineHeight: 1.4, color: "var(--graview-warn)", maxWidth: 260, textAlign: "right" }}
        >
          {refused}
        </span>
      ) : null}
    </span>
  );
}

/**
 * "SHOW THE APP AS IT WAS HERE" (Roadmap f-playback): the face draws the
 * app as it stood just after this change, with the timeline to scrub on
 * from there. The timeline is fetched as a pointer comes near.
 */
export function ShowAsItWas({ seq, intent }: { readonly seq: number; readonly intent: string }) {
  const playback = usePlayback();
  if (!playback) return null;
  const here = playback.past?.seq === seq;
  return (
    <button
      type="button"
      data-testid="show-past"
      aria-label={`Show the app as it was after “${intent}”`}
      title="Show the app as it was here"
      aria-pressed={here}
      onPointerEnter={prefetchTimeline}
      onFocus={prefetchTimeline}
      onClick={() => playback.show(seq)}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 24, minWidth: 24, padding: "1px 6px", fontSize: "0.75rem", flex: "0 0 auto" }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M2.5 8 a5.5 5.5 0 1 0 1.6-3.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 2.5 V5.5 H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 5 V8 L10 9.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * What has happened, and what is happening: the agent's tool calls and every
 * applied change, in one list.
 *
 * A diff says what CHANGED and never what was considered, so an agent turn
 * without this is a spinner and a toast. Reads are the interesting half.
 * Every node named here is a target, so checking the work is one click.
 */
/**
 * The way back to the example.
 *
 * An app that remembers its edits in the browser needs a visible way OUT of
 * them: a demo that can be edited into a corner with no exit teaches
 * distrust, and "clear your site data" is not an affordance. The control
 * goes to the same address with `fresh=<a value this tab keeps>`
 * (`freshAddress`) — the framework's own convention, read by
 * `browserStartsFresh` in `@graview/ship`, which honors only the value this
 * tab wrote, never a `?fresh=1` another site linked to — so it is a
 * navigation like any other stop: the seed loads, the flag is dropped from
 * the address, and what you do next is remembered again.
 */
export function StartFresh() {
  const href = () => freshAddress(window.location.href);
  return (
    <a
      href="#fresh"
      data-testid="start-fresh"
      title="Forget every edit made in this browser and return to the example"
      onClick={(event) => {
        event.preventDefault();
        window.location.assign(href());
      }}
      /*
       * The same target the routed face's copy of this link already is
       * (`StartFreshLink` in @graview/pages): inline text at 12px is a
       * 50x16 control, and the fix landed on one face only.
       */
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        minWidth: 24,
        fontSize: "0.8125rem",
        color: "var(--graview-ink-muted)",
        textDecoration: "underline",
        textDecorationColor: "var(--graview-edge-bright)",
        textUnderlineOffset: 3,
      }}
    >
      Start fresh
    </a>
  );
}

export function ActivityRail({
  calls,
  seat,
  remembers = false,
}: {
  readonly calls: readonly ToolCall[];
  /**
   * Whether this browser is remembering the edits. When it is, the popover
   * says so and carries the way back to the example — history is where you
   * would look for the way out of it.
   */
  readonly remembers?: boolean;
  /**
   * The agent seat, if the app gives one. It lives HERE, not in the bar:
   * Activity is "what has happened, and what is happening", which is the
   * agent's own surface and where you would be looking to watch a turn —
   * and a run-a-turn control that is disabled most of the time was a
   * permanently-visible ghost in prime bar space. See the recorded
   * decision on the PRD task "Decide where the agent seat lives".
   */
  readonly seat?: ReactNode;
}) {
  const recent = useRecentChanges();
  const { store: shown, principal, seats, people } = useGraview<AnySchema>();
  /*
   * AI INTERACTIONS ARE ENTRIES OF THE SAME FEED (Roadmap f-activity-ai-
   * entries), newest first among the changes, and a change one of them
   * made is drawn in its entry, not again beside it. All, the changes, or
   * the AI's; everyone's, or only the reader's own.
   */
  const interactions = useInteractions();
  const [shows, setShows] = useState<ActivityShows>("all");
  const [mine, setMine] = useState(false);
  const isMine = (by: Author | undefined) => by !== undefined && (by.id === principal.id || by.onBehalfOf?.id === principal.id) && principal.id !== undefined;
  const drawnIn = new Set(interactions.map((entry) => entry.id));
  const changes = recent.filter((change) => !(change.interaction !== undefined && drawnIn.has(change.interaction)) && (!mine || isMine(change.by)));
  const entries = interactions.filter((entry) => !mine || isMine(entry.by)).slice(0, 4);
  const feed: readonly ({ readonly at: string; readonly change: Change; readonly entry?: undefined } | { readonly at: string; readonly entry: (typeof entries)[number]; readonly change?: undefined })[] = [
    ...(shows === "ai" ? [] : changes.map((change) => ({ at: change.at ?? "", change }))),
    ...(shows === "changes" ? [] : entries.map((entry) => ({ at: entry.at, entry }))),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  /* Named from now's records, whichever moment the face draws (Roadmap f-playback). */
  const store = useLiveStore(shown, principal);
  const running = calls.some((call) => call.phase === "running");
  // Somebody told of changes has Activity to open, though nothing has changed yet.
  const notified = useNotifiedCount();

  /*
   * A POPOVER FROM THE BAR, not a rail pinned over the scene.
   *
   * It was in the way because it was always there, and moving it around the
   * corners did not change that. What happened is chrome — it belongs with
   * the other chrome, opening on demand, in the same language as the problems
   * list, and one of the same family (FR-77). The one thing that must stay
   * visible without opening anything is that an agent is mid-turn, and that
   * is a dot on the button.
   */
  const popover = usePopover("activity");
  const open = popover.open;
  const goTo = useGoTo();
  const playback = usePlayback();
  /* Only a record still in the graph goes anywhere; the popover closes behind the reader as they go, and going there is going to it now, not as it was. */
  const goes = (id: string) => (store.graph.has(id) ? (to: string) => { popover.setOpen(false); if (playback?.past) playback.show(null); goTo.record(to); } : null);

  if (seat === undefined && calls.length === 0 && recent.length === 0 && interactions.length === 0 && !remembers && notified === 0) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="activity-button"
        {...popover.trigger}
        onClick={popover.toggle}
        title={running ? "An agent is working" : "What has happened"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 30,
          padding: "0 8px",
          // A word on the bar like "Lists", not a capsule with a dot that says nothing until an agent is at work.
          borderRadius: 8,
          border: "1px solid transparent",
          background: "transparent",
          boxShadow: "none",
          fontSize: "0.875rem",
          whiteSpace: "nowrap",
          color: running ? "var(--graview-accent)" : "var(--graview-ink-muted)",
        }}
      >
        {running ? <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--graview-accent)" }} /> : null}
        {recent.length > 0 ? recent.length : ""}
        {/* On a phone's bar the word gives its room and the mark stands for it; the word stays its name. */}
        <svg className="graview-activity-mark" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style={{ display: "var(--graview-activity-mark, none)" }}>
          <circle cx="8" cy="8" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.75 V8 L10.25 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="graview-activity-word"> Activity</span>
      </button>

      {/*
        * THE SEAT IS SEATED WHETHER OR NOT THE RAIL IS OPEN. Its body stands
        * in the city from the first frame, docked, and that needs the seat
        * mounted — so while the rail is shut the seat is here, hidden, and
        * moves into the rail's row when it opens.
        */}
      {!open && seat !== undefined ? (
        <div hidden data-testid="agent-seat-seated">
          {seat}
        </div>
      ) : null}
      {open ? (
        // A labeled region, not an aside: it opens from the bar, inside the banner (FR-40).
        <section
          {...popover.pane}
          aria-label="Activity"
          data-testid="activity"
          data-graview-offstage=""
          style={{
            ...POPOVER_STYLE,
            // Never wider than the page, and what it holds wraps rather than widening it (FR-226).
            width: "min(300px, calc(100vw - 16px))",
            maxHeight: "min(52cqh, 460px)",
            overflowX: "hidden",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 9,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          {/* A heading for the region (FR-25), named as its landmark is. */}
          <h2 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>Activity</h2>
          {seat !== undefined ? (
            <div
              data-testid="agent-seat-row"
              style={{
                display: "grid",
                gap: 5,
                paddingBottom: calls.length > 0 || feed.length > 0 ? 9 : 0,
                ...(calls.length > 0 || feed.length > 0
                  ? { borderBottom: "1px solid var(--graview-edge)" }
                  : {}),
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--graview-ink-faint)",
                }}
              >
                The agent's seat
              </span>
              {seat}
            </div>
          ) : null}
          {calls.length > 0 ? (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
              {calls.slice(0, 6).map((call, index) => (
                <li
                  key={`${call.at}:${index}`}
                  style={{ ...ACTIVITY_ROW, gap: 2, fontSize: "0.8125rem" }}
                >
                  <div data-graview-activity-head="" style={ACTIVITY_HEAD}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        flex: "0 0 auto",
                        background:
                          call.phase === "running"
                            ? "var(--graview-accent)"
                            : call.phase === "failed"
                              ? "var(--graview-warn)"
                              : "var(--graview-edge-bright)",
                      }}
                    />
                    {/*
                      * THE ACT'S OWN TITLE, not the name it is registered
                      * under. "changed · close-item" is the tool surface's
                      * identifier read out in the one place a person looks
                      * to see what an agent just did — the same smell as a
                      * card named by its node id. A call that names no
                      * declared mutation (a read tool) is still humanized
                      * rather than printed raw.
                      */}
                    <span data-graview-activity-words="" style={{ ...ACTIVITY_WORDS, color: "var(--graview-ink)" }}>
                      {call.mutating ? "changed" : "read"} ·{" "}
                      {store.allMutations().find((mutation) => mutation.name === call.name)?.title ??
                        humanizeField(call.name)}
                    </span>
                  </div>
                  {/*
                    * WHAT A READ LOOKED AT, where it said: a search names
                    * records, and its query is words, not a thing to point
                    * at. A change, or a read that reports nothing, shows the
                    * ids it was handed.
                    */}
                  {!call.mutating && call.reads && call.reads.length > 0 ? (
                    <div data-testid="activity-reads" style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 12 }}>
                      {/* Once each: a neighborhood read lists a node joined to it twice twice. */}
                      {[...new Set(call.reads)].slice(0, 3).map((id) => (
                        <NamedRecord key={id} id={id} label={nameOf(store, id)} go={goes(id)} testId="activity-record" />
                      ))}
                      {new Set(call.reads).size > 3 ? <span style={{ color: "var(--graview-ink-muted)" }}>+{new Set(call.reads).size - 3}</span> : null}
                    </div>
                  ) : Object.values(call.args).some((value) => typeof value === "string") ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 12 }}>
                      {/*
                        * Keyed by the ARGUMENT, not by what it says: a piece
                        * of kit with the id `trailer` and the type `trailer`
                        * hands one call the same word twice.
                        */}
                      {Object.entries(call.args)
                        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
                        .slice(0, 3)
                        .map(([name, value]) => (
                          <NamedRecord key={name} id={value} label={nameOf(store, value)} go={goes(value)} testId="activity-record" />
                        ))}
                    </div>
                  ) : null}
                  {call.error ? (
                    <div style={{ paddingLeft: 12, color: "var(--graview-warn)" }}>{call.error}</div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {interactions.length > 0 ? (
            <Suspense fallback={null}>
              <ActivityFilter shows={shows} onShows={setShows} mine={mine} onMine={setMine} />
            </Suspense>
          ) : null}
          {feed.length > 0 ? (
            <ol
              data-testid="diff-log"
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 6,
                fontSize: "0.8125rem",
              }}
            >
              {feed.map(({ change, entry }, index) =>
                entry !== undefined ? (
                  <Suspense key={`ai:${entry.id}`} fallback={null}>
                    <InteractionRow entry={entry} undo={(batch) => <UndoTurn batch={batch} />} />
                  </Suspense>
                ) : change.digest ? (
                  <DigestRow key={`digest:${change.digest[0]?.batch ?? index}`} change={change} goes={goes} />
                ) : change.withheld ? (
                  /* SOMETHING YOU CANNOT SEE HAPPENED: said, and nothing more — not who, not what, no undo (FR-16). */
                  <li key={`change:${index}`} data-testid="withheld-change" style={ACTIVITY_ROW}>
                    <span data-touched="" style={{ ...ACTIVITY_WORDS, color: "var(--graview-ink-muted)", fontStyle: "italic" }}>
                      {change.intent}
                    </span>
                  </li>
                ) : (
                <li key={`change:${index}`} data-batch={change.batch} style={ACTIVITY_ROW}>
                  <div data-graview-activity-head="" style={ACTIVITY_HEAD}>
                    <span data-graview-activity-words="" style={ACTIVITY_WORDS}>
                      <strong style={{ fontWeight: 600 }}>
                        {/*
                          * WHO, by its own id. "claude" was hardcoded for
                          * every agent, so the chat seat's turn wore
                          * another seat's name — and a system author (a
                          * calendar sync) would have read as "you".
                          */}
                        {/* "you" is the person at the keyboard, not any
                            human: two seats on one store read each other's
                            work as their own. */}
                        {change.author === "human" && change.by?.onBehalfOf === undefined && (change.authorId === undefined || principal.id === undefined || change.authorId === principal.id)
                          ? "you"
                          : nameOfAuthor(change.by ?? { kind: change.author as never, id: change.authorId }, { graph: store.graph as never, schema: store.schema, seats, people })}
                        {viaSaid(change.via) ? <span style={{ fontWeight: 400, color: "var(--graview-ink-muted)" }}>, {viaSaid(change.via)}</span> : null}
                      </strong>{" "}
                      <span style={{ color: "var(--graview-ink-muted)" }}>{change.intent}</span>
                      {change.basis ? <span data-graview-lineage="" style={{ color: "var(--graview-ink-faint)" }}> · {change.basis}</span> : null}
                    </span>
                    {change.batch ? <ShowAsItWas seq={change.seq} intent={change.intent} /> : null}
                    {change.batch ? <UndoTurn batch={change.batches && change.batches.length > 0 ? (change.batches.length === 1 ? change.batches[0]! : change.batches) : change.batch} /> : null}
                  </div>
                  <div data-touched={change.touched.join(" ")} style={ACTIVITY_CHIPS}>
                    {change.touched.slice(0, 4).map((id) => (
                      <NamedRecord key={id} id={id} label={store.graph.has(id) ? nameOf(store, id) : (change.named?.[id] ?? nameOf(store, id))} go={goes(id)} testId="activity-record" />
                    ))}
                  </div>
                </li>
                ),
              )}
            </ol>
          ) : null}
          {/* WHAT THE READER IS TOLD OF (Roadmap f-notify-subscriptions), each with one press to stop. */}
          <NotifiedDoor style={{ paddingTop: 8, borderTop: "1px solid var(--graview-edge)" }} />
          {remembers ? (
            <div
              data-testid="remembered"
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
                paddingTop: 8,
                borderTop: "1px solid var(--graview-edge)",
                fontSize: "0.8125rem",
                color: "var(--graview-ink-faint)",
              }}
            >
              <span>Remembered in this browser</span>
              <StartFresh />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
