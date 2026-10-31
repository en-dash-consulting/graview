import { layer, type AnySchema, type ViewReviseAnswer } from "@graview/core";
import type { AiInteraction, AiStage, AiUsage } from "@graview/core/catalog";
import { compareViewRevision } from "@graview/core/revisions";
import { useGraview, type MenuViewSection, type ViewPlaceDraft, type ViewPlaceHandle } from "@graview/react/provider";
import { sectionUnderNow, viewPlaceOf } from "@graview/react/drawing";
import { reviseSection, type SectionStage } from "@graview/tools/section";
import { interactionId } from "@graview/tools/inline-ai";
import type { Telling, TellingOutcome, ToldStore } from "@graview/core/told";
import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { SectionAsk } from "./section-menu.js";
import { boxOf, SectionOutline } from "./section-outline.js";

export { SectionOutline };
import { nameParts, partLines, placeOfSection, type PartRead } from "./section-words.js";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";
/*
 * WHAT WAS TOLD (Roadmap f-menu-learns): each revision offered is kept as a
 * telling — the words, the view's section it was said on, the slot that
 * wrote it and how long it took — and how it ended (kept, discarded, undone,
 * refused), with the 👍/👎 strip at the card's foot as on the quick ask's.
 * Fetched apart, never in the way of the card.
 */
const toldCard = /* @__PURE__ */ lazyModule(retryingImport(() => import("./told-ui.js")));
const Rate = /* @__PURE__ */ toldCard.part((module, props: { readonly told: ToldStore; readonly telling: Telling }) => <module.RateTelling {...props} />, { quiet: true });
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * THE SECTION'S CARD (Roadmap f-make-this-section-better), fetched the
 * first time "Make this better" is asked for.
 *
 *   Just do it         the section revised at once
 *   Describe changes   "What should change?", then revised by those words
 *   Highlight area     an overlay over the view: drag over a part, or
 *                      click one; the card opens there naming what it
 *                      covers ("the three day columns"), asking "What
 *                      should change here?"
 *
 * The revision is composed whole — the section replaced, every other byte
 * of the view kept — and judged before it is offered: the host's own
 * checks of a view's code, drawn as a draft in the view's place, and
 * compared with what it replaces (`compareViewRevision`): a class left
 * unstyled or a section lost is handed back to the model once, then
 * refused in words; how its height moved is said. The draft stands in the
 * view's place with Keep and Discard; Keep goes through the host's view
 * door (`KeptViews.revise`), and one Undo puts the view back. Activity
 * keeps each one as an entry.
 */

/** What the door draws: the outline over the section a menu is open on, else the card asked for. */
export interface SectionDrawnProps {
  readonly ask: SectionAsk | null;
  readonly open?: readonly Element[];
  readonly close: () => void;
}

export function SectionDrawn({ ask, open, close }: SectionDrawnProps) {
  if (ask?.part) return <PageCard key={ask.at} ask={ask} close={close} />;
  if (ask?.section) return <SectionCard key={ask.at} ask={ask} close={close} />;
  return open ? <SectionOutline elements={open} /> : null;
}

/* A built-in page's card (Roadmap f-make-any-page-better), fetched the first time it is asked for. */
const pageCard = /* @__PURE__ */ lazyModule(retryingImport(() => import("./page-better.js")));
const PageCard = /* @__PURE__ */ pageCard.part((module, props: { readonly ask: Extract<SectionAsk, { part: object }>; readonly close: () => void }) => <module.PageCard {...props} />, { what: "Make this better" });

export interface SectionCardProps {
  readonly ask: Extract<SectionAsk, { section: MenuViewSection }>;
  readonly close: () => void;
}

