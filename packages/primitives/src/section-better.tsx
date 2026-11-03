import { layer, type AnySchema, type ViewReviseAnswer } from "@graview/core";
import type { AiInteraction, AiStage, AiUsage } from "@graview/core/catalog";
import { compareViewRevision } from "@graview/core/revisions";
import { useGraview, type MenuViewSection, type ViewPlaceDraft, type ViewPlaceHandle } from "@graview/react/provider";
import { sectionUnderNow, viewPlaceOf } from "@graview/react/drawing";
import { describeChange, drawnFindings, lookOf, runDesignAgent, type DesignTalk, type DrawnRead, type SectionStage } from "@graview/tools/section";
import { interactionId } from "@graview/tools/inline-ai";
import type { Telling, TellingOutcome, ToldStore } from "@graview/core/told";
import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { SectionAsk } from "./section-menu.js";
import { boxOf, SectionOutline } from "./section-outline.js";
import { readDrawn, Redesigning } from "./better-bar.js";
import { BetterPanel } from "./better-panel.js";

export { SectionOutline };
import { nameParts, partLines, placeOfSection, type PartRead } from "./section-words.js";
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
 * of the view kept — and judged before anybody sees it (Roadmap
 * f-make-any-page-better): drawn as a draft in the view's place under a
 * cover saying "Graview is redesigning “This week”…", its stylesheet read
 * by the host's sanitizer, the host's checks of a view's code, compared
 * with what it replaces (`compareViewRevision`, `drawnFindings`). What
 * breaks is handed back — the light model again, then the full one once —
 * and what never passes is said plainly. Once it passed, the cover lifts
 * and the card is a bar at the window's foot (`DraftBar`): what changed,
 * said by code; Before and After; another step in words, and a step back;
 * Keep through the host's view door (`KeptViews.revise`), one Undo after.
 * Activity keeps each one as an entry.
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
  | { readonly at: "open" }
  | { readonly at: "working" }
  | { readonly at: "draft" }
  | { readonly at: "keeping" }
  | { readonly at: "kept"; readonly source: string; readonly note?: string; readonly answer: ViewReviseAnswer; readonly entry: AiInteraction }
  | { readonly at: "undone" };

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

/** The labels a view's drawing shows for its records: each keyed row's words. */
function keyedLabels(root: ParentNode | null | undefined): string[] {
  if (!root) return [];
  return [...new Set([...root.querySelectorAll("[data-key]")].map((one) => (one.textContent ?? "").replace(/\s+/g, " ").trim()).filter((label) => label.length > 1 && label.length < 80))].slice(0, 40);
}

