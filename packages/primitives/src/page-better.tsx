import { type AnySchema, type ViewForkKept, type ViewReviseAnswer } from "@graview/core";
import type { AiInteraction, AiStage, AiUsage } from "@graview/core/catalog";
import { compareViewRevision } from "@graview/core/revisions";
import { useGraview, type ProposeChangeAnswer, type ReshapeProposal } from "@graview/react/provider";
import { viewPlaceOf, type ViewPlaceHandle } from "@graview/react/drawing";
import { draftPageSpec, draftPageView, forkManifest, mayChangeDeclaration, specCanSay, type ForkManifest, type PagePartSaid, type SectionStage } from "@graview/tools/section";
import { interactionId } from "@graview/tools/inline-ai";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PagePart } from "./page-parts.js";
import { boxOf, SectionOutline } from "./section-outline.js";
import { Highlighter, LOOK, placeBeside, readPart } from "./section-better.js";
import type { SectionAsk } from "./section-menu.js";
import { nameParts, partLines } from "./section-words.js";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * A BUILT-IN PAGE'S CARD (Roadmap f-make-any-page-better), fetched the first
 * time "Make “Tasks” better" is asked for on a page the app draws by itself.
 *
 * SPEC FIRST. The Fast slot says whether the view spec — what a card, a
 * row and a page show, how a list opens — can say what was asked. Where it
 * can, the light model drafts the least edits over it (the full one where
 * its answer cannot be read, and to repair once what the checker refused);
 * the host's composer judges them by the checker (`composeChange`), and a
 * draft that does not compile is never offered. The page is drawn with the
 * edits as a draft on this page only (`onDraftChange`), and a draft that
 * changes nothing drawn here is not offered as one: the page is drawn its
 * own way. Keep hands the same change to the host (`onProposeChange`) as
 * one change to the app with one Undo.
 *
 * THEN ITS OWN VIEW. Where the spec cannot say it, the card says so —
 * "That needs its own view. Make “Tasks” its own view and change it?" —
 * and Yes drafts a worker view seeded from the page as it stands (its
 * headings, what it shows, the data it reads), revised as asked, shown as
 * the page's view on this page only (`KeptViews.draftFork`) and judged
 * there (the host's checks, `compareViewRevision` against the page it
 * replaces). Keep makes it that page's view (`KeptViews.fork`); the
 * built-in page stays under "Also as".
 */

type Pointed = { readonly name: string; readonly lines: readonly string[] };
type Phase =
  | { readonly at: "highlighting" }
  | { readonly at: "asking"; readonly pointed?: Pointed }
  | { readonly at: "working"; readonly said: string; readonly pointed?: Pointed }
  | { readonly at: "spec"; readonly proposal: ReshapeProposal; readonly said: string; readonly steps: readonly string[]; readonly shown: boolean; readonly notes: readonly string[]; readonly entry: AiInteraction }
  | { readonly at: "own"; readonly why: string; readonly asked: { readonly mode: SectionAsk["mode"]; readonly words: string; readonly pointed?: Pointed } }
  | { readonly at: "view"; readonly fork: ViewForkKept; readonly said: string; readonly notes: readonly string[]; readonly entry: AiInteraction }
  | { readonly at: "keeping" }
  | { readonly at: "kept"; readonly note?: string; readonly undo?: () => void | Promise<void>; readonly entry: AiInteraction }
  | { readonly at: "undone" }
  | { readonly at: "refused"; readonly said: string };

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

/** The headings of the page as it stands, drawn as nothing else: what a view of it must still draw (`compareViewRevision`'s sections). */
function headingsOf(main: Element | null, group: string | undefined): Element {
  const skeleton = document.createElement("div");
  for (const heading of main?.querySelectorAll("h1, h2") ?? []) {
    if (heading.closest("[data-graview-popover], nav, [hidden]")) continue;
    const said = headingWords(heading);
    if (!said || (group !== undefined && heading.localName === "h2" && said !== group && heading.closest('[data-testid="list-group"]'))) continue;
    const one = document.createElement(heading.localName);
    one.textContent = said;
    skeleton.append(one);
  }
  return skeleton;
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

/** The view's place on the page, once the host has drawn the view of this name there: its handle. */
async function placeOfView(name: string, ms = 8000): Promise<{ readonly element: Element; readonly handle: ViewPlaceHandle } | undefined> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    for (const element of document.querySelectorAll("[data-worker-view-place]")) {
      const handle = viewPlaceOf(element);
      if (handle?.name === name && handle.drawing().root) return { element, handle };
    }
    const failed = [...document.querySelectorAll("[data-worker-view-fallback]")].length > 0 && document.querySelector(`[data-worker-view="${CSS.escape(name)}"]`) === null;
    if (failed) return undefined;
    await wait(80);
  }
  return undefined;
}