type Phase =
  | { readonly at: "highlighting" }
  | { readonly at: "asking"; readonly pointed?: { readonly name: string; readonly lines: readonly string[] } }
  | { readonly at: "working"; readonly pointed?: { readonly name: string; readonly lines: readonly string[] } }
  | { readonly at: "draft"; readonly source: string; readonly said: string; readonly notes: readonly string[]; readonly entry: AiInteraction }
  | { readonly at: "keeping"; readonly source: string; readonly entry: AiInteraction }
  | { readonly at: "kept"; readonly source: string; readonly note?: string; readonly answer: ViewReviseAnswer; readonly entry: AiInteraction }
  | { readonly at: "undone" }
  | { readonly at: "refused"; readonly said: string };

const WIDTH = 360;
const GAP = 12;

/** The card's place: beside the box where the window has room, else under it, else over it. */
function placeBeside(card: HTMLElement, box: DOMRect | null): void {
  const view = { width: document.documentElement.clientWidth || innerWidth, height: innerHeight };
  const width = Math.min(WIDTH, view.width - 2 * GAP);
  const height = card.getBoundingClientRect().height;
  const clampTop = (wanted: number) => Math.max(GAP, Math.min(wanted, view.height - height - GAP));
  let left = (view.width - width) / 2;
  let top = clampTop(72);
  if (box && box.width > 0) {
    if (box.right + GAP + width <= view.width - GAP) [left, top] = [box.right + GAP, clampTop(box.top)];
    else if (box.left - GAP - width >= GAP) [left, top] = [box.left - GAP - width, clampTop(box.top)];
    else {
      left = Math.max(GAP, Math.min(box.left, view.width - width - GAP));
      top = box.bottom + GAP + height <= view.height - GAP ? box.bottom + GAP : clampTop(box.top - GAP - height);
    }
  }
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
  card.style.width = `${Math.round(width)}px`;
}

