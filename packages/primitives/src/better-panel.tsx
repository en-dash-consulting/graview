import { layer } from "@graview/core";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";

/*
 * BETTER UI, A CONVERSATION BESIDE THE PAGE (Roadmap f-make-any-page-better):
 * the person says what should change, and Graview answers in short plain
 * sentences and acts — its steps shown as it takes them ("Looking at
 * Tasks", "Check: dates lost on 3 tasks — fixing"), the time it has taken,
 * and Stop at any moment. A draft that passed is drawn on the page itself,
 * never under the panel: the panel docks at the window's right edge and
 * the page makes room for it (a sheet from the bottom on a phone). Before
 * and After, Keep and Discard are here; the conversation goes on after a
 * draft, and after it is kept.
 */

/** A line of the conversation, as the panel shows it. */
export interface PanelLine {
  readonly who: "person" | "graview";
  readonly said: string;
}

/** A step Graview took, as the panel shows it: done, the one it is on, or one that found something to fix. */
export interface PanelStep {
  readonly text: string;
  readonly kind: string;
}

export interface BetterPanelProps {
  /** What is being changed: “Tasks”. */
  readonly name: string;
  /** Who it changes it for, in a sentence. */
  readonly scope: string;
  readonly phase: string;
  readonly talk: readonly PanelLine[];
  /** This turn's steps, oldest first. */
  readonly steps: readonly PanelStep[];
  /** When this turn began, for its running time. */
  readonly since: number;
  readonly working: boolean;
  /** The draft on the page, in the code's words: what changed. Absent with no draft. */
  readonly draft?: { readonly said: string; readonly before: boolean };
  /** Kept: what the host said, and Undo. */
  readonly kept?: { readonly note?: string; readonly undo?: () => void };
  /** Two drafts failed the same way (said in the conversation): Keep anyway, where the last one drew, or Stop. */
  readonly stuck?: { readonly keepAnyway?: () => void; readonly stop: () => void };
  /** What the person pointed at, said. */
  readonly pointed?: string;
  /** What the conversation is about, by its name: the part right-clicked ("Tasks"), or the one pointed at ("Someday"). */
  readonly about?: string;
  readonly ask: (words: string) => void;
  readonly just: () => void;
  readonly point: () => void;
  readonly stop: () => void;
  readonly compare: (before: boolean) => void;
  readonly keep: () => void;
  readonly discard: () => void;
  readonly close: () => void;
  /** Drawn under the draft's buttons: a rating of what it answered, where the host keeps tellings. */
  readonly children?: ReactNode;
}

const PHONE = 640;
const WIDE = 372;

const DRAWER = 1100;

/** How the panel stands: docked beside the page, a drawer over its right side where the window is narrow, a sheet from the bottom on a phone. */
type Dock = "side" | "drawer" | "sheet";
const dockOf = (): Dock => (typeof innerWidth !== "number" || innerWidth >= DRAWER ? "side" : innerWidth >= PHONE ? "drawer" : "sheet");

/** The app's bar along the top of the window: the shell's, else a header that spans it. */
function barOf(): Element | null {
  const named = document.querySelector('[data-testid="app-bar"]');
  if (named) return named;
  return [...document.querySelectorAll("header")].find((one) => {
    const box = one.getBoundingClientRect();
    return box.top <= 1 && box.width >= innerWidth * 0.8 && box.height > 0;
  }) ?? null;
}

/** What holds the page under the bar: the widest box around the page's own region that is not around the bar too. */
function contentOf(bar: Element | null): HTMLElement | null {
  let at = document.querySelector<HTMLElement>("[data-graview-page-main], main");
  while (at?.parentElement && at.parentElement !== document.body && !(bar && at.parentElement.contains(bar))) at = at.parentElement;
  return at;
}

/**
 * THE PANEL IS PART OF THE PAGE. Beside it, it is docked flush under the
 * app's bar, at the right, down to the window's foot, and what holds the
 * page gives up its width — the bar spans the window as always, and
 * nothing behind the panel shows. Where the window is narrow it is a
 * drawer over the page's right side, and on a phone a sheet from the
 * bottom with room left below the page. Followed each frame: a bar that
 * scrolls away leaves the panel the window's full height.
 */
