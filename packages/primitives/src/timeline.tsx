import { layer, momentAsRead, type AnySchema, type Operation, type Principal, type Store } from "@graview/core";
import { makerOf, makerWords, restoreBatches, ticksOf, type Maker, type PlaybackTick } from "@graview/core/history";
import { useGraviewIfAny, useLiveStore, usePlayback } from "@graview/react/provider";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TimelineFace } from "./past-bar.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * THE TIMELINE (Roadmap f-playback): the app's history as a line a person
 * scrubs, one tick per change — marked by who made it, the bigger ticks
 * where the declaration changed, with the sentence it said — and a player
 * that walks it at a speed. While a moment is shown, the face draws the
 * store of that moment (`pastOf`), offering no act; "Back to now" leaves.
 */

const ANYONE: Principal = { kind: "human" };
const SPEEDS = [1, 2, 4, 8] as const;
/** How long a change stands at 1×, in milliseconds. */
const STEP_MS = 900;

const MAKER_WORDS: Record<Maker, string> = { you: "You", person: "A person", agent: "An agent", app: "The app" };
const MAKER_INK: Record<Maker, string> = {
  you: "var(--graview-accent)",
  person: "var(--graview-ink-muted)",
  agent: "var(--graview-activity, var(--graview-good))",
  app: "var(--graview-edge-bright)",
};

/**
 * The stops a scrubber walks: the start, then the moment after each change.
 * Behind the undo horizon, when the host keeps the archive (FR-196), every
 * seq from the start — its gestures are not known until it is read — or,
 * once the host has said where its history stops (FR-213), the moments it
 * kept whole and every seq from where it keeps each change.
 */
function stopsOf(ticks: readonly PlaybackTick[], horizon: number, behind: readonly number[]): number[] {
  return [...new Set([...behind, horizon, ...ticks.map((tick) => tick.seq)])].sort((a, b) => a - b);
}

/** A moment read from the archive, as a tick: the last op folded into it, by whom and what it was. */
function archivedTick(op: Operation, me: Principal): PlaybackTick {
  const withheld = op.withheld === true;
  return {
    seq: op.seq + 1,
    from: op.seq,
    at: op.at,
    batch: op.batch,
    maker: withheld ? "person" : makerOf(op.author, me),
    author: withheld ? undefined : op.author,
    said: op.batchIntent ?? op.intent,
    declaration: false,
    withheld,
  };
}

/** The stop at or before `seq`. */
function indexOf(stops: readonly number[], seq: number): number {
  let at = 0;
  for (let i = 0; i < stops.length; i++) if (stops[i]! <= seq) at = i;
  return at;
}

/** The gestures a "Restore to here" would take back, when this seat may take every one back as one change. */
function restorable<S extends AnySchema>(live: Store<S>, seq: number, principal: Principal): readonly string[] | null {
  const batches = restoreBatches(live, seq);
  if (batches.length === 0) return null;
  const check = live.canUndo(batches);
  if (!check.ok) return null;
  // What you may undo is what you may have done: offered only when every change since is one this seat may make.
  const may = new Set(live.permittedMutations(principal).map((mutation) => mutation.name));
  return check.ops.every((op) => op.mutation !== null && may.has(op.mutation.name)) ? batches : null;
}