export function SectionCard({ ask, close }: SectionCardProps) {
  const { ai, aiDesk, aiHere, session, principal, keptViews } = useGraview<AnySchema>();
  const [section, setSection] = useState<MenuViewSection>(ask.section);
  const place = placeOfSection(ask.section);
  const handle = useRef<ViewPlaceHandle | undefined>(viewPlaceOf(place));
  const draft = useRef<ViewPlaceDraft | null>(null);
  const [phase, setPhase] = useState<Phase>(ask.mode === "highlight" ? { at: "highlighting" } : { at: "open" });
  /* The view's code before any step, the page as it was read, the drafts that passed, the conversation and this turn's steps. */
  const original = useRef<string | undefined>(undefined);
  const before = useRef<DrawnRead | null>(null);
  const steps = useRef<{ readonly source: string; readonly said: string; readonly entry: AiInteraction }[]>([]);
  const talk = useRef<DesignTalk[]>([]);
  const events = useRef<{ readonly kind: string; readonly text: string }[]>([]);
  const since = useRef(Date.now());
  const stopping = useRef<AbortController | null>(null);
  const pointedAt = useRef<{ readonly name: string; readonly lines: readonly string[] } | null>(null);
  const [covering, setCovering] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((one) => one + 1), []);
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
  /** Keeps what was said and decided as a telling: offered as a draft ("previewed"), or not. */
  const tell = useCallback(
    (words: string, on: MenuViewSection, refused: boolean, stages: readonly SectionStage[], ms: number, interaction: string) => {
      const keeps = ai.told;
      if (!keeps) return;
      void toldCard.load().then((module) => {
        const kept = module.keepTelling(keeps, { words, target: { on: "place", place: on.view }, decided: refused ? { type: "refusal" } : { type: "view", section: on.name }, slot: "full", stages: stages.map((one) => ({ stage: one.stage === "thinking" ? "full" : "light", ms: one.ms, model: one.model })), ms, outcome: refused ? "abandoned" : "previewed", interaction }, principal);
        tellingNow.current = kept ?? null;
        setTelling(kept ?? null);
      }, () => undefined);
    },
    [ai.told, principal],
  );

  /* Put away: a draft not kept goes with the card, and the view stands as it was. */
  useEffect(
    () => () => {
      stopping.current?.abort();
      draft.current?.dispose();
      draft.current = null;
    },
    [],
  );

  /* GRAVIEW IS HERE WHILE IT WORKS, as it is beside the quick ask. */
  const working = phase.at === "working";
  useEffect(() => {
    if (!working) return;
    aiHere({ participant: `agent:graview-for-${principal.id ?? "anyone"}:${session}`, kind: "agent", name: "Graview", ...(principal.id ? { onBehalfOf: principal.id } : {}), over: null, robot: { at: null, mode: "thinking" } });
    return () => aiHere(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working]);

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

  /** The draft drawn in the view's place: the code given, drawn again. */
  const drawDraft = useCallback(async (source: string) => {
    draft.current?.dispose();
    const view = handle.current!;
    const drawn = view.draft(source);
    draft.current = drawn;
    await drawn.drawn;
    return drawn;
  }, []);
  /** The view as the person last saw it: the newest draft that passed, or the view as it was. */
  const showLatest = useCallback(async () => {
    const latest = steps.current.at(-1);
    setComparing(false);
    if (latest) await drawDraft(latest.source);
    else {
      draft.current?.dispose();
      draft.current = null;
    }
  }, [drawDraft]);

  const say = useCallback(
    (who: DesignTalk["who"], words: string) => {
      talk.current.push({ who, said: words });
      redraw();
    },
    [redraw],
  );
  const askedWords = () => talk.current.filter((one) => one.who === "person").map((one) => one.said).join(" ");

  /** One turn of the agent on the section: it looks, drafts the whole script with the section changed, is told what the checks found, and drafts again. */
  const askFor = useCallback(
    async (words: string) => {
      const view = handle.current;
      if (!view || phase.at === "working") return;
      const pointed = pointedAt.current;
      pointedAt.current = null;
      say("person", pointed ? `${words} (${pointed.name})` : words);
      events.current = [];
      since.current = Date.now();
      setPhase({ at: "working" });
      const live = await view.source();
      if (live === undefined) {
        say("graview", "This view can't be changed here.");
        return setPhase({ at: "open" });
      }
      original.current ??= live;
      const liveDrawing = view.drawing();
      const liveRefused = view.refused();
      before.current ??= readDrawn(liveDrawing.root?.parentElement ?? liveDrawing.root ?? place, keyedLabels(liveDrawing.root));
      const was = before.current;
      const stop = new AbortController();
      stopping.current = stop;
      const started = Date.now();
      const turnBegan = steps.current.length;
      const result = await runDesignAgent({
        ai,
        part: { name: section.name, slot: "place" },
        manifest: { name: view.name, attach: "view", cardinality: "many" },
        talk: talk.current,
        keep: { title: "", headings: was.headings, records: was.records.map((one) => one.label), says: Object.fromEntries(was.records.flatMap((one) => (one.facts?.length || one.under ? [[one.label, { ...(one.facts?.length ? { shows: one.facts } : {}), ...(one.under ? { under: one.under } : {}) }]] : []))) },
        current: steps.current.at(-1)?.source ?? live,
        section: section.name,
        noun: "records",
        host: {
          look: () => lookOf(readDrawn(view.drawing().root?.parentElement ?? place, was.records.map((one) => one.label))),
          read: () => ({ shows: shownBy(section.elements) }),
          draft: async (source) => {
            setCovering(true);
            try {
              const refused = await view.check(source);
              if (refused.length > 0) {
                await showLatest();
                return { findings: refused, drew: undefined };
              }
              const drawn = await drawDraft(source);
              const { failed } = await drawn.drawn;
              if (failed) {
                await showLatest();
                return { findings: [`The view did not draw: ${failed}`], drew: undefined };
              }
              await new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled)));
              const root = drawn.drawing().root;
              const now = readDrawn(root?.parentElement ?? root, was.records.map((one) => one.label));
              const findings = [...judged(view, original.current!, liveDrawing, liveRefused, drawn, source).findings, ...drawnFindings(was, now, { asked: askedWords() })];
              if (findings.length > 0) await showLatest();
              else {
                steps.current.push({ source, said: describeChange(section.name, was, now) ?? `“${section.name}” has changed. Compare Before and After.`, entry: entryOf(`Make “${section.name}” better: ${askedWords()}`, "offered", []) });
                setComparing(false);
              }
              return { findings, drew: lookOf(now) };
            } finally {
              setCovering(false);
            }
          },
        },
        onEvent: (event) => {
          // The words as the model writes them stand in for the step it is on, and give way to the step once it is said.
          if (events.current.at(-1)?.kind === "streaming") events.current.pop();
          events.current.push(event);
          redraw();
        },
        signal: stop.signal,
      });
      if (stopping.current !== stop) return;
      stopping.current = null;
      if (events.current.at(-1)?.kind === "streaming") events.current.pop();
      const offered = steps.current.length > turnBegan;
      const entry = entryOf(`Make “${section.name}” better: ${askedWords()}`, offered ? "offered" : "failed", result.stages, offered ? {} : { failed: result.last?.findings.join(" ") ?? result.said });
      aiDesk.record(entry);
      tell(askedWords(), section, !offered, result.stages, Date.now() - started, entry.id);
      say("graview", result.said);
      setPhase(steps.current.length > 0 ? { at: "draft" } : { at: "open" });
    },
    [ai, aiDesk, drawDraft, entryOf, phase.at, place, redraw, say, section, showLatest, tell],
  );

  /** Stop: at once — the turn's drafts gone, the view as it was before it began. */
  const stopTurn = useCallback(() => {
    if (phase.at !== "working") return;
    const stop = stopping.current;
    stopping.current = null;
    stop?.abort();
    setCovering(false);
    const began = new Date(since.current).toISOString();
    steps.current = steps.current.filter((one) => one.entry.at < began);
    void showLatest();
    say("graview", "Stopped. The view is as it was.");
    setPhase(steps.current.length > 0 ? { at: "draft" } : { at: "open" });
  }, [phase.at, say, showLatest]);

  /* Words that came with the ask — typed in the menu, or a suggestion taken — are asked at once. */
  const began = useRef(false);
  useEffect(() => {
    if (began.current || !(ask.mode === "just" || (ask.mode === "describe" && ask.words))) return;
    began.current = true;
    void askFor(ask.mode === "just" ? "Make it easier to read at a glance" : ask.words!);
  }, [ask.mode, ask.words, askFor]);

  const current = steps.current.at(-1);
  const compare = useCallback(
    async (originalShown: boolean) => {
      if (!current || originalShown === comparing) return;
      setComparing(originalShown);
      if (originalShown) {
        draft.current?.dispose();
        draft.current = null;
      } else await drawDraft(current.source);
    },
    [current, comparing, drawDraft],
  );

  const keep = useCallback(async () => {
    const latest = steps.current.at(-1);
    if (phase.at !== "draft" || !latest || !keptViews?.revise || !handle.current) return;
    const view = handle.current;
    const was = (await view.source()) ?? "";
    setPhase({ at: "keeping" });
    try {
      const answer = await keptViews.revise({ name: view.name, title: view.title, source: latest.source, before: was, section: section.name, said: latest.said });
      draft.current?.dispose();
      draft.current = null;
      view.draw(latest.source);
      aiDesk.record({ ...latest.entry, outcome: "accepted" });
      ended("accepted");
      steps.current = [];
      setPhase({ at: "kept", source: was, ...(answer && answer.note ? { note: answer.note } : {}), answer, entry: latest.entry });
    } catch {
      say("graview", "It couldn't be kept.");
      setPhase({ at: "draft" });
    }
  }, [phase, keptViews, aiDesk, section.name, ended, say]);

  const discard = useCallback(() => {
    draft.current?.dispose();
    draft.current = null;
    const latest = steps.current.at(-1);
    if (latest) {
      aiDesk.record({ ...latest.entry, outcome: "dismissed" });
      ended("declined");
    }
    steps.current = [];
    setComparing(false);
    say("graview", "Put back as it was.");
    setPhase({ at: "open" });
  }, [aiDesk, ended, say]);

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
      say("graview", "Undone. The view is as it was.");
      setPhase({ at: "undone" });
    } catch {
      say("graview", "It couldn't be put back.");
    }
  }, [phase, keptViews, aiDesk, section.name, ended, say]);

  /* Escape: Stop while it works, else put it away. */
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || phase.at === "highlighting") return;
      event.preventDefault();
      if (phase.at === "working") return stopTurn();
      if (steps.current.length > 0) ended("declined");
      close();
      ask.returnTo?.focus?.();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [phase.at, stopTurn, close, ended, ask.returnTo]);

  if (phase.at === "highlighting") {
    return (
      <Highlighter
        box={place}
        root={place?.querySelector("[data-worker-view]")?.shadowRoot?.querySelector("[data-graview-view-root]") ?? undefined}
        whole={section.elements}
        cancel={() => setPhase({ at: "open" })}
        chose={(elements) => {
          const first = elements[0];
          const under = first ? sectionUnderNow(first) : undefined;
          setSection(under ?? section);
          pointedAt.current = { name: nameParts(elements.map(readPart)), lines: partLines(elements.map(readPart)) };
          setPhase({ at: "open" });
        }}
      />
    );
  }

  return (
    <>
      {section.elements.length > 0 && phase.at === "open" && talk.current.length === 0 ? <SectionOutline elements={section.elements} /> : null}
      {covering ? <Redesigning over={place} name={section.name} said={`Graview is drafting “${section.name}”…`} /> : null}
      <BetterPanel
        name={section.name}
        scope={`This changes how “${section.name}” looks for everyone in this app.`}
        phase={phase.at}
        talk={talk.current}
        steps={events.current}
        since={since.current}
        working={phase.at === "working" || phase.at === "keeping"}
        {...(current && phase.at === "draft" ? { draft: { said: current.said, before: comparing } } : {})}
        {...(phase.at === "kept" ? { kept: { ...(phase.note ? { note: phase.note } : {}), undo: () => void undo() } } : {})}
        {...(pointedAt.current ? { pointed: pointedAt.current.name } : {})}
        ask={(words) => void askFor(words)}
        just={() => void askFor("Make it easier to read at a glance")}
        point={() => setPhase({ at: "highlighting" })}
        stop={stopTurn}
        compare={(originalShown) => void compare(originalShown)}
        keep={() => void keep()}
        discard={discard}
        close={() => {
          stopping.current?.abort();
          if (steps.current.length > 0) ended("declined");
          close();
        }}
      >
        {/* 👍 and 👎 on what it answered, kept with its telling (Roadmap f-menu-learns). */}
        {telling && ai.told && phase.at !== "working" ? <Rate told={ai.told} telling={telling} /> : null}
      </BetterPanel>
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
