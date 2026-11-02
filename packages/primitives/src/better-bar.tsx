import { layer } from "@graview/core";
import type { DrawnRead } from "@graview/tools/section";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { boxOf } from "./section-outline.js";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";

/*
 * THE BETTER UI FLOW, DRAWN (Roadmap f-make-any-page-better): the part
 * being changed covered while Graview works on it, the draft given the
 * page once it passed, and the controls out of its way in a slim bar
 * docked at the foot of the window — a bottom sheet's peek on a phone.
 * Shared by a built-in page's card (`page-better.tsx`) and a view's
 * section (`section-better.tsx`).
 */

const words = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** The roots a drawing is read through: the element, and each worker view's own drawing inside it. */
function rootsOf(root: Element): ParentNode[] {
  const roots: ParentNode[] = [root];
  if (root.shadowRoot) roots.push(root.shadowRoot);
  for (const region of root.querySelectorAll("[data-worker-view]")) if (region.shadowRoot) roots.push(region.shadowRoot);
  return roots;
}

/** The text a person reads in a root: what is drawn and shown, not what is hidden. */
function shownText(root: ParentNode): string {
  if (root instanceof HTMLElement) return root.innerText ?? root.textContent ?? "";
  return [...(root as ParentNode).children].map((one) => (one instanceof HTMLElement ? (one.innerText ?? one.textContent ?? "") : (one.textContent ?? ""))).join(" ");
}

/** Words a row says that are its controls or its marks, not what it tells of the record. */
const NOT_A_FACT = /^[\s·•|,:;–—\-+…✓✔×↓↑▸▾☆★⋯]*$/u;

/**
 * WHAT A RECORD'S ROW OR CARD SAYS BESIDE ITS NAME: each bit of words drawn
 * apart in it ("Todo", "Sep 3, 2026", "3 tasks"), not its name, not a
 * control's label, nothing hidden — the facts a draft must still say.
 */
function factsOf(row: Element, name: Element): string[] {
  const facts: string[] = [];
  const walker = (row.ownerDocument ?? document).createTreeWalker(row, NodeFilter.SHOW_TEXT);
  const byParent = new Map<Element, string>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    // A link goes somewhere (the trail, "In the scene", another record): where it goes is not what the row says of the record.
    if (!parent || name.contains(parent) || parent.closest("button, input, select, textarea, [role='button'], nav, [hidden], [aria-hidden='true'], script, style")) continue;
    const link = parent.closest("a[href]");
    if (link && !link.contains(name)) continue;
    byParent.set(parent, (byParent.get(parent) ?? "") + (node.textContent ?? ""));
  }
  for (const [parent, text] of byParent) {
    const said = words(text);
    // Words or a number: a mark alone ("⚠", "·") says nothing a draft must keep.
    if (!said || said.length > 40 || NOT_A_FACT.test(said) || !/[\p{L}\p{N}]/u.test(said) || parent.getClientRects().length === 0) continue;
    if (!facts.includes(said)) facts.push(said);
    if (facts.length >= 6) break;
  }
  return facts;
}

/**
 * A DRAWING READ FOR JUDGING: its headings in order, each record a label
 * names — the innermost element that says it, where it stands and how big
 * its type is, what its row or card says beside its name and the heading
 * it sits under — and all its words, through each worker view's drawing.
 */