function useDock(panel: React.RefObject<HTMLElement | null>): Dock {
  const [dock, setDock] = useState<Dock>(dockOf);
  useLayoutEffect(() => {
    const body = document.body.style;
    const bottom = body.paddingBottom;
    let content: HTMLElement | null = null;
    let right = "";
    let frame = 0;
    const give = (to: HTMLElement | null, wide: boolean) => {
      if (content && content !== to) content.style.paddingRight = right;
      if (to && to !== content) right = to.style.paddingRight;
      content = to;
      if (content) content.style.paddingRight = wide ? `${WIDE}px` : right;
    };
    const place = () => {
      const now = dockOf();
      setDock(now);
      const bar = barOf();
      const top = Math.max(0, Math.round(bar?.getBoundingClientRect().bottom ?? 0));
      if (panel.current && now !== "sheet") panel.current.style.top = `${top}px`;
      give(contentOf(bar), now === "side");
      body.paddingBottom = now === "sheet" ? `${Math.round((panel.current?.getBoundingClientRect().height ?? 0) + 16)}px` : bottom;
      frame = requestAnimationFrame(place);
    };
    place();
    return () => {
      cancelAnimationFrame(frame);
      give(null, false);
      body.paddingBottom = bottom;
    };
  }, [panel]);
  return dock;
}

/** Minutes and seconds: "0:42". */
const elapsed = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;