/** What the view's place shows of a section now: its words, as a person reads them. */
const shownBy = (elements: readonly Element[]) =>
  elements
    .map((element) => (element as HTMLElement).innerText ?? element.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/** A part read for its name: what it is, its classes, its words, where it stands. */
const readPart = (element: Element): PartRead => {
  const box = element.getBoundingClientRect();
  return { tag: (element.getAttribute("data-graview-as") ?? element.localName).toLowerCase(), classes: [...element.classList], text: element.textContent ?? "", box: { left: box.left, top: box.top, width: box.width, height: box.height } };
};

/** The parts of a view's drawing a rectangle holds whole, the outermost of them; or the smallest part under a point. */
function partsIn(root: Element, rect: { left: number; top: number; right: number; bottom: number }, point: boolean): Element[] {
  const all = [...root.querySelectorAll("*")].filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
  if (point) {
    const under = all.filter((element) => {
      const box = element.getBoundingClientRect();
      return rect.left >= box.left && rect.left <= box.right && rect.top >= box.top && rect.top <= box.bottom;
    });
    // The innermost part under the point that has words or a class of its own.
    const deepest = under.filter((element) => !under.some((other) => other !== element && element.contains(other)));
    const picked = deepest[0];
    if (!picked) return [];
    for (let at: Element | null = picked; at && at !== root; at = at.parentElement) if (at.classList.length > 0 || /^(h[1-6]|li|a|button|img|p|article|section)$/.test(at.localName)) return [at];
    return [picked];
  }
  const inside = all.filter((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= rect.left - 2 && box.right <= rect.right + 2 && box.top >= rect.top - 2 && box.bottom <= rect.bottom + 2;
  });
  let outermost = inside.filter((element) => !inside.some((other) => other !== element && other.contains(element)));
  /* One wrapper around several parts the rectangle holds: the parts, which is what a person dragged over ("the three day columns"). */
  while (outermost.length === 1) {
    const children = [...outermost[0]!.children].filter((child) => inside.includes(child));
    if (children.length < 2) break;
    outermost = children;
  }
  return outermost;
}

/** The words of a revision's findings that keep it from being offered, and the notes said with it. */
function judged(handle: ViewPlaceHandle, before: string, live: ReturnType<ViewPlaceHandle["drawing"]>, liveRefused: readonly string[], draft: ViewPlaceDraft, source: string): { findings: string[]; notes: string[] } {
  const after = draft.drawing();
  const revision = compareViewRevision({ source: before, css: live.css, ...(live.root ? { drawing: live.root } : {}), ...(live.height !== undefined ? { height: live.height } : {}) }, { source, css: after.css, ...(after.root ? { drawing: after.root } : {}), ...(after.height !== undefined ? { height: after.height } : {}) });
  const findings: string[] = [];
  for (const one of revision.unstyled) findings.push(`The class “${one.class}” is still drawn and no rule styles it now.`);
  for (const one of revision.sectionsMissing) findings.push(`“${one.name}” is not drawn any more.`);
  for (const refused of draft.refused()) if (!liveRefused.includes(refused)) findings.push(refused);
  const notes: string[] = [];
  const height = revision.height;
  if (height && Math.abs(height.ratio) >= 0.1) notes.push(`The view is ${Math.abs(Math.round(height.change))} px ${height.change > 0 ? "taller" : "shorter"} (${Math.round(height.before)} → ${Math.round(height.after)}).`);
  void handle;
  return { findings, notes };
}

export function SectionCard({ ask, close }: SectionCardProps) {
  const { ai, aiDesk, principal, keptViews } = useGraview<AnySchema>();
  const [section, setSection] = useState<MenuViewSection>(ask.section);
  const place = placeOfSection(ask.section);
  const handle = useRef<ViewPlaceHandle | undefined>(viewPlaceOf(place));
  const draft = useRef<ViewPlaceDraft | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>(ask.mode === "highlight" ? { at: "highlighting" } : ask.mode === "describe" && !ask.words ? { at: "asking" } : { at: "working" });
  const [words, setWords] = useState(ask.words ?? "");
  const original = useRef<string | undefined>(undefined);
  /* The telling of the revision on offer, kept with the host's door (`ai.told`), and how it ended. */
  const [telling, setTelling] = useState<Telling | null>(null);
  const tellingNow = useRef<Telling | null>(null);
  const ended = useCallback(
    (outcome: TellingOutcome) => {
      const now = tellingNow.current;
      if (now && ai.told) void toldCard.load().then((module) => module.changeTelling(ai.told, now.id, { outcome }), () => undefined);
    },
    [ai.told],
  );
  /** Keeps what was said and decided as a telling: offered as a draft ("previewed"), or refused. */
  const tell = useCallback(
    (words: string, on: MenuViewSection, refused: boolean, stages: readonly SectionStage[], ms: number, interaction: string) => {
      const keeps = ai.told;
      if (!keeps) return;
      const slot = stages.at(-1)?.stage === "thinking" ? "full" : stages.length > 0 ? "light" : undefined;
      void toldCard.load().then((module) => {
        const kept = module.keepTelling(keeps, { words, target: { on: "place", place: on.view }, decided: refused ? { type: "refusal" } : { type: "view", section: on.name }, ...(slot ? { slot } : {}), stages: stages.map((one) => ({ stage: one.stage === "thinking" ? "full" : "light", ms: one.ms, model: one.model })), ms, outcome: refused ? "abandoned" : "previewed", interaction }, principal);
        tellingNow.current = kept ?? null;
        setTelling(kept ?? null);
      }, () => undefined);
    },
    [ai.told, principal],
  );

  /* Put away: a draft not kept goes with the card, and the view stands as it was. */
  useEffect(
    () => () => {
      draft.current?.dispose();
      draft.current = null;
    },
    [],
  );

  const entryOf = useCallback(
    (said: string, outcome: AiInteraction["outcome"], stages: readonly SectionStage[], extra: Partial<AiInteraction> = {}): AiInteraction => ({
      id: interactionId(),
      at: new Date().toISOString(),
      by: principal,
      target: { on: "place", place: section.view },
      targetLabel: handle.current?.title ?? section.view,
      ask: { kind: "section", said },
      offered: [],
      outcome,
      stages: stages.map((one): AiStage => ({ stage: one.stage, ms: one.ms, model: one.model })),
      usage: stages.flatMap((one): AiUsage[] => (one.usage ? [{ tier: one.stage === "light" ? "fast" : "thinking", model: one.model, inputTokens: one.usage.inputTokens, outputTokens: one.usage.outputTokens } as AiUsage] : [])),
      ...extra,
    }),
    [principal, section.view],
  );

  /** Revise the section: asked, composed whole, judged as a draft in the view's place, offered or refused. */
  const revise = useCallback(
    async (mode: SectionAsk["mode"], said: string, pointed?: { readonly name: string; readonly lines: readonly string[] }, on: MenuViewSection = section) => {
      const view = handle.current;
      const asked = mode === "just" ? `Make “${on.name}” better` : `Make “${on.name}” better: ${said}`;
      if (!view) return setPhase({ at: "refused", said: "This view is not drawn here any more." });
      setPhase({ at: "working", ...(pointed ? { pointed } : {}) });
      const before = await view.source();
      if (before === undefined) return setPhase({ at: "refused", said: "This view is a whole worker script, and only a plain script's section can be revised here." });
      original.current ??= before;
      const started = Date.now();
      const live = view.drawing();
      const liveRefused = view.refused();
      const theme = await view.theme().catch(() => ({}));
      const result = await reviseSection({
        ai,
        source: before,
        section: on.name,
        mode,
        ...(said ? { words: said } : {}),
        ...(pointed ? { highlighted: [pointed.name, ...pointed.lines] } : {}),
        theme,
        shows: shownBy(on.elements),
        judge: async (source) => {
          draft.current?.dispose();
          draft.current = null;
          const refused = await view.check(source);
          if (refused.length > 0) return refused;
          const drawn = view.draft(source);
          draft.current = drawn;
          const { failed } = await drawn.drawn;
          if (failed) return [`The view did not draw: ${failed}`];
          await new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled)));
          return judged(view, before, live, liveRefused, drawn, source).findings;
        },
      });
      if (!result.ok) {
        draft.current?.dispose();
        draft.current = null;
        const failed = entryOf(asked, "failed", result.stages, { failed: result.refused });
        aiDesk.record(failed);
        tell(said || asked, on, true, result.stages, Date.now() - started, failed.id);
        return setPhase({ at: "refused", said: result.refused });
      }
      const notes = draft.current ? judged(view, before, live, liveRefused, draft.current, result.source).notes : [];
      const entry = entryOf(asked, "offered", result.stages);
      tell(said || asked, on, false, result.stages, Date.now() - started, entry.id);
      setPhase({ at: "draft", source: result.source, said: result.said, notes: result.repaired ? ["Repaired once after the first try broke the view.", ...notes] : notes, entry });
    },
    [ai, aiDesk, entryOf, section, tell],
  );

  /* Just do it: at once — and words typed in the menu about the look, asked at once too. */
  const began = useRef(false);
  useEffect(() => {
    if (began.current || !(ask.mode === "just" || (ask.mode === "describe" && ask.words))) return;
    began.current = true;
    void revise(ask.mode, ask.words ?? "");
  }, [ask.mode, ask.words, revise]);

  const keep = useCallback(async () => {
    if (phase.at !== "draft" || !keptViews?.revise || !handle.current) return;
    const view = handle.current;
    const before = (await view.source()) ?? "";
    setPhase({ at: "keeping", source: phase.source, entry: phase.entry });
    try {
      const answer = await keptViews.revise({ name: view.name, title: view.title, source: phase.source, before, section: section.name, said: phase.said });
      draft.current?.dispose();
      draft.current = null;
      view.draw(phase.source);
      const entry: AiInteraction = { ...phase.entry, outcome: "accepted" };
      aiDesk.record(entry);
      ended("accepted");
      setPhase({ at: "kept", source: before, ...(answer && answer.note ? { note: answer.note } : {}), answer, entry });
    } catch (error) {
      setPhase({ at: "refused", said: error instanceof Error ? error.message : "The host did not keep it." });
    }
  }, [phase, keptViews, aiDesk, section.name, ended]);

  const discard = useCallback(() => {
    draft.current?.dispose();
    draft.current = null;
    if (phase.at === "draft") {
      aiDesk.record({ ...phase.entry, outcome: "dismissed" });
      ended("declined");
    }
    close();
  }, [phase, aiDesk, close, ended]);

  const undo = useCallback(async () => {
    if (phase.at !== "kept" || !handle.current) return;
    const view = handle.current;
    const now = (await view.source()) ?? "";
    try {
      if (phase.answer && typeof phase.answer.undo === "function") await phase.answer.undo();
      else await keptViews?.revise?.({ name: view.name, title: view.title, source: phase.source, before: now, section: section.name, said: "Put back as it was.", undoes: true });
      view.draw(phase.source === original.current ? undefined : phase.source);
      aiDesk.record({ ...phase.entry, outcome: "dismissed" });
      // A quiet sign, never a 👎.
      ended("undone");
      setPhase({ at: "undone" });
    } catch (error) {
      setPhase({ at: "refused", said: error instanceof Error ? error.message : "The host did not put it back." });
    }
  }, [phase, keptViews, aiDesk, section.name, ended]);

  /* Placed beside the section, kept there as the page moves. */
  useLayoutEffect(() => {
    let frame = 0;
    const follow = () => {
      if (card.current) {
        const drafted = place?.querySelector("[data-graview-section-draft]");
        placeBeside(card.current, drafted ? boxOf([drafted]) : boxOf(section.elements) ?? (place ? boxOf([place]) : null));
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [section, place]);

  /* The keyboard: in the field when it asks, else on the card's first button. */
  useEffect(() => {
    if (phase.at === "asking") field.current?.focus();
    else if (phase.at !== "highlighting") card.current?.querySelector<HTMLElement>("button[data-first]")?.focus();
  }, [phase.at]);

  /* Escape puts it away: a draft is discarded, the keyboard goes back where it was. */
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      discard();
      ask.returnTo?.focus?.();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [discard, ask.returnTo]);

  const pointed = phase.at === "asking" || phase.at === "working" ? phase.pointed : undefined;

  if (phase.at === "highlighting") {
    return (
      <Highlighter
        box={place}
        root={place?.querySelector("[data-worker-view]")?.shadowRoot?.querySelector("[data-graview-view-root]") ?? undefined}
        whole={section.elements}
        cancel={close}
        chose={(elements) => {
          const first = elements[0];
          const under = first ? sectionUnderNow(first) : undefined;
          const on = under ?? section;
          setSection(on);
          setPhase({ at: "asking", pointed: { name: nameParts(elements.map(readPart)), lines: partLines(elements.map(readPart)) } });
        }}
      />
    );
  }

  const drafted = phase.at === "draft" || phase.at === "keeping";
  const outlined = drafted ? [...(place?.querySelectorAll("[data-graview-section-draft]") ?? [])] : phase.at === "kept" || phase.at === "undone" ? [] : section.elements;
  return (
    <>
      {outlined.length > 0 ? <SectionOutline elements={outlined} label={drafted ? "Draft" : undefined} /> : null}
      <div ref={card} role="dialog" aria-label={`Make “${section.name}” better`} data-testid="section-card" data-section-phase={phase.at} data-graview-popover="" style={CARD}>
        <p style={HEAD}>
          Make <strong>“{section.name}”</strong> better
        </p>
        {pointed ? (
          <p data-testid="section-pointed" style={MUTED}>
            You pointed at {pointed.name}.
          </p>
        ) : null}
        {phase.at === "asking" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (words.trim()) void revise(ask.mode, words.trim(), phase.pointed);
            }}
            style={{ display: "grid", gap: 8 }}
          >
            <label style={VISUALLY_HIDDEN} htmlFor="graview-section-words">
              {phase.pointed ? "What should change here?" : "What should change?"}
            </label>
            <input id="graview-section-words" ref={field} data-testid="section-words" value={words} onChange={(event) => setWords(event.target.value)} placeholder={phase.pointed ? "What should change here?" : "What should change?"} style={FIELD} />
            <div style={ROW}>
              <button type="submit" data-first="" disabled={!words.trim()} style={PRIMARY}>
                Revise
              </button>
              <button type="button" onClick={close} style={QUIET}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        <p role="status" aria-live="polite" data-testid="section-status" style={phase.at === "working" || phase.at === "keeping" ? THINKING : MUTED}>
          {phase.at === "working" ? `Revising “${section.name}”…` : phase.at === "keeping" ? "Keeping it…" : phase.at === "draft" ? phase.said : phase.at === "kept" ? `Kept.${phase.note ? ` ${phase.note}` : ""}` : phase.at === "undone" ? "Put back as it was." : phase.at === "refused" ? phase.said : ""}
        </p>
        {phase.at === "draft" ? (
          <>
            <p data-testid="section-draft-line" style={MUTED}>
              Draft — shown in place, not kept.
            </p>
            {phase.notes.map((note) => (
              <p key={note} data-testid="section-note" style={MUTED}>
                {note}
              </p>
            ))}
            <div style={ROW}>
              <button type="button" data-first="" data-testid="section-keep" onClick={() => void keep()} style={PRIMARY}>
                Keep
              </button>
              <button type="button" data-testid="section-discard" onClick={discard} style={QUIET}>
                Discard
              </button>
            </div>
          </>
        ) : null}
        {phase.at === "kept" ? (
          <div style={ROW}>
            <button type="button" data-first="" data-testid="section-undo" onClick={() => void undo()} style={QUIET}>
              Undo
            </button>
            <button type="button" onClick={close} style={QUIET}>
              Close
            </button>
          </div>
        ) : null}
        {phase.at === "refused" || phase.at === "undone" ? (
          <div style={ROW}>
            <button type="button" data-first="" onClick={close} style={QUIET}>
              Close
            </button>
          </div>
        ) : null}
        {/* 👍 and 👎 on what it answered, kept with its telling (Roadmap f-menu-learns). */}
        {telling && ai.told && phase.at !== "working" && phase.at !== "asking" ? <Rate told={ai.told} telling={telling} /> : null}
      </div>
    </>
  );
}

