import { counted, layer, type AnySchema, type Principal, type Store, type Via } from "@graview/core";
import { inTopLayer } from "@graview/react/provider";
import { actOnSeveral, actsForSeveral, type SeveralAct, type SeveralOutcome } from "@graview/tools/several";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FOOT_MOVED, placeAtTheFoot } from "./notice-place.js";
import { AnswerArgs } from "./workbench/answer-args.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * THE SELECTION BAR: what is done with the records a list has chosen
 * (`choosing.ts`). Fetched with the first one chosen.
 *
 * It says how many are chosen, to a screen reader as it changes; it offers
 * the acts every chosen record shares (`actsForSeveral`: the derivation's
 * own, in its order, and a choice field's values), with what sets them
 * aside or removes them behind "More"; an act that still has a question
 * asks it once for all of them; and it runs the act over every one as ONE
 * change (`actOnSeveral`) — one batch, one undo, attributed as any act.
 * A record the act may not run on is named with why, stays chosen, and the
 * rest are done.
 *
 * A NOTICE OVER THE FACE, NOT A ROW OF IT: in the top layer, at the foot of
 * what it is about and clear of what stands there (the Ask, a way back),
 * so choosing never moves a row from under the pointer. Opaque, elevated,
 * and gone when the choice is put down.
 */

export interface SeveralBarProps {
  readonly store: Store<AnySchema>;
  /** The chosen records, in the list's order. */
  readonly chosen: readonly string[];
  /** Who acts: judged for, and named in the log. */
  readonly principal?: Principal;
  /** What the rules are judged in (`today`). */
  readonly context?: Readonly<Record<string, unknown>>;
  readonly via?: Via;
  /** What the bar stands at the foot of: the list's frame, or the window. */
  readonly anchor?: () => HTMLElement | null;
  /** How many records the list holds, and choosing every one: offered while fewer are chosen (a phone has no Cmd/Ctrl-A). */
  readonly of?: number;
  readonly onChooseAll?: () => void;
  /** The choice put down: Escape, or the bar's own Clear. */
  readonly onClear: () => void;
  /** An act has run: `still` is what stays chosen (the records refused), and the keyboard goes back to the list. */
  readonly onActed: (still: readonly string[]) => void;
}

/** The outcome as the bar says it: what was done, what was already so, and what was not, each by name. */
function outcomeWords(outcome: SeveralOutcome<AnySchema>): string {
  const parts: string[] = [];
  if (outcome.applied.length > 0 && outcome.intent) parts.push(`${outcome.intent}.`);
  if (outcome.unchanged.length > 0) parts.push(`${outcome.unchanged.length} already so.`);
  if (outcome.allOrNothing) parts.push("None of it was kept.");
  return parts.join(" ");
}

export function SeveralBar({ store, chosen, principal, context, via, anchor, of, onChooseAll, onClear, onActed }: SeveralBarProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((now) => now + 1)), [store]);
  const key = chosen.join("\n");
  const { acts, withheld } = useMemo(
    () => actsForSeveral(store, chosen, { ...(principal ? { principal } : {}), ...(context ? { context } : {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, key, principal, context, tick],
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [asking, setAsking] = useState<SeveralAct | null>(null);
  const [outcome, setOutcome] = useState<SeveralOutcome<AnySchema> | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const moreId = useId();
  const kinds = useMemo(() => [...new Set(chosen.map((id) => store.graph.getNode(id)?.kind as string | undefined))], [store, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = kinds.length === 1 && kinds[0] ? `${counted(store.schema, kinds[0], chosen.length)} chosen` : `${chosen.length} chosen`;
  /*
   * THE FIRST FEW, AND THE REST BEHIND MORE: the derivation's leading acts
   * in the bar (three on a desk, two under a finger, where each is a row of
   * its own), then everything else, and what sets them aside or removes them
   * last. Seven acts in the bar stood over the very list they act on.
   */
  const room = typeof matchMedia === "function" && matchMedia("(pointer: coarse), (max-width: 599px)").matches ? 2 : 3;
  const everyday = acts.filter((act) => !act.more);
  const shown = everyday.slice(0, room);
  const more = [...everyday.slice(room), ...acts.filter((act) => act.more)];

  // A new choice is a new question: what was asked of the last one is put away.
  useEffect(() => {
    setAsking(null);
    setMoreOpen(false);
  }, [key]);

  /* IN THE TOP LAYER, at the foot of what it is about, placed again as the window moves. */
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    if (typeof element.showPopover === "function" && !inTopLayer(element)) {
      try {
        element.showPopover();
      } catch {
        // The toast rung holds it over every rail where the top layer is not there.
      }
    }
    const place = () => {
      placeAtTheFoot(element, anchor?.() ?? null);
      dispatchEvent(new Event(FOOT_MOVED));
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    const grows = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    grows?.observe(element);
    return () => {
      grows?.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      if (element.isConnected && inTopLayer(element)) {
        try {
          element.hidePopover();
        } catch {
          // Gone already.
        }
      }
      dispatchEvent(new Event(FOOT_MOVED));
    };
  }, [anchor]);

  /* ESCAPE PUTS THE CHOICE DOWN — or, while an act is asking, the asking first. */
  const latest = useRef({ asking, onClear });
  latest.current = { asking, onClear };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      const inBar = bar.current?.contains(active) ?? false;
      if (!inBar && (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && active.type !== "checkbox") || active instanceof HTMLSelectElement)) return;
      event.preventDefault();
      event.stopPropagation();
      if (latest.current.asking) {
        setAsking(null);
        return;
      }
      latest.current.onClear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const run = (act: SeveralAct, extra: Readonly<Record<string, unknown>> = {}): readonly string[] | void => {
    const done = actOnSeveral(store, { mutation: act.mutation, subject: act.subject, args: { ...act.args, ...extra }, label: act.label }, chosen, {
      ...(principal ? { author: principal } : {}),
      ...(via ? { via } : {}),
      ...(context ? { context } : {}),
    });
    setAsking(null);
    setMoreOpen(false);
    setOutcome(done.refused.length > 0 || done.applied.length === 0 ? done : null);
    onActed(done.refused.map((one) => one.id));
  };

  const press = (act: SeveralAct) => {
    setOutcome(null);
    setMoreOpen(false);
    if (act.open.length > 0) setAsking(act);
    else run(act);
  };

  const button = (act: SeveralAct) => (
    <button
      key={act.id}
      type="button"
      className="graview-several-act"
      data-testid="several-act"
      data-act={act.id}
      data-mutation={act.mutation}
      {...(act.destructive ? { "data-tone": "warn" } : {})}
      aria-pressed={asking?.id === act.id ? true : undefined}
      onClick={() => press(act)}
    >
      {act.label}
      {act.open.length > 0 ? "…" : ""}
    </button>
  );

  return (
    <div
      ref={bar}
      {...({ popover: "manual" } as Record<string, string>)}
      role="region"
      aria-label="The chosen records"
      className="graview-several-bar"
      data-testid="several-bar"
      data-graview-foot=""
      data-graview-overlay=""
      data-graview-popover=""
      data-graview-offstage=""
      style={BAR}
    >
      <style>{SEVERAL_CSS}</style>
      <div className="graview-several-line">
        <span role="status" aria-live="polite" className="graview-several-count" data-testid="several-count">
          {count}
        </span>
        <div role="group" aria-label={`What to do with the ${chosen.length} chosen`} className="graview-several-acts">
          {shown.map(button)}
          {more.length > 0 ? (
            <button type="button" className="graview-several-act" data-testid="several-more" aria-expanded={moreOpen} aria-controls={moreId} onClick={() => setMoreOpen((now) => !now)}>
              More
            </button>
          ) : null}
          {onChooseAll && of !== undefined && of > chosen.length ? (
            <button type="button" className="graview-several-quiet" data-testid="several-all" onClick={onChooseAll}>
              Choose all {of}
            </button>
          ) : null}
          <button type="button" className="graview-several-quiet" data-testid="several-clear" aria-keyshortcuts="Escape" title="Put the choice down — Escape" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      {moreOpen ? (
        <div id={moreId} role="group" aria-label="More" className="graview-several-acts" data-testid="several-more-acts">
          {more.map(button)}
        </div>
      ) : null}
      {acts.length === 0 ? (
        <p className="graview-several-said" data-testid="several-none">
          {withheld.length > 0 ? `Nothing here can be done to all of them by you: ${withheld[0]!.message}` : "Nothing can be done to all of these at once."}
        </p>
      ) : null}
      {asking ? (
        <div className="graview-several-ask" role="group" aria-label={`${asking.label}, for all ${chosen.length}`} data-testid="several-ask">
          <AnswerArgs store={store} affordance={asking.affordance} onApply={(args) => run(asking, args)} onCancel={() => setAsking(null)} />
        </div>
      ) : null}
      {outcome ? (
        <div role="alert" className="graview-several-said" data-testid="several-outcome">
          {outcomeWords(outcome)}
          {outcome.refused.length > 0 ? (
            <>
              {" "}
              {outcome.refused.length === 1 ? "One was not changed, and is still chosen:" : `${outcome.refused.length} were not changed, and are still chosen:`}
              <ul data-testid="several-refused">
                {outcome.refused.map((one) => (
                  <li key={one.id} data-record={one.id}>
                    “{one.label}” — {one.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const BAR: CSSProperties = {
  position: "fixed",
  inset: "auto",
  margin: 0,
  zIndex: layer("toast"),
  boxSizing: "border-box",
  width: "max-content",
  height: "auto",
  bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
  left: 16,
  overflow: "visible",
};

const SEVERAL_CSS = `
.graview-several-bar{display:grid;gap:8px;padding:8px 10px;border:1px solid var(--graview-edge);border-radius:var(--graview-radius,12px);background:var(--graview-float);color:var(--graview-ink);box-shadow:var(--graview-lift-high);font-size:.875rem;line-height:1.4;max-height:70vh;overflow:auto}
.graview-several-line{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;min-width:0}
.graview-several-count{font-weight:600;white-space:nowrap}
.graview-several-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.graview-several-act,.graview-several-quiet{min-height:32px;padding:0 12px;border-radius:8px;font:inherit;cursor:pointer;box-shadow:none}
.graview-several-act{border:1px solid var(--graview-edge);background:transparent;color:var(--graview-ink);font-weight:600}
.graview-several-act:hover,.graview-several-act[aria-pressed=true],.graview-several-act[aria-expanded=true]{background:color-mix(in srgb,var(--graview-accent) 14%,transparent)}
.graview-several-act[data-tone=warn]{color:var(--graview-warn)}
.graview-several-quiet{border:0;background:none;color:var(--graview-ink-muted);text-decoration:underline;text-underline-offset:2px}
.graview-several-bar :focus-visible{outline:2px solid var(--graview-accent);outline-offset:2px}
.graview-several-said{margin:0;max-width:52ch;overflow-wrap:anywhere}
.graview-several-said ul{margin:4px 0 0;padding-left:18px}
.graview-several-ask{padding:8px 4px 2px;border-top:1px solid var(--graview-edge)}
@media (pointer: coarse){.graview-several-act,.graview-several-quiet{min-height:44px}}
`;
