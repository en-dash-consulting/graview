import { type AnySchema, type ViewForkKept, type ViewReviseAnswer } from "@graview/core";
import type { AiInteraction, AiStage, AiUsage } from "@graview/core/catalog";
import { useGraview, type ProposeChangeAnswer, type ReshapeProposal } from "@graview/react/provider";
import { viewPlaceOf, type ViewPlaceHandle } from "@graview/react/drawing";
import { COULD_NOT, describeChange, draftPageSpec, draftPageView, drawnFindings, forkManifest, mayChangeDeclaration, specCanSay, type DrawnRead, type ForkManifest, type PagePartSaid, type SectionStage } from "@graview/tools/section";
import { interactionId } from "@graview/tools/inline-ai";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PagePart } from "./page-parts.js";
import { boxOf, SectionOutline } from "./section-outline.js";
import { Highlighter, LOOK, placeBeside, readPart } from "./section-better.js";
import { DraftBar, readDrawn, Redesigning } from "./better-bar.js";
import type { SectionAsk } from "./section-menu.js";
import { nameParts, partLines } from "./section-words.js";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * BETTER UI ON A BUILT-IN PAGE (Roadmap f-make-any-page-better), fetched
 * the first time it is asked for on a page the app draws by itself.
 *
 * SETTINGS FIRST. The Fast slot says whether the view spec — what a card,
 * a row and a page show, how a list opens — can say what was asked. Where
 * it can, the light model drafts the least edits over it, the host's
 * composer judges them by the checker (`composeChange`), and the page is
 * drawn with them on this page only (`onDraftChange`).
 *
 * THEN A NEW DESIGN. Where the settings cannot say it, the card asks in
 * plain words, and Yes drafts a worker view seeded from the page as it
 * stands, drawn in its place on this page only (`KeptViews.draftFork`).
 *
 * NEVER A BROKEN DRAFT. Either kind of draft is drawn under a cover that
 * says "Graview is redesigning “Lists”…" and judged before anybody sees
 * it: what the host would strip, what it refused, and the page read again
 * against the page as it was (`drawnFindings`: nothing it showed lost,
 * no heading twice, no value as the computer keeps it). What fails is
 * handed back — the light model, again, then the full one once — and what
 * never passes is said plainly: "I couldn't make a version that looks
 * right." Nothing broken is shown.
 *
 * THE DRAFT GETS THE PAGE. Once it passed, the cover lifts, and the card
 * is a slim bar at the window's foot (`DraftBar`): what changed, said by
 * code from the edits or from the two readings, never the model's account
 * of itself; who it changes it for; Before and After; "Tell it what to
 * change…" for another step, and a step back; Keep and Discard. Keep makes
 * it the page; one Undo after.
 */

type Pointed = { readonly name: string; readonly lines: readonly string[] };
type Phase =
  | { readonly at: "highlighting" }
  | { readonly at: "choose" }
  | { readonly at: "asking"; readonly pointed?: Pointed }
  | { readonly at: "design"; readonly asked: Asked }
  | { readonly at: "working" }
  | { readonly at: "draft" }
  | { readonly at: "keeping" }
  | { readonly at: "kept"; readonly note?: string; readonly undo?: () => void | Promise<void> }
  | { readonly at: "undone" }
  | { readonly at: "refused"; readonly said: string; readonly asked?: Asked };

const words = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** A heading's own words, without a count or a disclosure's arrow drawn beside them: "Someday", from "▾ Someday · 3". */
function headingWords(heading: Element): string {
  const copy = heading.cloneNode(true) as Element;
  for (const span of copy.querySelectorAll("span")) span.remove();
  return words(copy.textContent).replace(/^[▸▾]\s*/, "");
}

/** What a page shows, as a fingerprint: its words and its shape. A draft that leaves it the same changed nothing drawn here. */
export function drawnSignature(main: Element | null): string {
  if (!main || !main.isConnected) return "";
  const text = (main as HTMLElement).innerText ?? main.textContent ?? "";
  return `${main.querySelectorAll("*").length}|${words(text)}`;
}

