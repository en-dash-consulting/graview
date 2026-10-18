import { POPOVER_STYLE, useTopLayer } from "@graview/react/provider";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { FirstLookAnchor, FirstLookEnd, FirstLookHintsProps, FirstLookStep } from "./first-look-door.js";

/**
 * THE FIRST LOOK'S HINTS (`first-look-door.tsx`), fetched as they are
 * first shown: one at a time, beside the control each names — under it, or
 * over it where there is more room above, never on it — in the top layer
 * with the other popovers, the keyboard on its Next.
 */

/** Where each named control is drawn: the framework's own test ids, on every face's bar. */
const FOUND: Record<FirstLookAnchor, string> = {
  faces: '[data-testid="app-faces"]',
  problems: '[data-testid="standing"], [data-testid="standing-link"]',
  activity: '[data-testid="activity-button"]',
  // The quick ask has no control of its own until ⌘K opens it: its hint stands by Find, where a quick ask is drawn.
  ask: '[data-testid="app-find"], [data-testid="app-find-open"]',
  find: '[data-testid="app-find"], [data-testid="app-find-open"]',
  profile: '[data-testid="profile-button"]',
  home: '[data-testid="app-home"]',
};

/**
 * WHETHER A CONTROL IS DRAWN: in the page, in nothing hidden, laid out and
 * more than the one clipped pixel a word that gave way to a mark keeps for
 * its name. Where nothing is laid out at all (a test's document), what is
 * in the page is drawn.
 */
function drawn(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
  if (typeof element.checkVisibility !== "function") return true;
  if (!element.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)) return false;
  const box = element.getBoundingClientRect();
  return box.width > 1 && box.height > 1;
}

/** The control a hint points at, as it is drawn now; null when it is not. */
export function firstLookAnchor(root: Element | null, anchor: FirstLookAnchor): HTMLElement | null {
  if (!root) return null;
  if (anchor === "ask" && !root.querySelector("[data-graview-quick-ask]")) return null;
  for (const element of root.querySelectorAll<HTMLElement>(FOUND[anchor])) if (drawn(element)) return element;
  return null;
}

/** The framework's own hints, in the words of the app they are drawn in. */
function frameworkSteps(root: Element): FirstLookStep[] {
  const said = (selector: string, attribute: string, otherwise: string) => root.querySelector(selector)?.getAttribute(attribute)?.trim() || otherwise;
  const scene = said('[data-testid="app-face-scene"]', "title", "Scene");
  const pages = said('[data-testid="app-face-pages"]', "title", "Pages");
  return [
    { anchor: "faces", title: `${scene} or ${pages}`, words: `One app, two ways to see it: ${scene} draws every record as one picture, ${pages} as lists and pages to read and change.` },
    { anchor: "problems", title: "Whether all is in order", words: "The dot is green while every rule holds. When one is broken it counts what is wrong, and pressing it shows each one and where." },
    { anchor: "activity", title: "Activity", words: "What has happened here and who did it, each change with its way back." },
    { anchor: "ask", title: "Ask", words: "Press ⌘K (Ctrl+K) to ask about what you have selected, or right-click it and choose Ask about this…. The answer stands beside it, and a change it proposes waits for you to accept it." },
  ];
}

/** How long the page is left to settle before the first hint, and the longest it is waited for. */
const QUIET_MS = 300;
const SETTLE_MS = 1200;
const GIVE_UP_MS = 15000;

export function FirstLookHints({ root, steps, onEnd }: FirstLookHintsProps) {
  const [run, setRun] = useState<{ readonly list: readonly FirstLookStep[]; readonly at: number } | null>(null);
  const returnTo = useRef<Element | null>(null);
  const ended = useRef(false);
  const told = useRef(onEnd);
  told.current = onEnd;

  /*
   * WAITING FOR THE APP TO DRAW: its bar, then a moment with nothing new
   * arriving — a face is fetched as it is drawn, and the quick ask with it —
   * and then the hints whose controls are drawn, in order.
   */
  useEffect(() => {
    const begun = Date.now();
    let quiet = Date.now();
    let barSeen: number | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const watch = new MutationObserver(() => (quiet = Date.now()));
    watch.observe(document.body, { childList: true, subtree: true });
    const look = () => {
      const at = root();
      const now = Date.now();
      if (at?.querySelector('[data-testid="app-bar"]')) {
        barSeen ??= now;
        if (now - quiet >= QUIET_MS || now - barSeen >= SETTLE_MS) {
          const list = [...frameworkSteps(at), ...steps].filter((step) => firstLookAnchor(at, step.anchor) !== null);
          if (list.length === 0) {
            ended.current = true;
            told.current(null);
            return;
          }
          returnTo.current = document.activeElement;
          setRun({ list, at: 0 });
          return;
        }
      } else if (now - begun >= GIVE_UP_MS) {
        ended.current = true;
        told.current(null);
        return;
      }
      timer = setTimeout(look, 100);
    };
    timer = setTimeout(look, 100);
    return () => {
      clearTimeout(timer);
      watch.disconnect();
    };
    // Begun once: the app is waited for as it first draws.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The keyboard back where it was before the first hint, or on the app's name when it was nowhere. */
  const giveBack = useCallback(() => {
    const was = returnTo.current;
    const back = was instanceof HTMLElement && was !== document.body && was.isConnected ? was : root()?.querySelector<HTMLElement>('[data-testid="app-home"]');
    back?.focus({ preventScroll: true });
  }, [root]);

  const end = useCallback(
    (how: FirstLookEnd, back: boolean) => {
      if (ended.current) return;
      ended.current = true;
      const pane = document.querySelector("[data-testid='first-look']");
      const active = document.activeElement;
      const lost = active === null || active === document.body || (pane !== null && pane.contains(active));
      setRun(null);
      told.current(how);
      if (!back && !lost) return;
      giveBack();
      // WebKit can hand the keyboard to <body> as a pane leaves the top layer: asked again a frame later.
      requestAnimationFrame(() => {
        const now = document.activeElement;
        if (now === null || now === document.body) giveBack();
      });
    },
    [giveBack],
  );

  /** The next hint whose control is drawn, from `from`; -1 for none. */
  const nextDrawn = useCallback(
    (list: readonly FirstLookStep[], from: number) => {
      const at = root();
      for (let index = from; index < list.length; index++) if (firstLookAnchor(at, list[index]!.anchor)) return index;
      return -1;
    },
    [root],
  );

  const next = useCallback(() => {
    if (!run) return;
    const index = nextDrawn(run.list, run.at + 1);
    if (index < 0) end("finished", true);
    else setRun({ list: run.list, at: index });
  }, [run, nextDrawn, end]);

  /* A hint whose control went — a face changed under it — gives way to the next one drawn. */
  useEffect(() => {
    if (!run) return;
    const at = root();
    if (!at) return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!firstLookAnchor(root(), run.list[run.at]!.anchor)) next();
      });
    };
    const watch = new MutationObserver(check);
    watch.observe(at, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "data-switch-drawn"] });
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, [run, root, next]);

  if (!run) return null;
  const step = run.list[run.at]!;
  const last = nextDrawn(run.list, run.at + 1) < 0;
  return (
    <Hint
      key={run.at}
      root={root}
      step={step}
      position={run.at + 1}
      total={run.list.length}
      last={last}
      onNext={next}
      onEnd={end}
    />
  );
}