/*
 * THE CARD'S STATE OUTLIVES THE CARD (Roadmap f-make-any-page-better): a
 * host that hands the page a changed app may draw it all again, and the
 * card with it (`carried` in `section-menu.tsx`). What it is at, what puts
 * the page back from a draft and whether it began are kept here by the
 * card's ask, and dropped when the card is put away.
 */
interface CardHeld {
  phase: Phase;
  putBack: (() => void | Promise<void>) | null;
  began: boolean;
  readonly heard: Set<() => void>;
}
const CARDS = /* @__PURE__ */ new Map<number, CardHeld>();
const cardOf = (at: number, first: () => Phase): CardHeld => {
  let held = CARDS.get(at);
  if (!held) CARDS.set(at, (held = { phase: first(), putBack: null, began: false, heard: new Set() }));
  return held;
};

export function PageCard({ ask, close }: { readonly ask: Extract<SectionAsk, { part: object }>; readonly close: () => void }) {
  const here = useGraview<AnySchema>();
  const { ai, aiDesk, principal, keptViews, store, onProposeChange, composeChange, onDraftChange, app } = here;
  const part = ask.part;
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const held = useMemo(() => cardOf(ask.at, () => (ask.mode === "highlight" ? { at: "highlighting" } : ask.mode === "describe" && !ask.words ? { at: "asking" } : { at: "working", said: "Reading what you asked…" })), [ask]);
  const subscribe = useCallback((listener: () => void) => (held.heard.add(listener), () => void held.heard.delete(listener)), [held]);
  const phase = useSyncExternalStore(subscribe, () => held.phase, () => held.phase);
  const setPhase = useCallback(
    (next: Phase) => {
      held.phase = next;
      held.heard.forEach((listener) => listener());
    },
    [held],
  );
  const [typed, setTyped] = useState(ask.words ?? "");
  /* What puts the page back from the draft on it: the app's change (`onDraftChange`'s undo), or the view drawn in its place. */
  const putBack = useMemo(() => ({ set current(back: CardHeld["putBack"]) { held.putBack = back; }, get current() { return held.putBack; } }), [held]);
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

  /* What this seat may do here: the app's settings, through the host — and the page's own view. */
  const specHost = onProposeChange !== undefined && composeChange !== undefined && mayChangeDeclaration(store, principal);
  const manifest: ForkManifest | undefined = forkManifest(said, linksOf(here, part));
  const forkHost = manifest !== undefined && typeof keptViews?.fork === "function" && typeof keptViews.draftFork === "function" && keptViews.current().may.views === true;

  /** Where the spec cannot say it: its own view, offered — or said plainly, where this host makes none. */
  const ownView = useCallback(
    (why: string, asked: { readonly mode: SectionAsk["mode"]; readonly words: string; readonly pointed?: Pointed }) => {
      if (forkHost) return setPhase({ at: "own", why, asked });
      setPhase({ at: "refused", said: `${why} A view of its own could do it, and this page cannot be given one here.` });
    },
    [forkHost],
  );

  /** SPEC FIRST: can the settings say it, the least edits that do, checked, drawn as a draft. */
  const run = useCallback(
    async (mode: SectionAsk["mode"], said_: string, pointed?: Pointed) => {
      const asked = { mode, words: said_, ...(pointed ? { pointed } : {}) };
      const askedSaid = mode === "just" ? `Make “${part.name}” better` : `Make “${part.name}” better: ${said_}`;
      setPhase({ at: "working", said: "Reading what you asked…", ...(pointed ? { pointed } : {}) });
      const reshape = specHost ? await import("@graview/tools/reshape") : undefined;
      const document = reshape?.documentOfApp(app ?? {});
      if (!specHost || !document) return ownView("This app's settings cannot be changed from here.", asked);
      const can = mode === "just" ? { can: true } : await specCanSay(ai, said_, said);
      if (!can.can) return ownView("The page's settings have no word for that.", asked);
      setPhase({ at: "working", said: `Changing “${part.name}”…`, ...(pointed ? { pointed } : {}) });
      let steps: readonly string[] = [];
      const drafted = await draftPageSpec({
        ai,
        document,
        part: said,
        mode,
        ...(said_ ? { words: said_ } : {}),
        ...(pointed ? { highlighted: [pointed.name, ...pointed.lines] } : {}),
        shows: outlineOf(mainNow(), 30),
        repairing: () => setPhase({ at: "working", said: "The checker refused the first try. Trying once more…", ...(pointed ? { pointed } : {}) }),
        judge: async (edits) => {
          const composed = composeChange!({ document, edits });
          if (!composed.ok) return [composed.refused];
          steps = composed.said;
          return [];
        },
      });
      if (!drafted.ok) {
        aiDesk.record(entryOf(askedSaid, "failed", drafted.stages, { failed: drafted.refused }));
        // Said in the card's own words, never the model's: what it says of the app is not the card's to repeat as true.
        return ownView(drafted.cannot ? "The page's settings have no word for that." : "The page's settings could not say that.", asked);
      }
      const proposal: ReshapeProposal = { said: askedSaid, add: [], drop: [], card: { said: drafted.said, adds: [], keeps: [], drops: [], breaking: [] }, edits: drafted.edits, via: `ai:${ai.name ?? "model"}` };
      const entry = entryOf(askedSaid, "offered", drafted.stages);
      const notes = drafted.repaired ? ["Repaired once after the checker refused the first try."] : [];
      if (!onDraftChange) return setPhase({ at: "spec", proposal, said: drafted.said, steps, shown: false, notes, entry });
      /* Drawn on this page only, and judged by what it changed of what is drawn. */
      const before = drawnSignature(mainNow());
      try {
        const shown = await onDraftChange(proposal);
        putBack.current = shown.undo;
      } catch (error) {
        return setPhase({ at: "refused", said: error instanceof Error ? error.message : "The host did not show it." });
      }
      let after = before;
      for (const until = Date.now() + 1500; Date.now() < until && after === before; ) {
        await frame();
        after = drawnSignature(mainNow());
      }
      if (after === before) {
        await backFromDraft();
        aiDesk.record({ ...entry, outcome: "failed", failed: "The change would not show on this page." });
        return ownView("That change would not show on this page: it is drawn its own way here.", asked);
      }
      setPhase({ at: "spec", proposal, said: drafted.said, steps, shown: true, notes, entry });
    },
    [ai, aiDesk, app, backFromDraft, composeChange, entryOf, onDraftChange, ownView, part, said, specHost, mainNow, putBack, setPhase],
  );

  /** ITS OWN VIEW: seeded from the page as it stands, revised as asked, drawn in its place and judged there. */
  const fork = useCallback(
    async (asked: { readonly mode: SectionAsk["mode"]; readonly words: string; readonly pointed?: Pointed }) => {
      if (!manifest || !keptViews?.draftFork) return;
      const askedSaid = asked.mode === "just" ? `Make “${part.name}” its own view` : `Make “${part.name}” its own view: ${asked.words}`;
      setPhase({ at: "working", said: `Drawing “${part.name}” as its own view…` });
      const outline = outlineOf(mainNow());
      const skeleton = headingsOf(mainNow(), part.group);
      const from: ViewForkKept["from"] = part.slot === "record" ? { page: "record", kind: part.kind! } : part.slot === "home" ? { page: "home" } : { page: "list", kind: part.kind! };
      const of = (source: string): ViewForkKept => ({ manifest, source, from, said: "" });
      let left: string[] = [];
      const drafted = await draftPageView({
        ai,
        part: said,
        manifest,
        mode: asked.mode,
        ...(asked.words ? { words: asked.words } : {}),
        ...(asked.pointed ? { highlighted: [asked.pointed.name, ...asked.pointed.lines] } : {}),
        outline,
        data: dataOf(here, part),
        repairing: () => setPhase({ at: "working", said: "The first try broke the page. Trying once more…" }),
        judge: async (source) => {
          keptViews.draftFork!(of(source));
          putBack.current = () => keptViews.draftFork!(null);
          const drawn = await placeOfView(manifest.name);
          if (!drawn) return ["The view did not draw in the page's place."];
          // What keeps the code from running is the model's to repair; a style the host left out draws without it, and is said.
          const refused = await drawn.handle.check(source);
          if (refused.length > 0) return refused;
          left = drawn.handle.refused().map((one) => `Left out by the host: ${one.replace(/^Refused /, "").replace(/\.$/, "")}.`);
          await frame();
          const now = drawn.handle.drawing();
          const revision = compareViewRevision({ source: "", css: "", drawing: skeleton }, { source, css: now.css, ...(now.root ? { drawing: now.root } : {}) });
          if (revision.sectionsMissing.length > 0) return [`It no longer draws ${revision.sectionsMissing.map((one) => `“${one.name}”`).join(", ")}, which the page drew.`];
          return [];
        },
      });
      if (!drafted.ok) {
        await backFromDraft();
        aiDesk.record(entryOf(askedSaid, "failed", drafted.stages, { failed: drafted.refused }));
        return setPhase({ at: "refused", said: drafted.refused });
      }
      const entry = entryOf(askedSaid, "offered", drafted.stages);
      setPhase({ at: "view", fork: { ...of(drafted.source), said: drafted.said }, said: drafted.said, notes: [...(drafted.repaired ? ["Repaired once after the first try broke."] : []), ...[...new Set(left)]], entry });
    },
    [ai, aiDesk, backFromDraft, entryOf, here, keptViews, manifest, part, said, mainNow, putBack, setPhase],
  );

  /* Just do it, and words typed in the menu: at once. */
  useEffect(() => {
    if (held.began || !(ask.mode === "just" || (ask.mode === "describe" && ask.words))) return;
    held.began = true;
    void run(ask.mode, ask.words ?? "");
  }, [held, ask.mode, ask.words, run]);

  const keep = useCallback(async () => {
    if (phase.at === "spec") {
      const { proposal, entry } = phase;
      setPhase({ at: "keeping" });
      try {
        await backFromDraft();
        const answer: ProposeChangeAnswer = await onProposeChange!(proposal);
        if (answer === "declined") return setPhase({ at: "refused", said: "The host did not keep it." });
        aiDesk.record({ ...entry, outcome: "accepted" });
        setPhase({ at: "kept", ...(typeof answer === "object" ? { undo: answer.undo, ...(answer.note ? { note: answer.note } : {}) } : {}), entry });
      } catch (error) {
        setPhase({ at: "refused", said: error instanceof Error ? error.message : "The host did not keep it." });
      }
      return;
    }
    if (phase.at === "view" && keptViews?.fork) {
      const { fork: kept, entry } = phase;
      setPhase({ at: "keeping" });
      try {
        const answer: ViewReviseAnswer = await keptViews.fork(kept);
        putBack.current = null;
        keptViews.draftFork?.(null);
        aiDesk.record({ ...entry, outcome: "accepted" });
        setPhase({ at: "kept", ...(answer && answer.undo ? { undo: answer.undo } : {}), ...(answer && answer.note ? { note: answer.note } : {}), entry });
      } catch (error) {
        setPhase({ at: "refused", said: error instanceof Error ? error.message : "The host did not keep it." });
      }
    }
  }, [phase, backFromDraft, onProposeChange, keptViews, aiDesk, putBack, setPhase]);

  const discard = useCallback(() => {
    void backFromDraft();
    if (phase.at === "spec" || phase.at === "view") aiDesk.record({ ...phase.entry, outcome: "dismissed" });
    putAway();
  }, [phase, aiDesk, backFromDraft, putAway]);

  const undo = useCallback(async () => {
    if (phase.at !== "kept" || !phase.undo) return;
    try {
      await phase.undo();
      aiDesk.record({ ...phase.entry, outcome: "dismissed" });
      setPhase({ at: "undone" });
    } catch (error) {
      setPhase({ at: "refused", said: error instanceof Error ? error.message : "The host did not put it back." });
    }
  }, [phase, aiDesk, setPhase]);

  /* Placed beside the part, kept there as the page moves. */
  useLayoutEffect(() => {
    let handle = 0;
    const follow = () => {
      if (card.current) placeBeside(card.current, part.elements.length > 0 && part.elements.every((one) => one.isConnected) ? boxOf(part.elements) : null);
      handle = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(handle);
  }, [part]);

  useEffect(() => {
    if (phase.at === "asking") field.current?.focus();
    else if (phase.at !== "highlighting") card.current?.querySelector<HTMLElement>("button[data-first]")?.focus();
  }, [phase.at]);

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

  const pointed = phase.at === "asking" || phase.at === "working" ? phase.pointed : undefined;
  const { CARD, HEAD, MUTED, THINKING, ROW, FIELD, PRIMARY, QUIET } = LOOK;
  const status =
    phase.at === "working"
      ? phase.said
      : phase.at === "keeping"
        ? "Keeping it…"
        : phase.at === "spec" || phase.at === "view"
          ? phase.said
          : phase.at === "kept"
            ? `Kept.${phase.note ? ` ${phase.note}` : ""}`
            : phase.at === "undone"
              ? "Put back as it was."
              : phase.at === "refused"
                ? phase.said
                : "";
  return (
    <>
      {phase.at !== "kept" && phase.at !== "undone" && part.elements.length > 0 ? <SectionOutline elements={part.elements} label={phase.at === "spec" && phase.shown ? "Draft" : phase.at === "view" ? "Draft" : undefined} /> : null}
      <div ref={card} role="dialog" aria-label={`Make “${part.name}” better`} data-testid="section-card" data-page-card="" data-section-phase={phase.at} data-graview-popover="" style={CARD}>
        <p style={HEAD}>
          Make <strong>“{part.name}”</strong> better
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
              if (typed.trim()) void run(ask.mode, typed.trim(), phase.pointed);
            }}
            style={{ display: "grid", gap: 8 }}
          >
            <label style={VISUALLY_HIDDEN} htmlFor="graview-page-words">
              {phase.pointed ? "What should change here?" : "What should change?"}
            </label>
            <input id="graview-page-words" ref={field} data-testid="section-words" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={phase.pointed ? "What should change here?" : "What should change?"} style={FIELD} />
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
        {phase.at === "own" ? (
          <>
            <p data-testid="section-own-view" style={{ margin: 0 }}>
              {phase.why} That needs its own view. Make “{part.name}” its own view and change it?
            </p>
            <div style={ROW}>
              <button type="button" data-first="" data-testid="section-own-yes" onClick={() => void fork(phase.asked)} style={PRIMARY}>
                Yes
              </button>
              <button type="button" data-testid="section-own-no" onClick={putAway} style={QUIET}>
                No
              </button>
            </div>
          </>
        ) : null}
        <p role="status" aria-live="polite" data-testid="section-status" style={phase.at === "working" || phase.at === "keeping" ? THINKING : MUTED}>
          {status}
        </p>
        {phase.at === "spec" ? (
          <>
            {phase.steps.length > 0 ? (
              <ul data-testid="section-steps" style={{ margin: 0, paddingLeft: 18, color: "var(--graview-ink-muted)" }}>
                {phase.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            ) : null}
            <p data-testid="section-draft-line" style={MUTED}>
              {phase.shown ? "Draft — shown on this page, not kept." : "Not shown on the page until it is kept."}
            </p>
            {phase.notes.map((note) => (
              <p key={note} data-testid="section-note" style={MUTED}>
                {note}
              </p>
            ))}
          </>
        ) : null}
        {phase.at === "view" ? (
          <>
            <p data-testid="section-draft-line" style={MUTED}>
              Draft — “{part.name}” as its own view, shown on this page, not kept. The built-in page stays under Also as.
            </p>
            {phase.notes.map((note) => (
              <p key={note} data-testid="section-note" style={MUTED}>
                {note}
              </p>
            ))}
          </>
        ) : null}
        {phase.at === "spec" || phase.at === "view" ? (
          <div style={ROW}>
            <button type="button" data-first="" data-testid="section-keep" onClick={() => void keep()} style={PRIMARY}>
              Keep
            </button>
            <button type="button" data-testid="section-discard" onClick={discard} style={QUIET}>
              Discard
            </button>
          </div>
        ) : null}
        {phase.at === "kept" ? (
          <div style={ROW}>
            {phase.undo ? (
              <button type="button" data-first="" data-testid="section-undo" onClick={() => void undo()} style={QUIET}>
                Undo
              </button>
            ) : null}
            <button type="button" {...(phase.undo ? {} : { "data-first": "" })} onClick={putAway} style={QUIET}>
              Close
            </button>
          </div>
        ) : null}
        {phase.at === "refused" || phase.at === "undone" ? (
          <div style={ROW}>
            <button type="button" data-first="" onClick={putAway} style={QUIET}>
              Close
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** The page's own region, found again where the draft drew the page anew. */
function document_main(): Element | null {
  return document.querySelector("[data-graview-page-main], main") ?? document.querySelector("[data-graview-face]");
}