/** The page as it stands, a line each: its headings, its rows and cards, its facts — what a view of it is seeded from. */
export function outlineOf(main: Element | null, most = 80): string {
  if (!main) return "";
  const lines: string[] = [];
  const taken = new Set<Element>();
  const ROW = 'li, tr, article, [data-graview-listed], [data-graview-record], [data-graview-field]';
  for (const element of main.querySelectorAll(`h1, h2, h3, h4, ${ROW}`)) {
    if (lines.length >= most) break;
    if ([...taken].some((one) => one.contains(element))) continue;
    if (element.closest("[data-graview-popover], [hidden], nav, [aria-hidden='true']")) continue;
    const heading = /^h([1-4])$/i.exec(element.localName);
    const said = (heading ? headingWords(element) : words((element as HTMLElement).innerText ?? element.textContent)).slice(0, 140);
    if (!said) continue;
    if (heading) lines.push(`${"#".repeat(Number(heading[1]))} ${said}`);
    else {
      const field = element.getAttribute("data-graview-field");
      lines.push(field ? `${field}: ${said}` : `- ${said}`);
      taken.add(element);
    }
  }
  return lines.join("\n");
}

/** The records a view of the page reads, a few of each, as the view is handed them. */
function dataOf(here: ReturnType<typeof useGraview<AnySchema>>, part: PagePart): unknown {
  const { store } = here;
  const plain = (node: object) => Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined && typeof value !== "object").map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]));
  const kinds = part.kind ? [part.kind] : store.schema.kinds.slice(0, 6);
  return {
    kinds: kinds.map((kind) => {
      const nodes = store.graph.nodesOfKind(kind);
      const definition = store.schema.tryDefinition(kind) as { readonly fields?: { readonly shape?: object }; readonly edges?: Readonly<Record<string, unknown>> } | undefined;
      return { kind, count: nodes.length, fields: Object.keys(definition?.fields?.shape ?? {}), relations: Object.keys(definition?.edges ?? {}), some: (part.record ? nodes.filter((node) => node.id === part.record) : nodes.slice(0, 3)).map(plain) };
    }),
  };
}

/** The kinds and relations a view of this page reads: the kind's links, both ways; the home, everything. */
function linksOf(here: ReturnType<typeof useGraview<AnySchema>>, part: PagePart): { kinds: string[]; edges: string[] } {
  const schema = here.store.schema;
  const kinds = new Set<string>();
  const edges = new Set<string>();
  for (const definition of schema.definitions) {
    for (const [name, edge] of Object.entries((definition.edges ?? {}) as Readonly<Record<string, { readonly to?: readonly string[] | "*" }>>)) {
      const to = Array.isArray(edge?.to) ? edge.to : [];
      const touches = part.kind === undefined || definition.kind === part.kind || to.includes(part.kind);
      if (!touches) continue;
      edges.add(name);
      for (const kind of [definition.kind, ...to]) if (kind !== part.kind && schema.tryDefinition(kind)) kinds.add(kind);
    }
  }
  if (part.kind === undefined) for (const kind of schema.kinds) kinds.add(kind);
  return { kinds: [...kinds], edges: [...edges] };
}

/** Why a view could not be drawn, in words a model can act on, from the mark its host left where it fell back. */
const FELL_BACK: Readonly<Record<string, string>> = {
  manifest: "The view could not start: what it reads is not this app's.",
  source: "The script is too long: make it shorter.",
  start: "The script did not start: it must be one plain script, with no syntax errors, that calls graview.onProps and graview.render.",
  error: "The script threw while drawing: read only what props gives (props.nodes for a list, props.node for one record), guard each value that may be missing, and call no function that does not exist.",
};