const paneStyle: CSSProperties = {
  ...POPOVER_STYLE,
  width: "min(320px, calc(100vw - 24px))",
  maxHeight: "min(70vh, 420px)",
  overflow: "auto",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float)",
  boxShadow: "var(--graview-lift-high)",
  color: "var(--graview-ink)",
  fontFamily: "var(--graview-font-body, system-ui)",
  fontSize: "0.875rem",
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const buttonStyle: CSSProperties = {
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 8,
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * ONE HINT: a non-modal dialog named by its control, said as the keyboard
 * goes in; Next (Done on the last), Skip, Escape. A press anywhere else
 * ends the look: the person has gone to use the app.
 */
function Hint({
  root,
  step,
  position,
  total,
  last,
  onNext,
  onEnd,
}: {
  readonly root: () => Element | null;
  readonly step: FirstLookStep;
  readonly position: number;
  readonly total: number;
  readonly last: boolean;
  readonly onNext: () => void;
  readonly onEnd: (how: FirstLookEnd, back: boolean) => void;
}) {
  const pane = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const id = useId().replace(/:/g, "");
  // The control as it is drawn whenever the hint is placed: a bar drawn again has a new one.
  const anchor = useMemo(() => ({ get current() { return firstLookAnchor(root(), step.anchor); } }), [root, step.anchor]);
  // Hung from the control's nearer edge, so it stays beside it.
  const [align] = useState<"start" | "end">(() => {
    const box = anchor.current?.getBoundingClientRect();
    const width = typeof document === "undefined" ? 0 : document.documentElement.clientWidth || innerWidth;
    return box && box.left + box.width / 2 < width / 2 ? "start" : "end";
  });
  useTopLayer(pane, true, anchor as never, { align });
  useLayoutEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, []);
  const latest = useRef(onEnd);
  latest.current = onEnd;
  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (event.target instanceof Node && pane.current?.contains(event.target)) return;
      latest.current("dismissed", false);
    };
    // Escape where the keyboard is not in the hint, nor in a field or another open popover, ends it too.
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Node && pane.current?.contains(target)) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if ([...document.querySelectorAll("[data-graview-overlay]:not([hidden])")].some((open) => open !== pane.current)) return;
      latest.current("dismissed", true);
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div
      ref={pane}
      popover="manual"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-words`}
      tabIndex={-1}
      data-testid="first-look"
      data-first-look-anchor={step.anchor}
      // Over the scene: the scene's Escape and the popovers' rules leave it be.
      data-graview-overlay=""
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onEnd("dismissed", true);
      }}
      style={paneStyle}
    >
      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--graview-ink-muted)" }} data-testid="first-look-count">
        {position} of {total}
      </p>
      <p id={`${id}-title`} style={{ margin: "2px 0 4px", fontWeight: 600, fontSize: "0.9375rem" }} data-testid="first-look-title">
        {step.title}
      </p>
      <p id={`${id}-words`} style={{ margin: 0 }} data-testid="first-look-words">
        {step.words}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        {last ? null : (
          <button
            type="button"
            data-testid="first-look-skip"
            onClick={() => onEnd("dismissed", true)}
            style={{ ...buttonStyle, fontWeight: 500, border: "1px solid transparent", background: "none", color: "var(--graview-ink-muted)" }}
          >
            Skip
          </button>
        )}
        <button
          ref={primary}
          type="button"
          data-testid={last ? "first-look-done" : "first-look-next"}
          onClick={() => (last ? onEnd("finished", true) : onNext())}
          style={{ ...buttonStyle, border: "1px solid var(--graview-accent)", background: "var(--graview-accent)", color: "var(--graview-accent-ink)" }}
        >
          {last ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