export function Timeline({ face }: { readonly face: TimelineFace }) {
  const playback = usePlayback<AnySchema>()!;
  const graview = useGraviewIfAny<AnySchema>();
  const principal = graview?.principal ?? ANYONE;
  const live = useLiveStore(playback.live, principal);
  const length = live.log.length;
  const ticks = useMemo(
    () => ticksOf(live, { me: principal, ...(playback.host?.declarations ? { declarations: playback.host.declarations } : {}) }),
    // The log only grows at its end: its length says when to read it again.
    [live, principal, playback.host, length],
  );
  const horizon = live.log.horizon;
  // Behind the horizon is the host's archive (FR-196): reached when it keeps one, and said to be archived when it does not.
  const archived = horizon > 0 && playback.host?.archived !== undefined;
  const kept = playback.kept;
  const behind = useMemo(() => (!archived ? [] : (kept?.stops ?? Array.from({ length: horizon }, (_, seq) => seq))), [archived, kept, horizon]);
  const stops = useMemo(() => stopsOf(ticks, horizon, behind), [ticks, horizon, behind]);
  const reading = playback.archive;
  const seq = reading?.seq ?? playback.past?.seq ?? length;
  // Where the host's history stops (FR-213): said in a quiet line at a moment made at or before it, or before what its archive keeps.
  const keptLine = playback.host?.kept && (reading?.behindKept || (kept !== undefined && (seq <= kept.through || (kept.from > 0 && seq <= kept.from)))) ? playback.host.kept : undefined;
  const index = indexOf(stops, seq);
  const last = stops.length - 1;
  const folded = seq < horizon && playback.past?.seq === seq ? playback.past.store.log.all().at(-1) : undefined;
  const tick = folded
    ? archivedTick(folded, principal)
    : seq < horizon
      ? undefined
      : ([...ticks].reverse().find((one) => one.seq <= seq && one.seq > (stops[index - 1] ?? -1)) ?? [...ticks].reverse().find((one) => one.seq <= seq));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [refused, setRefused] = useState<string | null>(null);

  // The player: one change at a time, at its speed, stopping at now.
  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => playback.show(stops[index + 1]!), STEP_MS / speed);
    return () => clearTimeout(timer);
  }, [playing, index, last, speed, stops, playback]);

  // Undo stops at the horizon: a moment behind it is looked at, never restored to.
  const restore = useMemo(() => (playback.past && !reading && seq >= horizon ? restorable(live, seq, principal) : null), [playback.past, reading, live, seq, horizon, principal, length]);
  const who = (one: PlaybackTick) =>
    makerWords(one, { graph: live.graph as never, schema: live.schema, ...(graview?.seats ? { seats: graview.seats } : {}), ...(graview?.people ? { people: graview.people } : {}) });
  const asOf = playback.past ? (playback.past.at ? momentAsRead(playback.past.at, graview?.locale) : "the start") : null;
  const caption = reading
    ? reading.refused
      ? "The archive could not be read"
      : reading.behindKept
        ? "Nothing this far back is kept"
        : "Reading the older changes from the archive…"
    : tick
      ? `${who(tick) === "you" ? "You" : who(tick)}: ${tick.said}`
      : "Nothing had happened yet";

  /*
   * ON THE SCENE IT STANDS OVER THE PICTURE'S FOOT, AND SAYS HOW TALL, as a
   * sheet does (`--graview-sheet`): the city is fitted above it and the
   * zoom stands over it. Laid over the city, it stood on a district's
   * problem count, which a press could not reach (W-224).
   */
  const section = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = section.current;
    const picture = element?.parentElement;
    if (face !== "scene" || !element || !picture) return;
    const measure = () => picture.style.setProperty("--graview-sheet", `${Math.ceil(element.getBoundingClientRect().height) + 24}px`);
    measure();
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    watch?.observe(element);
    return () => {
      watch?.disconnect();
      picture.style.removeProperty("--graview-sheet");
    };
  }, [face]);

  const box: CSSProperties =
    face === "scene"
      ? { position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)", width: "min(720px, calc(100% - 32px))", zIndex: layer("rail") }
      : { position: "sticky", top: 0, zIndex: layer("rail"), margin: "0 auto 12px", maxWidth: 960, width: "100%" };

  return (
    <section
      ref={section}
      aria-label="Timeline"
      data-testid="timeline"
      data-graview-past={playback.past ? String(playback.past.seq) : "now"}
      data-graview-offstage=""
      style={{
        ...box,
        boxSizing: "border-box",
        display: "grid",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
        color: "var(--graview-ink)",
        fontSize: "0.8125rem",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px" }}>
        <strong data-testid="as-of" role="status" style={{ fontWeight: 600 }}>
          {reading ? "Archived changes" : asOf ? `As of ${asOf}` : "Now"}
        </strong>
        <span data-testid="timeline-caption" style={{ color: "var(--graview-ink-muted)", minWidth: 0, overflowWrap: "anywhere" }}>
          {caption}
        </span>
        {asOf ? (
          <span style={{ color: "var(--graview-ink-faint)" }} data-testid="past-read-only">
            Nothing changes while you look back.
          </span>
        ) : null}
      </div>

      <div style={{ position: "relative", height: 22 }} aria-hidden="true">
        {/* A tick per change, where the scrubber stops; a change to the declaration stands taller. */}
        {archived ? (
          <span
            data-testid="timeline-archived"
            title="Changes read from the archive as you scrub back"
            style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: `${last === 0 ? 0 : (stops.indexOf(horizon) / last) * 100}%`, borderRadius: 2, background: "var(--graview-edge)" }}
          />
        ) : null}
        {stops.slice(1).map((stop, at) => {
          const one = [...ticks].reverse().find((candidate) => candidate.seq === stop);
          // A seq behind the horizon has no gesture known: the band above stands for them.
          if (!one) return null;
          const left = last === 0 ? 0 : ((at + 1) / last) * 100;
          return (
            <span
              key={`${stop}:${one.batch ?? "declaration"}`}
              data-graview-tick={stop}
              data-maker={one.maker}
              {...(one.declaration ? { "data-declaration": "" } : {})}
              title={`${MAKER_WORDS[one.maker]}: ${one.said}`}
              style={{
                position: "absolute",
                left: `calc(${left}% - 1px)`,
                bottom: 0,
                width: one.declaration ? 4 : 2,
                height: one.declaration ? 22 : 12,
                borderRadius: 2,
                background: one.declaration ? "var(--graview-ink)" : MAKER_INK[one.maker],
                opacity: stop <= seq ? 1 : 0.45,
              }}
            />
          );
        })}
      </div>
      <input
        type="range"
        data-testid="scrubber"
        aria-label="Moment"
        min={0}
        max={last}
        step={1}
        value={index}
        aria-valuetext={asOf ? `As of ${asOf}. ${caption}` : `Now. ${caption}`}
        onChange={(event) => {
          setPlaying(false);
          playback.show(stops[Number(event.currentTarget.value)] ?? length);
        }}
        style={{ width: "100%", margin: 0, accentColor: "var(--graview-accent)" }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          data-testid="play"
          aria-pressed={playing}
          onClick={() => {
            if (!playing && index >= last) playback.show(stops[0]!);
            setPlaying(!playing);
          }}
          style={{ minHeight: 28, minWidth: 64 }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--graview-ink-muted)" }}>
          Speed
          <select data-testid="speed" value={speed} onChange={(event) => setSpeed(Number(event.currentTarget.value) as (typeof SPEEDS)[number])} style={{ minHeight: 28 }}>
            {SPEEDS.map((one) => (
              <option key={one} value={one}>
                {one}×
              </option>
            ))}
          </select>
        </label>
        <span aria-hidden="true" style={{ display: "inline-flex", gap: 10, color: "var(--graview-ink-faint)", flexWrap: "wrap" }}>
          {(Object.keys(MAKER_WORDS) as Maker[])
            .filter((maker) => ticks.some((one) => one.maker === maker))
            .map((maker) => (
              <span key={maker} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: MAKER_INK[maker] }} />
                {MAKER_WORDS[maker]}
              </span>
            ))}
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
          {restore ? (
            <button
              type="button"
              data-testid="restore-here"
              title="Take back every change since, as one change you can undo"
              onClick={() => {
                setRefused(null);
                try {
                  live.undo([...restore], { author: principal, intent: asOf ? `Restore to ${asOf}` : "Restore" });
                  playback.show(null);
                } catch (error) {
                  setRefused(error instanceof Error ? error.message : String(error));
                }
              }}
              style={{ minHeight: 28 }}
            >
              Restore to here
            </button>
          ) : null}
          <button type="button" data-testid="back-to-now" onClick={() => playback.show(null)} style={{ minHeight: 28 }}>
            Back to now
          </button>
        </span>
      </div>
      {refused ? (
        <span role="alert" data-testid="restore-refused" style={{ color: "var(--graview-warn)" }}>
          {refused}
        </span>
      ) : null}
      {reading?.refused ? (
        <span role="alert" data-testid="archive-refused" style={{ color: "var(--graview-warn)" }}>
          {reading.refused}
        </span>
      ) : null}
      {keptLine ? (
        <span data-testid="timeline-kept" style={{ color: "var(--graview-ink-faint)" }}>
          {keptLine.sentence}
          {keptLine.action ? (
            <>
              {" "}
              <a data-testid="timeline-kept-action" href={keptLine.action.href} style={{ color: "var(--graview-ink-muted)" }}>
                {keptLine.action.label}
              </a>
            </>
          ) : null}
        </span>
      ) : null}
      {horizon > 0 && !archived ? (
        <span data-testid="timeline-horizon" style={{ color: "var(--graview-ink-faint)" }}>
          The changes before the timeline's start were archived.
        </span>
      ) : null}
    </section>
  );
}