/** The view's place on the page, once the host has drawn the view of this name there: its handle — or why it fell back. */
async function placeOfView(name: string, ms = 15000): Promise<{ readonly element: Element; readonly handle: ViewPlaceHandle } | { readonly failed: string }> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    for (const element of document.querySelectorAll("[data-worker-view-place]")) {
      const handle = viewPlaceOf(element);
      if (handle?.name === name && handle.drawing().root) return { element, handle };
    }
    const fell = document.querySelector(`[data-worker-view-fell-back="${CSS.escape(name)}"]`);
    if (fell) return { failed: FELL_BACK[fell.getAttribute("data-worker-view-failed") ?? ""] ?? FELL_BACK["error"]! };
    await wait(80);
  }
  return { failed: "The view did not draw in time: keep it simple and quick to draw." };
}

/*
 * THE CARD'S STATE OUTLIVES THE CARD (Roadmap f-make-any-page-better): a
 * host that hands the page a changed app may draw it all again, and the
 * card with it (`carried` in `section-menu.tsx`). What it is at, its steps,
 * what puts the page back from a draft and the page as it was read before
 * any draft are kept here by the card's ask, and dropped when it is put away.
 */
type Step = { readonly kind: "spec"; readonly edits: readonly unknown[]; readonly said: string; readonly entry: AiInteraction } | { readonly kind: "view"; readonly source: string; readonly said: string; readonly entry: AiInteraction };
interface CardHeld {
  phase: Phase;
  steps: Step[];
  before: boolean;
  putBack: (() => void | Promise<void>) | null;
  began: boolean;
  original: DrawnRead | null;
  readonly heard: Set<() => void>;
}
const CARDS = /* @__PURE__ */ new Map<number, CardHeld>();
const cardOf = (at: number, first: () => Phase): CardHeld => {
  let held = CARDS.get(at);
  if (!held) CARDS.set(at, (held = { phase: first(), steps: [], before: false, putBack: null, began: false, original: null, heard: new Set() }));
  return held;
};

/** The labels of the records the page showed: what a draft must still show. */
function labelsShown(here: ReturnType<typeof useGraview<AnySchema>>, part: PagePart, text: string): string[] {
  const { store } = here;
  const nodes = part.record ? [store.graph.getNode(part.record)].filter(Boolean) : part.kind ? store.graph.nodesOfKind(part.kind) : store.schema.kinds.flatMap((kind) => store.graph.nodesOfKind(kind));
  const read = words(text).toLowerCase();
  return nodes
    .map((node) => String((node as Record<string, unknown>)["label"] ?? ""))
    .filter((label) => label.length > 1 && read.includes(words(label).toLowerCase()))
    .slice(0, 40);
}

/** The fields of the part's kind, by name: words a draft must not show as they are kept. */
function fieldsOf(here: ReturnType<typeof useGraview<AnySchema>>, part: PagePart): string[] {
  const kinds = part.kind ? [part.kind] : here.store.schema.kinds;
  return kinds.flatMap((kind) => Object.keys(((here.store.schema.tryDefinition(kind) as { fields?: { shape?: object } } | undefined)?.fields?.shape ?? {}) as object));
}