export function readDrawn(root: Element | null | undefined, labels: readonly string[]): DrawnRead {
  if (!root?.isConnected) return { headings: [], records: [], text: "" };
  const roots = rootsOf(root);
  const headings: string[] = [];
  const headingAt: { element: Element; said: string }[] = [];
  for (const one of roots)
    for (const heading of one.querySelectorAll("h1, h2, h3, [role='heading']")) {
      if (heading.closest("[data-graview-popover], [hidden], [aria-hidden='true'], nav")) continue;
      const copy = heading.cloneNode(true) as Element;
      for (const span of copy.querySelectorAll("span")) if (/^[\s·\d]+$/.test(span.textContent ?? "")) span.remove();
      const said = words(copy.textContent).replace(/^[▸▾]\s*/, "");
      if (said) {
        headings.push(said);
        headingAt.push({ element: heading, said });
      }
    }
  const named = new Map<string, Element>();
  for (const label of labels) {
    const want = words(label).toLowerCase();
    if (!want || named.has(label)) continue;
    let best: Element | undefined;
    for (const one of roots)
      for (const element of one.querySelectorAll("a, li, p, span, h2, h3, h4, strong, div, button, td")) {
        if (words(element.textContent).toLowerCase() !== want) continue;
        if (!best || best.contains(element)) best = element;
      }
    if (best) named.set(label, best);
  }
  const names = [...named.values()];
  const records: DrawnRead["records"][number][] = [];
  for (const [label, best] of named) {
    // Its row or card: the widest box around its name that holds no other record's name.
    let row: Element = best;
    for (let up = best.parentElement; up && up !== root && !(up instanceof HTMLBodyElement); up = up.parentElement) {
      if (names.some((other) => other !== best && up.contains(other))) break;
      if (up.matches("main, section, ul, ol, table, tbody, [data-graview-page]")) break;
      row = up;
    }
    // The heading it sits under: the last one before it in the same drawing that is not in its own row.
    let under: string | undefined;
    // A heading that is a record's own name (a list's card titled "This week") heads that record, not a group.
    const ownNames = new Set(labels.map((one) => words(one).toLowerCase()));
    for (const one of headingAt) {
      if (one.element.getRootNode() !== best.getRootNode() || row.contains(one.element) || one.element.contains(best) || ownNames.has(one.said.toLowerCase())) continue;
      if (one.element.compareDocumentPosition(best) & Node.DOCUMENT_POSITION_FOLLOWING) under = one.said;
    }
    const box = best.getBoundingClientRect();
    const size = Number.parseFloat(getComputedStyle(best).fontSize) || 16;
    const rowText = row instanceof HTMLElement ? (row.innerText ?? row.textContent ?? "") : (row.textContent ?? "");
    // A record that is the page itself (its title) has the page for its row: what it says is the page's headings and records, judged as those.
    const isPage = best.matches("h1, [data-graview-page-title]") || best.closest("h1, [data-graview-page-title]") !== null;
    records.push({ label, top: Math.round(box.top), left: Math.round(box.left), size, facts: isPage ? [] : factsOf(row, best), row: words(rowText), ...(under ? { under } : {}) });
  }
  records.sort((a, b) => a.top - b.top || a.left - b.left);
  return { headings, records, text: roots.map(shownText).join(" ") };
}