/**
 * HIGHLIGHT AREA: an overlay over the view. A drag draws a rectangle and
 * takes the parts it holds whole; a click takes the part under it; Escape,
 * or "Cancel", puts it away; "The whole section" takes the section itself
 * for a keyboard.
 */
export function Highlighter({ box: place, root, whole, wholeSaid = "The whole section", cancel, chose }: { readonly box: Element | null | undefined; readonly root: Element | null | undefined; readonly whole: readonly Element[]; readonly wholeSaid?: string; readonly cancel: () => void; readonly chose: (elements: readonly Element[]) => void }) {
  const cover = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const follow = () => {
      const box = place ? boxOf([place]) : null;
      const at = cover.current;
      /* A little past the view's edges, so a drag can begin outside what it means to take. */
      if (at && box) {
        at.style.left = `${Math.round(box.left - PAD)}px`;
        at.style.top = `${Math.round(box.top - PAD)}px`;
        at.style.width = `${Math.round(box.width + 2 * PAD)}px`;
        at.style.height = `${Math.round(box.height + 2 * PAD)}px`;
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [place]);
  useEffect(() => {
    cover.current?.focus();
  }, []);
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !root) return setDrag(null);
    const moved = Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) > 4;
    const rect = { left: Math.min(drag.x0, event.clientX), top: Math.min(drag.y0, event.clientY), right: Math.max(drag.x0, event.clientX), bottom: Math.max(drag.y0, event.clientY) };
    setDrag(null);
    const parts = partsIn(root, rect, !moved);
    if (parts.length > 0) chose(parts);
  };
  const box = drag ? { left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) } : null;
  return (
    <div
      ref={cover}
      tabIndex={-1}
      role="application"
      aria-label="Highlight the area to change: drag over it, or click one part"
      data-testid="section-highlighter"
      data-graview-popover=""
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      }}
      /* A drag here draws a rectangle, never a selection of the words under it. */
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDrag({ x0: event.clientX, y0: event.clientY, x1: event.clientX, y1: event.clientY });
      }}
      onPointerMove={(event) => setDrag((was) => (was ? { ...was, x1: event.clientX, y1: event.clientY } : was))}
      onPointerUp={end}
      onPointerCancel={() => setDrag(null)}
      style={COVER}
    >
      <p style={COVER_HINT}>
        Drag over the part to change, or click one ·{" "}
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => chose(whole)} style={LINK}>
          {wholeSaid}
        </button>{" "}
        ·{" "}
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={cancel} style={LINK}>
          Cancel
        </button>
      </p>
      {box ? <div data-testid="section-drag" style={{ ...DRAG, left: box.left - (cover.current?.getBoundingClientRect().left ?? 0), top: box.top - (cover.current?.getBoundingClientRect().top ?? 0), width: box.width, height: box.height }} /> : null}
    </div>
  );
}