export function PageCard({ ask, close }: { readonly ask: Extract<SectionAsk, { part: object }>; readonly close: () => void }) {
  const here = useGraview<AnySchema>();
  const { ai, aiDesk, aiHere, session, principal, keptViews, store, onProposeChange, composeChange, onDraftChange, app } = here;
  const part = ask.part;
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const held = useMemo(
    () => cardOf(ask.at, () => (ask.mode === "highlight" ? { at: "highlighting" } : ask.mode === "choose" ? { at: "choose" } : ask.mode === "describe" && !ask.words ? { at: "asking" } : { at: "working" })),
    [ask],
  );
  const subscribe = useCallback((listener: () => void) => (held.heard.add(listener), () => void held.heard.delete(listener)), [held]);
  const phase = useSyncExternalStore(subscribe, () => held.phase, () => held.phase);
  const tell = useCallback(() => held.heard.forEach((listener) => listener()), [held]);
  const setPhase = useCallback(
    (next: Phase) => {
      held.phase = next;
      tell();
    },
    [held, tell],
  );
  const [typed, setTyped] = useState(ask.words ?? "");
  const backFromDraft = useCallback(async () => {
    const back = held.putBack;
    held.putBack = null;
    if (back) await back();
  }, [held]);
  /* Put away for good: a draft not kept goes with it, and the page stands as it was. */
  const putAway = useCallback(() => {
    void backFromDraft();
    CARDS.delete(ask.at);
    close();
  }, [backFromDraft, ask.at, close]);
  /* The page's own region now: the one the part was read in, or the one drawn again since. */
  const mainNow = useCallback(() => (part.main?.isConnected ? part.main : document_main()), [part]);

  const said: PagePartSaid = { name: part.name, slot: part.slot, ...(part.kind ? { kind: part.kind } : {}), ...(part.group ? { group: part.group } : {}) };
  const placeName = part.place ?? (part.kind ? `${part.kind}-${part.slot}` : "home");
  const scope = `This changes how ${part.name} looks for everyone in this app.`;
  const entryOf = useCallback(
    (asked: string, outcome: AiInteraction["outcome"], stages: readonly SectionStage[], extra: Partial<AiInteraction> = {}): AiInteraction => ({
      id: interactionId(),
      at: new Date().toISOString(),
      by: principal,
      target: { on: "place", place: placeName },
      targetLabel: part.name,
      ask: { kind: "section", said: asked },
      offered: [],
      outcome,
      stages: stages.map((one): AiStage => ({ stage: one.stage, ms: one.ms, model: one.model })),
      usage: stages.flatMap((one): AiUsage[] => (one.usage ? [{ tier: one.stage === "light" ? "fast" : "thinking", model: one.model, inputTokens: one.usage.inputTokens, outputTokens: one.usage.outputTokens } as AiUsage] : [])),
      ...extra,
    }),
    [principal, placeName, part.name],
  );

  /* What this seat may do here: change the app's settings through the host, and give the page a new design. */
  const specHost = onProposeChange !== undefined && composeChange !== undefined && mayChangeDeclaration(store, principal);
  const manifest: ForkManifest | undefined = forkManifest(said, linksOf(here, part));
  const forkHost = manifest !== undefined && typeof keptViews?.fork === "function" && typeof keptViews.draftFork === "function" && keptViews.current().may.views === true;
  const from: ViewForkKept["from"] = part.slot === "record" ? { page: "record", kind: part.kind! } : part.slot === "home" ? { page: "home" } : { page: "list", kind: part.kind ?? "" };
  const forkOf = useCallback((source: string): ViewForkKept => ({ manifest: manifest!, source, from, said: "" }), [manifest, from]);

  /* GRAVIEW IS HERE WHILE IT WORKS, as it is beside the quick ask: on the part, among who is here. */
  const working = phase.at === "working";
  useEffect(() => {
    if (!working) return;
    const at = part.record ?? (part.kind ? `kind:${part.kind}` : null);
    aiHere({ participant: `agent:graview-for-${principal.id ?? "anyone"}:${session}`, kind: "agent", name: "Graview", ...(principal.id ? { onBehalfOf: principal.id } : {}), over: at, robot: { at, mode: "thinking" } });
    return () => aiHere(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working]);

  /** The page as it was, read once before any draft: what every draft is judged against and compared with. */
  const original = useCallback((): DrawnRead => {
    if (held.original) return held.original;
    const main = mainNow();
    const text = (main as HTMLElement | null)?.innerText ?? "";
    held.original = readDrawn(main, labelsShown(here, part, text));
    return held.original;
  }, [held, mainNow, here, part]);
  /** The page now, read as the original was. */
  const drawnNow = useCallback(() => readDrawn(mainNow(), original().records.map((one) => one.label)), [mainNow, original]);

  /** Where the settings cannot say it: a new design, offered — or said plainly, where this page cannot have one. */
  const offerDesign = useCallback(
    (asked: Asked) => {
      if (forkHost) return setPhase({ at: "design", asked });
      setPhase({ at: "refused", said: "Its settings can't do that, and a new design can't be drawn for it here." });
    },
    [forkHost, setPhase],
  );

  /** A step shown on the page: the settings' edits laid over this page alone, or the new design drawn in its place. */
  const show = useCallback(
    async (step: Step) => {
      await backFromDraft();
      if (step.kind === "spec") {
        const shown = await onDraftChange!(proposalOf(step.edits, step.said, ai.name));
        held.putBack = shown.undo;
      } else {
        keptViews!.draftFork!(forkOf(step.source));
        held.putBack = () => keptViews!.draftFork!(null);
      }
    },
    [backFromDraft, onDraftChange, held, keptViews, forkOf, ai.name],
  );

  /** SETTINGS FIRST: can they say it, the least edits that do, checked, drawn under cover and judged before anybody sees it. */
  const run = useCallback(
    async (asked: Asked, after?: Extract<Step, { kind: "spec" }>) => {
      const askedSaid = asked.mode === "just" ? `Make “${part.name}” better` : `Make “${part.name}” better: ${asked.words}`;
      original();
      setPhase({ at: "working" });
      const reshape = specHost ? await import("@graview/tools/reshape") : undefined;
      const remembered = reshape?.documentOfApp(app ?? {});
      if (!specHost || !remembered || !onDraftChange) return offerDesign(asked);
      const before = after?.edits ?? [];
      const composedBefore = before.length > 0 ? composeChange!({ document: remembered, edits: before }) : undefined;
      const document = composedBefore?.ok ? composedBefore.document : remembered;
      const can = asked.mode === "just" ? { can: true } : await specCanSay(ai, asked.words, said);
      if (!can.can) return after ? setPhase({ at: "refused", said: COULD_NOT, asked }) : offerDesign(asked);
      let lines: readonly string[] = [];
      const drafted = await draftPageSpec({
        ai,
        document,
        part: said,
        mode: asked.mode === "choose" ? "just" : asked.mode,
        ...(asked.words ? { words: asked.words } : {}),
        ...(asked.pointed ? { highlighted: [asked.pointed.name, ...asked.pointed.lines] } : {}),
        shows: outlineOf(mainNow(), 30),
        judge: async (edits) => {
          const composed = composeChange!({ document: remembered, edits: [...before, ...edits] });
          if (!composed.ok) return [composed.refused];
          lines = composed.said;
          return [];
        },
      });
      if (!drafted.ok) {
        aiDesk.record(entryOf(askedSaid, "failed", drafted.stages, { failed: drafted.refused }));
        return after ? setPhase({ at: "refused", said: COULD_NOT, asked }) : offerDesign(asked);
      }
      const edits = [...before, ...drafted.edits];
      const entry = entryOf(askedSaid, "offered", drafted.stages);
      /* Drawn under cover, and judged by what it changed of what is drawn and what it kept. */
      const was = drawnSignature(mainNow());
      const step: Step = { kind: "spec", edits, said: lines[lines.length - 1] ?? lines[0] ?? `${part.name} changed.`, entry };
      try {
        await show(step);
      } catch {
        return setPhase({ at: "refused", said: COULD_NOT, asked });
      }
      let now = was;
      for (const until = Date.now() + 1500; Date.now() < until && now === was; ) {
        await frame();
        now = drawnSignature(mainNow());
      }
      const findings = now === was ? ["nothing changed"] : drawnFindings(original(), drawnNow(), { fields: fieldsOf(here, part) });
      if (findings.length > 0) {
        await (held.steps.length > 0 ? show(held.steps.at(-1)!) : backFromDraft());
        aiDesk.record({ ...entry, outcome: "failed", failed: findings.join(" ") });
        return after ? setPhase({ at: "refused", said: COULD_NOT, asked }) : offerDesign(asked);
      }
      held.steps.push(step);
      held.before = false;
      setPhase({ at: "draft" });
    },
    [ai, aiDesk, app, backFromDraft, composeChange, entryOf, held, here, mainNow, onDraftChange, offerDesign, original, drawnNow, part, said, setPhase, show, specHost],
  );

  /** A NEW DESIGN: seeded from the page as it stands, changed as asked, drawn under cover in its place and judged there. */
  const design = useCallback(
    async (asked: Asked, after?: Extract<Step, { kind: "view" }>) => {
      if (!manifest || !keptViews?.draftFork) return;
      const askedSaid = asked.mode === "just" ? `Draw “${part.name}” anew` : `Draw “${part.name}” anew: ${asked.words}`;
      const was = original();
      setPhase({ at: "working" });
      const fields = fieldsOf(here, part);
      const drafted = await draftPageView({
        ai,
        part: said,
        manifest,
        mode: asked.mode === "choose" ? "just" : asked.mode,
        ...(asked.words ? { words: asked.words } : {}),
        ...(asked.pointed ? { highlighted: [asked.pointed.name, ...asked.pointed.lines] } : {}),
        ...(after ? { current: after.source } : {}),
        outline: outlineOf(mainNow()),
        keep: keepsOf(was, mainNow(), part.name),
        data: dataOf(here, part),
        judge: async (source) => {
          keptViews.draftFork!(forkOf(source));
          held.putBack = () => keptViews.draftFork!(null);
          const drawn = await placeOfView(manifest.name);
          if ("failed" in drawn) return [drawn.failed];
          const refused = [...(await drawn.handle.check(source)), ...drawn.handle.refused()];
          if (refused.length > 0) return refused;
          await frame();
          await frame();
          return drawnFindings(was, drawnNow(), { fields });
        },
      });
      if (!drafted.ok) {
        await (held.steps.length > 0 ? show(held.steps.at(-1)!) : backFromDraft());
        aiDesk.record(entryOf(askedSaid, "failed", drafted.stages, { failed: drafted.findings.join(" ") || drafted.refused }));
        return setPhase({ at: "refused", said: drafted.refused, asked });
      }
      const entry = entryOf(askedSaid, "offered", drafted.stages);
      held.steps.push({ kind: "view", source: drafted.source, said: describeChange(part.name, was, drawnNow()) ?? `${part.name} has a new design. Compare Before and After.`, entry });
      held.before = false;
      setPhase({ at: "draft" });
    },
    [ai, aiDesk, backFromDraft, entryOf, held, here, keptViews, mainNow, manifest, original, drawnNow, part, said, setPhase, show, forkOf],
  );

  /* Just do it, and words typed in the menu: at once. */
  useEffect(() => {
    if (held.began || !(ask.mode === "just" || (ask.mode === "describe" && ask.words))) return;
    held.began = true;
    void run({ mode: ask.mode, words: ask.words ?? "" });
  }, [held, ask.mode, ask.words, run]);

  const current = held.steps.at(-1);
  /** Words on the bar: another step on the draft as it stands. */
  const iterate = useCallback(
    (more: string) => {
      const step = held.steps.at(-1);
      if (!step) return;
      if (step.kind === "spec") void run({ mode: "describe", words: more }, step);
      else void design({ mode: "describe", words: more }, step);
    },
    [held, run, design],
  );
  const stepBack = useCallback(async () => {
    if (held.steps.length < 2) return;
    held.steps.pop();
    held.before = false;
    await show(held.steps.at(-1)!);
    tell();
  }, [held, show, tell]);
  const compare = useCallback(
    async (before: boolean) => {
      const step = held.steps.at(-1);
      if (!step || before === held.before) return;
      held.before = before;
      tell();
      if (before) await backFromDraft();
      else await show(step);
    },
    [held, backFromDraft, show, tell],
  );

  const keep = useCallback(async () => {
    const step = held.steps.at(-1);
    if (!step || phase.at !== "draft") return;
    setPhase({ at: "keeping" });
    try {
      let undo: (() => void | Promise<void>) | undefined;
      let note: string | undefined;
      if (step.kind === "spec") {
        await backFromDraft();
        const answer: ProposeChangeAnswer = await onProposeChange!(proposalOf(step.edits, step.said, ai.name));
        if (answer === "declined") return setPhase({ at: "refused", said: "It wasn't kept." });
        if (typeof answer === "object") [undo, note] = [answer.undo, answer.note];
      } else {
        const answer: ViewReviseAnswer = await keptViews!.fork!(forkOf(step.source));
        held.putBack = null;
        keptViews!.draftFork?.(null);
        if (answer) [undo, note] = [answer.undo, answer.note];
      }
      aiDesk.record({ ...step.entry, outcome: "accepted" });
      setPhase({ at: "kept", ...(undo ? { undo } : {}), ...(note ? { note } : {}) });
    } catch (error) {
      setPhase({ at: "refused", said: error instanceof Error && error.message ? "It couldn't be kept." : "It couldn't be kept." });
    }
  }, [held, phase, setPhase, backFromDraft, onProposeChange, ai.name, keptViews, forkOf, aiDesk]);

  const discard = useCallback(() => {
    const step = held.steps.at(-1);
    if (phase.at === "draft" && step) aiDesk.record({ ...step.entry, outcome: "dismissed" });
    putAway();
  }, [held, phase, aiDesk, putAway]);

  const undo = useCallback(async () => {
    if (phase.at !== "kept" || !phase.undo) return;
    const step = held.steps.at(-1);
    try {
      await phase.undo();
      if (step) aiDesk.record({ ...step.entry, outcome: "dismissed" });
      setPhase({ at: "undone" });
    } catch {
      setPhase({ at: "refused", said: "It couldn't be put back." });
    }
  }, [phase, held, aiDesk, setPhase]);

  /* The card is placed beside the part while it asks; the bar is docked at the window's foot. */
  const asking = phase.at === "choose" || phase.at === "asking" || phase.at === "design";
  useLayoutEffect(() => {
    if (!asking) return;
    let handle = 0;
    const follow = () => {
      if (card.current) placeBeside(card.current, part.elements.length > 0 && part.elements.every((one) => one.isConnected) ? boxOf(part.elements) : null);
      handle = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(handle);
  }, [part, asking]);

  useEffect(() => {
    if (phase.at === "asking") field.current?.focus();
    else if (asking) card.current?.querySelector<HTMLElement>("button[data-first]")?.focus();
  }, [phase.at, asking]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      discard();
      const back = ask.returnTo?.isConnected ? ask.returnTo : document.querySelector<HTMLElement>("[data-graview-page-title], main h1");
      if (back && !back.hasAttribute("tabindex") && !back.matches("a[href], button, input, select, textarea")) back.setAttribute("tabindex", "-1");
      back?.focus?.();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [discard, ask.returnTo]);

  if (phase.at === "highlighting") {
    return (
      <Highlighter
        box={mainNow()}
        root={mainNow()}
        whole={part.elements}
        wholeSaid="The whole page"
        cancel={putAway}
        chose={(elements) => setPhase({ at: "asking", pointed: { name: nameParts(elements.map(readPart)), lines: partLines(elements.map(readPart)) } })}
      />
    );
  }

  const { CARD, HEAD, MUTED, ROW, FIELD, PRIMARY, QUIET } = LOOK;
  if (asking) {
    const pointed = phase.at === "asking" ? phase.pointed : undefined;
    return (
      <>
        {part.elements.length > 0 ? <SectionOutline elements={part.elements} /> : null}
        <div ref={card} role="dialog" aria-label={`Change how “${part.name}” looks`} data-testid="section-card" data-page-card="" data-section-phase={phase.at} data-graview-popover="" style={CARD}>
          <p style={HEAD}>
            Change how <strong>“{part.name}”</strong> looks
          </p>
          {pointed ? (
            <p data-testid="section-pointed" style={MUTED}>
              You pointed at {pointed.name}.
            </p>
          ) : null}
          {phase.at === "choose" ? (
            <div style={{ display: "grid", gap: 6 }}>
              <button type="button" data-first="" data-testid="section-just-do-it" onClick={() => void run({ mode: "just", words: "" })} style={PRIMARY}>
                Just do it
              </button>
              <button type="button" data-testid="section-describe" onClick={() => setPhase({ at: "asking" })} style={QUIET}>
                Describe changes…
              </button>
              <button type="button" data-testid="section-highlight" onClick={() => setPhase({ at: "highlighting" })} style={QUIET}>
                Highlight area…
              </button>
            </div>
          ) : null}
          {phase.at === "asking" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (typed.trim()) void run({ mode: "describe", words: typed.trim(), ...(pointed ? { pointed } : {}) });
              }}
              style={{ display: "grid", gap: 8 }}
            >
              <label style={VISUALLY_HIDDEN} htmlFor="graview-page-words">
                {pointed ? "What should change here?" : "What should change?"}
              </label>
              <input id="graview-page-words" ref={field} data-testid="section-words" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={pointed ? "What should change here?" : "What should change?"} style={FIELD} />
              <div style={ROW}>
                <button type="submit" data-first="" disabled={!typed.trim()} style={PRIMARY}>
                  Change it
                </button>
                <button type="button" onClick={putAway} style={QUIET}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {phase.at === "design" ? (
            <>
              <p data-testid="section-own-view" style={{ margin: 0 }}>
                Its settings can't do that. Graview can draw a new design for “{part.name}” and change it. Draw one?
              </p>
              <div style={ROW}>
                <button type="button" data-first="" data-testid="section-own-yes" onClick={() => void design(phase.asked)} style={PRIMARY}>
                  Draw it
                </button>
                <button type="button" data-testid="section-own-no" onClick={putAway} style={QUIET}>
                  No
                </button>
              </div>
            </>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      {phase.at === "working" ? <Redesigning over={mainNow()} name={part.name} /> : null}
      <DraftBar
        phase={phase.at === "draft" ? (current?.kind === "view" ? "view" : "spec") : phase.at}
        name={part.name}
        busy={phase.at === "working" || phase.at === "keeping"}
        said={
          phase.at === "working"
            ? `Graview is redesigning “${part.name}”…`
            : phase.at === "keeping"
              ? "Keeping it…"
              : phase.at === "draft"
                ? (current?.said ?? "")
                : phase.at === "kept"
                  ? "Kept."
                  : phase.at === "undone"
                    ? "Put back as it was."
                    : phase.at === "refused"
                      ? phase.said
                      : ""
        }
        {...(phase.at === "draft" || phase.at === "working" ? { scope } : {})}
        {...(phase.at === "kept" && phase.note ? { note: phase.note } : {})}
        {...(phase.at === "draft" ? { compare: { before: held.before, toggle: (before: boolean) => void compare(before) }, iterate, keep: () => void keep(), discard, step: { at: held.steps.length, of: held.steps.length, ...(held.steps.length > 1 ? { back: () => void stepBack() } : {}) } } : {})}
        {...(phase.at === "working" ? { discard: putAway } : {})}
        {...(phase.at === "refused" && phase.asked ? { retry: (more: string) => void (held.steps.length > 0 ? iterate(more) : run({ mode: "describe", words: more })) } : {})}
        {...(phase.at === "kept" && phase.undo ? { undo: () => void undo() } : {})}
        {...(phase.at === "kept" || phase.at === "undone" || phase.at === "refused" ? { close: putAway } : {})}
      />
    </>
  );
}

type Asked = { readonly mode: SectionAsk["mode"]; readonly words: string; readonly pointed?: Pointed };

/** What the host is handed for the settings' edits: the change to the app, said by the checker. */
function proposalOf(edits: readonly unknown[], said: string, model: string | undefined): ReshapeProposal {
  return { said, add: [], drop: [], card: { said, adds: [], keeps: [], drops: [], breaking: [] }, edits, via: `ai:${model ?? "model"}` };
}

/** What a new design must keep of the page: the title the page draws above it (never again), its other headings, the records it showed. */
function keepsOf(was: DrawnRead, main: Element | null, name: string): { title: string; headings: string[]; records: string[] } {
  const title = words(main?.querySelector("[data-graview-page-title], h1")?.textContent) || name;
  return { title, headings: was.headings.filter((one) => one !== title), records: was.records.map((one) => one.label) };
}

/** The page's own region, found again where the draft drew the page anew. */
function document_main(): Element | null {
  return document.querySelector("[data-graview-page-main], main") ?? document.querySelector("[data-graview-face]");
}