/** Keeps a box over an element as the page moves, each frame. */
function useOver(target: Element | null | undefined, box: React.RefObject<HTMLElement | null>, pad = 0) {
  useLayoutEffect(() => {
    let frame = 0;
    const place = () => {
      const at = box.current;
      const over = target?.isConnected ? boxOf([target]) : null;
      if (at && over) {
        const top = Math.max(over.top, 0);
        const bottom = Math.min(over.bottom, innerHeight);
        at.style.display = bottom > top ? "grid" : "none";
        at.style.left = `${Math.round(over.left - pad)}px`;
        at.style.top = `${Math.round(top - pad)}px`;
        at.style.width = `${Math.round(over.width + 2 * pad)}px`;
        at.style.height = `${Math.round(bottom - top + 2 * pad)}px`;
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [target, box, pad]);
}

const SHIMMER_CSS = `@keyframes graview-redesign{0%{background-position:100% 0}100%{background-position:-100% 0}}
[data-graview-redesigning]{background:linear-gradient(90deg,var(--graview-ground) 0%,color-mix(in srgb,var(--graview-panel) 70%,var(--graview-accent) 6%) 50%,var(--graview-ground) 100%);background-size:200% 100%;animation:graview-redesign 1.6s linear infinite}
@media (prefers-reduced-motion: reduce){[data-graview-redesigning]{animation:none}}`;

/**
 * THE PART BEING CHANGED, COVERED WHILE GRAVIEW WORKS ON IT: whole, so a
 * draft drawn under it to be judged is never seen, with the words of what
 * is happening on it. Gone once a draft passed, or none did.
 */
export function Redesigning({ over, name, said }: { readonly over: Element | null | undefined; readonly name: string; readonly said?: string }) {
  const cover = useRef<HTMLDivElement>(null);
  useOver(over, cover, 2);
  return (
    <div ref={cover} data-graview-redesigning="" data-testid="redesigning" data-graview-popover="" style={COVER}>
      <style>{SHIMMER_CSS}</style>
      <p role="status" aria-live="polite" style={COVER_WORDS}>
        <span aria-hidden="true" style={MARK}>✦</span> {said ?? `Graview is redesigning “${name}”…`}
      </p>
    </div>
  );
}

/** Room at the foot of the page for the bar, so the end of what is drawn can be scrolled clear of it. */
function useRoomBelow(bar: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const before = document.body.style.paddingBottom;
    const room = () => {
      const height = bar.current?.getBoundingClientRect().height ?? 0;
      document.body.style.paddingBottom = `${Math.round(height + 24)}px`;
    };
    room();
    const watch = typeof ResizeObserver === "function" && bar.current ? new ResizeObserver(room) : null;
    if (watch && bar.current) watch.observe(bar.current);
    return () => {
      watch?.disconnect();
      document.body.style.paddingBottom = before;
    };
  }, [bar]);
}

export interface DraftBarProps {
  /** The phase the flow is at, carried as `data-section-phase` for the card it was. */
  readonly phase: string;
  /** What the bar is about: “Lists”. */
  readonly name: string;
  /** The one line of what changed, in the code's words. */
  readonly said: string;
  /** Who it changes it for, in a sentence. */
  readonly scope?: string;
  /** A line under it, quiet: what the host said when it kept it. */
  readonly note?: string;
  /** The draft's steps: how many, and whether the one before can be gone back to. */
  readonly step?: { readonly at: number; readonly of: number; readonly back?: () => void };
  /** Before and After: whether the original is shown now, and the switch. */
  readonly compare?: { readonly before: boolean; readonly toggle: (before: boolean) => void };
  /** Words that change the draft again. */
  readonly iterate?: (words: string) => void;
  /** Its buttons: Keep and Discard on a draft, Undo and Close once kept, Close where it ends. */
  readonly keep?: () => void;
  readonly discard?: () => void;
  readonly undo?: () => void;
  readonly close?: () => void;
  /** Words that try again, where nothing passed. */
  readonly retry?: (words: string) => void;
  /** Try harder: the full model, once, where the light one could not keep the page. */
  readonly tryHarder?: () => void;
  /** Cancel what is thinking: at once, the page as it was. */
  readonly cancel?: () => void;
  readonly busy?: boolean;
  readonly children?: ReactNode;
}

/**
 * THE DRAFT'S BAR: one line of what changed, said by code; who it changes
 * it for; Before and After to compare in place; "Tell it what to change…"
 * to take another step, and a step back; Keep and Discard. Docked at the
 * foot of the window, full width on a phone, never over what it changed.
 */
export function DraftBar(props: DraftBarProps) {
  const bar = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  useRoomBelow(bar);
  /* The keyboard goes to the bar's first button, else the bar itself: never left on what the card was. */
  useEffect(() => {
    (bar.current?.querySelector<HTMLElement>("[data-first]") ?? bar.current)?.focus({ preventScroll: true });
  }, [props.phase]);
  const ask = props.iterate ?? props.retry;
  return (
    <div ref={bar} tabIndex={-1} role="region" aria-label={`Changing “${props.name}”`} data-testid="section-card" data-better-bar="" data-section-phase={props.phase} data-graview-popover="" style={BAR}>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <p role="status" aria-live="polite" data-testid="section-status" style={props.busy ? BUSY : SAID}>
          {props.said}
        </p>
        {props.scope ? (
          <p data-testid="section-scope" style={QUIET_LINE}>
            {props.scope}
          </p>
        ) : null}
        {props.note ? (
          <p data-testid="section-note" style={QUIET_LINE}>
            {props.note}
          </p>
        ) : null}
        {props.children}
      </div>
      <div style={CONTROLS}>
        {props.compare ? (
          <div role="group" aria-label="Compare" style={SWITCH}>
            {(["Before", "After"] as const).map((side) => {
              const on = side === "Before" ? props.compare!.before : !props.compare!.before;
              return (
                <button key={side} type="button" data-testid={`section-${side.toLowerCase()}`} aria-pressed={on} onClick={() => props.compare!.toggle(side === "Before")} style={on ? SWITCH_ON : SWITCH_OFF}>
                  {side}
                </button>
              );
            })}
          </div>
        ) : null}
        {props.step && props.step.of > 1 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span data-testid="section-step" style={QUIET_LINE}>
              Step {props.step.at} of {props.step.of}
            </span>
            {props.step.back ? (
              <button type="button" data-testid="section-step-back" onClick={props.step.back} style={QUIET}>
                ← Step back
              </button>
            ) : null}
          </span>
        ) : null}
        {ask ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!typed.trim()) return;
              ask(typed.trim());
              setTyped("");
            }}
            style={{ display: "flex", gap: 6, flex: "1 1 220px", minWidth: 0 }}
          >
            <label htmlFor="graview-better-words" style={VISUALLY_HIDDEN}>
              {props.iterate ? "Tell it what to change" : "Try again with words"}
            </label>
            <input id="graview-better-words" data-testid="section-iterate" value={typed} disabled={props.busy} onChange={(event) => setTyped(event.target.value)} placeholder={props.iterate ? "Tell it what to change…" : "Try again with words…"} style={FIELD} />
          </form>
        ) : null}
        <span style={{ display: "inline-flex", gap: 6, marginLeft: "auto" }}>
          {props.tryHarder ? (
            <button type="button" data-first="" data-testid="section-try-harder" onClick={props.tryHarder} style={PRIMARY}>
              Try harder
            </button>
          ) : null}
          {props.retry && !props.iterate ? (
            <button type="button" {...(props.tryHarder ? {} : { "data-first": "" })} data-testid="section-say-differently" onClick={() => bar.current?.querySelector<HTMLInputElement>('[data-testid="section-iterate"]')?.focus()} style={QUIET}>
              Say it differently
            </button>
          ) : null}
          {props.cancel ? (
            <button type="button" data-first="" data-testid="section-cancel" onClick={props.cancel} style={QUIET}>
              Cancel
            </button>
          ) : null}
          {props.keep ? (
            <button type="button" data-first="" data-testid="section-keep" disabled={props.busy} onClick={props.keep} style={PRIMARY}>
              Keep
            </button>
          ) : null}
          {props.discard ? (
            <button type="button" data-testid="section-discard" onClick={props.discard} style={QUIET}>
              Discard
            </button>
          ) : null}
          {props.undo ? (
            <button type="button" data-first="" data-testid="section-undo" onClick={props.undo} style={QUIET}>
              Undo
            </button>
          ) : null}
          {props.close ? (
            <button type="button" {...(props.keep || props.undo || props.tryHarder || props.retry ? {} : { "data-first": "" })} data-testid="section-close" onClick={props.close} style={QUIET}>
              Close
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

const COVER: CSSProperties = { position: "fixed", display: "none", placeItems: "center", boxSizing: "border-box", borderRadius: 12, zIndex: layer("popover"), pointerEvents: "auto", overflow: "hidden" };
const COVER_WORDS: CSSProperties = { margin: 0, padding: "8px 14px", borderRadius: 999, fontSize: "0.9375rem", color: "var(--graview-ink)", background: "var(--graview-float, var(--graview-panel))", border: "1px solid var(--graview-edge)", boxShadow: "var(--graview-lift-low)", position: "sticky", top: 16 };
const MARK: CSSProperties = { color: "var(--graview-accent)" };
const BAR: CSSProperties = {
  position: "fixed",
  left: "max(12px, calc(50% - 440px))",
  right: "max(12px, calc(50% - 440px))",
  bottom: 12,
  zIndex: layer("popover"),
  boxSizing: "border-box",
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float, var(--graview-panel))",
  color: "var(--graview-ink)",
  boxShadow: "var(--graview-lift-high)",
  fontSize: "0.875rem",
};
const SAID: CSSProperties = { margin: 0, fontWeight: 600, overflowWrap: "anywhere" };
const BUSY: CSSProperties = { margin: 0, fontStyle: "italic", overflowWrap: "anywhere" };
const QUIET_LINE: CSSProperties = { margin: 0, color: "var(--graview-ink-muted)", fontSize: "0.8125rem" };
const CONTROLS: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 };
const BUTTON: CSSProperties = { minHeight: 34, padding: "0 12px", font: "inherit", borderRadius: 8, cursor: "pointer" };
const PRIMARY: CSSProperties = { ...BUTTON, color: "var(--graview-accent-ink, #fff)", background: "var(--graview-accent)", border: "1px solid var(--graview-accent)" };
const QUIET: CSSProperties = { ...BUTTON, color: "var(--graview-ink)", background: "transparent", border: "1px solid var(--graview-edge)" };
const SWITCH: CSSProperties = { display: "inline-flex", border: "1px solid var(--graview-edge)", borderRadius: 999, padding: 2 };
const SWITCH_ON: CSSProperties = { ...BUTTON, minHeight: 28, padding: "0 10px", borderRadius: 999, border: 0, color: "var(--graview-accent-ink, #fff)", background: "var(--graview-accent)" };
const SWITCH_OFF: CSSProperties = { ...BUTTON, minHeight: 28, padding: "0 10px", borderRadius: 999, border: 0, color: "var(--graview-ink)", background: "transparent" };
const FIELD: CSSProperties = { boxSizing: "border-box", flex: "1 1 auto", minWidth: 0, height: 34, padding: "0 10px", font: "inherit", fontSize: "max(1rem,16px)", color: "var(--graview-ink)", background: "var(--graview-panel)", border: "1px solid var(--graview-edge)", borderRadius: 8 };