export function BetterPanel(props: BetterPanelProps) {
  const panel = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [, tick] = useState(0);
  const dock = useDock(panel);
  /* The running time, while it works. */
  useEffect(() => {
    if (!props.working) return;
    const timer = setInterval(() => tick((one) => one + 1), 1000);
    return () => clearInterval(timer);
  }, [props.working]);
  /* The newest line in view, and the keyboard in the words field once it is the person's turn. */
  useEffect(() => {
    // Within the conversation only: scrolling the newest line into view must never move the panel, nor hide the first line under its head.
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [props.talk.length, props.steps.length]);
  useEffect(() => {
    if (!props.working) field.current?.focus({ preventScroll: true });
  }, [props.working, props.phase]);
  const lastAsked = props.talk.map((line) => line.who).lastIndexOf("person");
  const steps =
    props.steps.length > 0 ? (
      <li data-testid="better-steps" style={STEPS}>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 3 }}>
          {props.steps.map((step, at) => {
            const now = props.working && at === props.steps.length - 1;
            return (
              <li key={`s${at}`} data-testid="better-step" data-step-kind={step.kind} style={{ display: "flex", gap: 6, alignItems: "baseline", color: now ? "var(--graview-ink)" : "var(--graview-ink-muted)" }}>
                <span aria-hidden="true" style={{ width: 14, flex: "none", color: step.kind === "check" || step.kind === "stuck" ? "var(--graview-warn)" : "var(--graview-accent)" }}>
                  {now ? "…" : step.kind === "check" || step.kind === "stuck" ? "!" : "✓"}
                </span>
                <span>{step.text}</span>
              </li>
            );
          })}
        </ol>
      </li>
    ) : null;
  const empty = props.talk.length === 0;
  return (
    <aside
      ref={panel}
      role="complementary"
      aria-label={`Change how “${props.name}” looks`}
      data-testid="better-panel"
      data-better-phase={props.phase}
      data-better-dock={dock}
      data-graview-popover=""
      style={dock === "sheet" ? SHEET : dock === "drawer" ? DRAWER_STYLE : SIDE}
    >
      <header style={HEAD}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Change how “{props.name}” looks
        </p>
        <button type="button" data-testid="better-close" aria-label="Close" onClick={props.close} style={ICON}>
          ×
        </button>
      </header>
      <p data-testid="better-scope" style={QUIET_LINE}>
        {props.scope}
      </p>
      {props.about ? (
        <p data-testid="better-about" style={CHIP}>
          About: {props.about}
        </p>
      ) : null}
      <ol ref={list} data-testid="better-talk" style={TALK}>
        {props.talk.map((line, at) => (
          <Fragment key={`t${at}`}>
            <li data-testid="better-message" data-who={line.who} style={line.who === "person" ? MINE : THEIRS}>
              {line.said}
            </li>
            {/* This turn's steps stand under the person's last words, before what Graview answered. */}
            {at === lastAsked ? steps : null}
          </Fragment>
        ))}
        {lastAsked < 0 ? steps : null}
      </ol>
      {props.working ? (
        <div style={ROW}>
          <p role="status" aria-live="polite" data-testid="better-working" style={{ margin: 0, flex: 1, color: "var(--graview-ink-muted)" }}>
            Graview is working on “{props.name}” · <span data-testid="better-time">{elapsed(Date.now() - props.since)}</span>
          </p>
          <button type="button" data-testid="better-stop" onClick={props.stop} style={QUIET}>
            Stop
          </button>
        </div>
      ) : null}
      {props.draft && !props.working ? (
        <div data-testid="better-draft" style={{ flexShrink: 0, display: "grid", gap: 6 }}>
          <p data-testid="better-changed" style={{ margin: 0 }}>
            {props.draft.said}
          </p>
          <div style={ROW}>
            <div role="group" aria-label="Compare" style={SWITCH}>
              {(["Before", "After"] as const).map((side) => {
                const on = side === "Before" ? props.draft!.before : !props.draft!.before;
                return (
                  <button key={side} type="button" data-testid={`better-${side.toLowerCase()}`} aria-pressed={on} onClick={() => props.compare(side === "Before")} style={on ? SWITCH_ON : SWITCH_OFF}>
                    {side}
                  </button>
                );
              })}
            </div>
            <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
              <button type="button" data-testid="better-keep" onClick={props.keep} style={PRIMARY}>
                Keep
              </button>
              <button type="button" data-testid="better-discard" onClick={props.discard} style={QUIET}>
                Discard
              </button>
            </span>
          </div>
        </div>
      ) : null}
      {props.stuck && !props.working ? (
        <div data-testid="better-stuck" style={ROW}>
          {props.stuck.keepAnyway ? (
            <button type="button" data-testid="better-keep-anyway" onClick={props.stuck.keepAnyway} style={QUIET}>
              Keep anyway
            </button>
          ) : null}
          <button type="button" data-testid="better-stuck-stop" onClick={props.stuck.stop} style={QUIET}>
            Stop
          </button>
        </div>
      ) : null}
      {props.children}
      {props.kept && !props.working ? (
        <div data-testid="better-kept" style={ROW}>
          {/* Said once: a host's note that already says it was kept ("Kept until this page reloads.") is not said after "Kept." again. */}
          <p style={{ margin: 0, flex: 1 }}>{props.kept.note ? (/^kept\b/i.test(props.kept.note.trim()) ? props.kept.note.trim() : `Kept. ${props.kept.note}`) : "Kept."}</p>
          {props.kept.undo ? (
            <button type="button" data-testid="better-undo" onClick={props.kept.undo} style={QUIET}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
      {empty && !props.working ? (
        <div style={ROW}>
          <button type="button" data-testid="better-just" onClick={props.just} style={QUIET}>
            Make it easier to read
          </button>
          <button type="button" data-testid="better-point" onClick={props.point} style={QUIET}>
            Point at a part…
          </button>
        </div>
      ) : null}
      {props.pointed && !props.working ? (
        <p data-testid="better-pointed" style={QUIET_LINE}>
          You pointed at {props.pointed}.
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!typed.trim() || props.working) return;
          props.ask(typed.trim());
          setTyped("");
        }}
        style={{ flexShrink: 0, display: "flex", gap: 6 }}
      >
        <label htmlFor="graview-better-panel-words" style={VISUALLY_HIDDEN}>
          Tell Graview what to change
        </label>
        <input
          id="graview-better-panel-words"
          ref={field}
          data-testid="better-words"
          value={typed}
          disabled={props.working}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={empty ? "What should change?" : "Tell Graview what to change…"}
          style={FIELD}
        />
        <button type="submit" disabled={props.working || !typed.trim()} data-testid="better-send" style={PRIMARY}>
          Send
        </button>
      </form>
    </aside>
  );
}

/* The shell's own surface, one line from the page: part of the app, in its light and dark alike. */
const BASE: CSSProperties = {
  position: "fixed",
  zIndex: layer("popover"),
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 14,
  margin: 0,
  fontSize: "0.875rem",
  lineHeight: 1.45,
  color: "var(--graview-ink)",
  background: "var(--graview-panel)",
  overflow: "hidden",
};
const SIDE: CSSProperties = { ...BASE, top: 0, right: 0, bottom: 0, width: WIDE, borderLeft: "1px solid var(--graview-edge)" };
const DRAWER_STYLE: CSSProperties = { ...SIDE, width: `min(${WIDE}px, 86vw)`, boxShadow: "var(--graview-lift-high, -12px 0 32px rgba(0,0,0,0.18))" };
const SHEET: CSSProperties = { ...BASE, left: 0, right: 0, bottom: 0, maxHeight: "55vh", borderTop: "1px solid var(--graview-edge)", borderRadius: "14px 14px 0 0", boxShadow: "var(--graview-lift-high, 0 -12px 32px rgba(0,0,0,0.18))" };
const CHIP: CSSProperties = { flexShrink: 0, margin: 0, justifySelf: "start", alignSelf: "flex-start", padding: "2px 10px", borderRadius: 999, fontSize: "0.8125rem", color: "var(--graview-ink)", background: "var(--graview-ground)", border: "1px solid var(--graview-edge)" };
const HEAD: CSSProperties = { flexShrink: 0, display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" };
const QUIET_LINE: CSSProperties = { flexShrink: 0, margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" };
const TALK: CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: "1 1 0", minHeight: 0 };
const BUBBLE: CSSProperties = { padding: "7px 10px", borderRadius: 10, maxWidth: "88%", whiteSpace: "pre-wrap", flex: "none" };
const MINE: CSSProperties = { ...BUBBLE, alignSelf: "flex-end", background: "color-mix(in srgb, var(--graview-accent) 12%, var(--graview-panel))" };
const THEIRS: CSSProperties = { ...BUBBLE, alignSelf: "flex-start", background: "var(--graview-ground)" };
const STEPS: CSSProperties = { flex: "none", padding: "6px 10px", borderRadius: 10, border: "1px dashed var(--graview-edge)", fontSize: "0.8125rem" };
const ROW: CSSProperties = { flexShrink: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 };
const BUTTON: CSSProperties = { minHeight: 32, padding: "0 12px", borderRadius: 8, fontSize: "0.8125rem", cursor: "pointer" };
const PRIMARY: CSSProperties = { ...BUTTON, color: "var(--graview-accent-ink, #fff)", background: "var(--graview-accent)", border: "1px solid var(--graview-accent)" };
const QUIET: CSSProperties = { ...BUTTON, color: "var(--graview-ink)", background: "transparent", border: "1px solid var(--graview-edge)" };
const ICON: CSSProperties = { ...QUIET, minHeight: 28, padding: "0 9px", fontSize: "1rem", lineHeight: 1 };
const FIELD: CSSProperties = { flex: "1 1 auto", minWidth: 0, minHeight: 34, padding: "0 10px", borderRadius: 8, border: "1px solid var(--graview-edge)", background: "var(--graview-panel)", color: "var(--graview-ink)", fontSize: "0.875rem" };
const SWITCH: CSSProperties = { display: "inline-flex", border: "1px solid var(--graview-edge)", borderRadius: 999, padding: 2 };
const SWITCH_ON: CSSProperties = { ...BUTTON, minHeight: 28, borderRadius: 999, border: "none", color: "var(--graview-accent-ink, #fff)", background: "var(--graview-accent)" };
const SWITCH_OFF: CSSProperties = { ...BUTTON, minHeight: 28, borderRadius: 999, border: "none", color: "var(--graview-ink)", background: "transparent" };