export { readPart, placeBeside };
const CARD: CSSProperties = {
  position: "fixed",
  zIndex: layer("popover"),
  boxSizing: "border-box",
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float, var(--graview-panel))",
  color: "var(--graview-ink)",
  boxShadow: "var(--graview-lift-high)",
  maxHeight: "calc(100dvh - 24px)",
  overflowY: "auto",
  fontSize: "0.875rem",
};
const HEAD: CSSProperties = { margin: 0, fontSize: "0.9375rem" };
const MUTED: CSSProperties = { margin: 0, color: "var(--graview-ink-muted)" };
const THINKING: CSSProperties = { margin: 0, color: "var(--graview-ink)", fontStyle: "italic" };
const ROW: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const FIELD: CSSProperties = { boxSizing: "border-box", width: "100%", height: 36, padding: "0 10px", font: "inherit", fontSize: "max(1rem,16px)", color: "var(--graview-ink)", background: "var(--graview-panel)", border: "1px solid var(--graview-edge)", borderRadius: 8 };
const BUTTON: CSSProperties = { minHeight: 36, padding: "0 14px", font: "inherit", borderRadius: 8, cursor: "pointer" };
const PRIMARY: CSSProperties = { ...BUTTON, color: "var(--graview-accent-ink, #fff)", background: "var(--graview-accent)", border: "1px solid var(--graview-accent)" };
const QUIET: CSSProperties = { ...BUTTON, color: "var(--graview-ink)", background: "transparent", border: "1px solid var(--graview-edge)" };
const LINK: CSSProperties = { font: "inherit", color: "inherit", background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer" };
const PAD = 12;
const COVER: CSSProperties = { userSelect: "none", WebkitUserSelect: "none", position: "fixed", zIndex: layer("popover"), boxSizing: "border-box", cursor: "crosshair", touchAction: "none", outline: "2px dashed var(--graview-accent)", background: "color-mix(in srgb, var(--graview-accent) 6%, transparent)" };
const COVER_HINT: CSSProperties = { position: "absolute", left: 8, top: 8, margin: 0, padding: "4px 10px", borderRadius: 999, fontSize: "0.8125rem", color: "var(--graview-ink)", background: "var(--graview-float, var(--graview-panel))", border: "1px solid var(--graview-edge)", boxShadow: "var(--graview-lift-low)", cursor: "default" };
const DRAG: CSSProperties = { position: "absolute", border: "2px solid var(--graview-accent)", background: "color-mix(in srgb, var(--graview-accent) 14%, transparent)", borderRadius: 4, pointerEvents: "none" };

/** The card's look, shared with a built-in page's card. */
export const LOOK = { CARD, HEAD, MUTED, THINKING, ROW, FIELD, PRIMARY, QUIET } as const;
