import { labelOf, type AnyGraphNode, type AnySchema, type ViewForkKept, type ViewReviseAnswer } from "@graview/core";
import type { AiInteraction, AiStage, AiUsage } from "@graview/core/catalog";
import { useGraview, type ProposeChangeAnswer, type ReshapeProposal } from "@graview/react/provider";
import { viewPlaceOf, type ViewPlaceHandle, type ViewPresses } from "@graview/react/drawing";
import { CONTROL_WORDS, describeChange, draftPageSpec, drawnFindings, forkManifest, IT_DOES_NOT_WORK, lookOf, mayChangeDeclaration, pressFindings, pressSaid, runDesignAgent, specCanSay, type ActToBind, type DesignTalk, type DrawnRead, type ForkManifest, type PageViewKeeps, type PagePartSaid, type SectionStage } from "@graview/tools/section";
import { interactionId } from "@graview/tools/inline-ai";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { PagePart } from "./page-parts.js";
import { Highlighter, readPart } from "./section-better.js";
import { readDrawn, Redesigning } from "./better-bar.js";
import { BetterPanel } from "./better-panel.js";
import type { SectionAsk } from "./section-menu.js";
import { aboutOf, nameParts, partLines } from "./section-words.js";
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
  | { readonly at: "open" }
  | { readonly at: "working" }
  | { readonly at: "draft" }
  | { readonly at: "keeping" }
  | { readonly at: "kept"; readonly note?: string; readonly undo?: () => void | Promise<void> }
  | { readonly at: "undone" }
  /* Two drafts failed the same way: said plainly, the last one there to keep anyway where it drew. */
  | { readonly at: "stuck"; readonly source?: string };

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
async function placeOfView(name: string, source?: string, ms = 15000): Promise<{ readonly element: Element; readonly handle: ViewPlaceHandle } | { readonly failed: string }> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    for (const element of document.querySelectorAll("[data-worker-view-place]")) {
      const handle = viewPlaceOf(element);
      // The place drawn now, with something in it: never one the page is tearing down, nor one not yet drawn after the page was drawn again.
      const drawn = handle?.name === name ? handle.drawing().root : undefined;
      // And the draft itself, where one was asked for: a design kept under the same name is not it.
      if (handle && element.isConnected && drawn?.isConnected && drawn.childElementCount > 0 && (source === undefined || (await handle.source()) === source)) return { element, handle };
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
  /** The page as it was drawn, its markup, for a new design to start from. */
  markup: string | null;
  /** The conversation, and this turn's steps as the panel shows them. */
  talk: DesignTalk[];
  events: { readonly kind: string; readonly text: string }[];
  since: number;
  /** Stops the turn that is running. */
  stop: AbortController | null;
  /** A draft is being drawn under a cover, to be judged. */
  covering: boolean;
  pointed: Pointed | null;
  /** What the conversation is about, where the person pointed at a part of the page. */
  about: Pointed | null;
  /** The design kept in this card, for a later turn to change again. */
  kept: string | null;
  /** What pressing every control of the newest design came to. */
  pressed: ViewPresses | null;
  version: number;
  readonly heard: Set<() => void>;
}
const CARDS = /* @__PURE__ */ new Map<number, CardHeld>();
const cardOf = (at: number, first: () => Phase): CardHeld => {
  let held = CARDS.get(at);
  if (!held)
    CARDS.set(at, (held = { phase: first(), steps: [], before: false, putBack: null, began: false, original: null, markup: null, talk: [], events: [], since: Date.now(), stop: null, covering: false, pointed: null, about: null, kept: null, pressed: null, version: 0, heard: new Set() }));
  return held;
};

type PageStore = ReturnType<typeof useGraview<AnySchema>>["store"];

/** The records a part could show: its record, its kind's, or every kind's on the home. */
function nodesOfPart(store: PageStore, part: Pick<PagePart, "record" | "kind">): AnyGraphNode[] {
  return part.record ? [store.graph.getNode(part.record)].filter((one): one is AnyGraphNode => one !== undefined) : part.kind ? store.graph.nodesOfKind(part.kind) : store.schema.kinds.flatMap((kind) => store.graph.nodesOfKind(kind));
}

/** A record's name, as its kind says it is named (`name`, a template, a function) — never a field that may not be there. */
const nameOf = (store: PageStore, node: AnyGraphNode | undefined): string => (node ? labelOf(store.schema.tryDefinition(node.kind), node as never) : "");

/**
 * THE LABELS OF THE RECORDS THE PAGE SHOWED, what a draft must still show
 * (Roadmap f-better-ui-draws-first-time): each record of the part named as
 * its kind names it, where the page's words say it.
 */
export function labelsShown(store: PageStore, part: Pick<PagePart, "record" | "kind">, text: string): string[] {
  const read = words(text).toLowerCase();
  return nodesOfPart(store, part)
    .map((node) => nameOf(store, node))
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
  const held = useMemo(() => cardOf(ask.at, () => (ask.mode === "highlight" ? { at: "highlighting" } : { at: "open" })), [ask]);
  const subscribe = useCallback((listener: () => void) => (held.heard.add(listener), () => void held.heard.delete(listener)), [held]);
  const phase = useSyncExternalStore(subscribe, () => held.phase, () => held.phase);
  const version = useSyncExternalStore(subscribe, () => held.version, () => held.version);
  void version;
  const tell = useCallback(() => {
    held.version += 1;
    held.heard.forEach((listener) => listener());
  }, [held]);
  const setPhase = useCallback(
    (next: Phase) => {
      held.phase = next;
      tell();
    },
    [held, tell],
  );
  const backFromDraft = useCallback(async () => {
    const back = held.putBack;
    held.putBack = null;
    if (back) await back();
  }, [held]);
  /* Put away for good: a draft not kept goes with it, and the page stands as it was. */
  const putAway = useCallback(() => {
    held.stop?.abort();
    held.stop = null;
    void backFromDraft();
    CARDS.delete(ask.at);
    close();
  }, [backFromDraft, ask.at, close, held]);
  /* The page's own region now: the one the part was read in, or the one drawn again since. */
  const mainNow = useCallback(() => (part.main?.isConnected ? part.main : document_main()), [part]);

  const said: PagePartSaid = { name: part.name, slot: part.slot, ...(part.kind ? { kind: part.kind } : {}), ...(part.group ? { group: part.group } : {}) };
  const placeName = part.place ?? (part.kind ? `${part.kind}-${part.slot}` : "home");
  const scope = ask.fromScene ? `From the scene: Better UI changes how “${part.name}” looks on its page here, for everyone in this app.` : `This changes how ${part.name} looks for everyone in this app.`;
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
  const acts = useMemo(() => actsOf(here, part), [here, part]);
  const manifest: ForkManifest | undefined = forkManifest(said, linksOf(here, part), acts.map((one) => one.act));
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
    held.original = readDrawn(regionOf(main), labelsShown(here.store, part, text || (main?.textContent ?? "")));
    return held.original;
  }, [held, mainNow, here, part]);
  /** The page now, read as the original was. */
  const drawnNow = useCallback(() => readDrawn(regionOf(mainNow()), original().records.map((one) => one.label)), [mainNow, original]);

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
  /** The page as the person last saw it: the newest draft, or the page as it was. */
  const showLatest = useCallback(async () => {
    const step = held.steps.at(-1);
    held.before = false;
    if (step) await show(step);
    else await backFromDraft();
  }, [held, show, backFromDraft]);

  const say = useCallback(
    (who: DesignTalk["who"], words: string) => {
      held.talk.push({ who, said: words });
      tell();
    },
    [held, tell],
  );
  const step = useCallback(
    (event: { readonly kind: string; readonly text: string }) => {
      // The words as the model writes them stand in for the step it is on, and give way to the step once it is said.
      if (held.events.at(-1)?.kind === "streaming") held.events.pop();
      held.events.push(event);
      tell();
    },
    [held, tell],
  );
  /** What the person has asked of it, all of it: a fact or a group they asked away is theirs to change. */
  const askedWords = () => held.talk.filter((one) => one.who === "person").map((one) => one.said).join(" ");

  /**
   * THE QUICK WAY FIRST: where the Fast slot says the page's settings can say
   * it, the least edits that do, checked by the host's composer and drawn
   * on this page only — in seconds, with no conversation needed. Answers
   * whether it made a draft; where it could not, the agent takes it.
   */
  const bySettings = useCallback(
    async (asked: Asked): Promise<boolean> => {
      if (!specHost || !onDraftChange) return false;
      const reshape = await import("@graview/tools/reshape");
      const remembered = reshape.documentOfApp(app ?? {});
      if (!remembered) return false;
      const after = held.steps.at(-1);
      if (after && after.kind !== "spec") return false;
      const before = after?.edits ?? [];
      const composedBefore = before.length > 0 ? composeChange!({ document: remembered, edits: before }) : undefined;
      const document = composedBefore?.ok ? composedBefore.document : remembered;
      const can = asked.mode === "just" ? { can: true } : await specCanSay(ai, asked.words, said);
      if (!can.can) return false;
      step({ kind: "look", text: `Looking at how ${part.name} is set up` });
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
      if (!drafted.ok) return false;
      const edits = [...before, ...drafted.edits];
      const entry = entryOf(`Make “${part.name}” better: ${asked.words}`, "offered", drafted.stages);
      const was = drawnSignature(mainNow());
      const next: Step = { kind: "spec", edits, said: lines[lines.length - 1] ?? lines[0] ?? `${part.name} changed.`, entry };
      held.covering = true;
      tell();
      try {
        await show(next);
        let now = was;
        for (const until = Date.now() + 1500; Date.now() < until && now === was; ) {
          await frame();
          now = drawnSignature(mainNow());
        }
        const findings = now === was ? ["nothing changed"] : drawnFindings(original(), drawnNow(), { fields: fieldsOf(here, part), asked: askedWords() });
        if (findings.length > 0) {
          await showLatest();
          aiDesk.record({ ...entry, outcome: "failed", failed: findings.join(" ") });
          return false;
        }
      } catch {
        await showLatest();
        return false;
      } finally {
        held.covering = false;
        tell();
      }
      held.steps.push(next);
      held.before = false;
      step({ kind: "passed", text: "Changed its settings — it's on the page" });
      say("graview", `Done: ${next.said.replace(/\.$/, "")}.`);
      return true;
    },
    [ai, aiDesk, app, composeChange, entryOf, held, here, mainNow, onDraftChange, original, drawnNow, part, said, show, showLatest, specHost, step, say, tell],
  );

  /**
   * A DRAFT THE AGENT MADE, drawn where nobody sees it — under a cover over
   * the part — and judged: the host's checks of its code and of what it
   * drew, and the page read again against the page as it was. What passes
   * is left on the page as the newest draft; what does not is taken away
   * again, and its findings go back to the agent.
   */
  const judgeDraft = useCallback(
    async (source: string): Promise<{ readonly findings: readonly string[]; readonly drew: unknown }> => {
      if (!manifest || !keptViews?.draftFork) return { findings: ["This page cannot be drawn anew here."], drew: undefined };
      const was = original();
      held.covering = true;
      tell();
      try {
        keptViews.draftFork(forkOf(source));
        held.putBack = () => keptViews.draftFork!(null);
        const drawn = await placeOfView(manifest.name, source);
        let findings: readonly string[];
        if ("failed" in drawn) findings = [drawn.failed];
        else {
          const refused = [...(await drawn.handle.check(source)), ...drawn.handle.refused()];
          if (refused.length > 0) findings = refused;
          else {
            await frame();
            await frame();
            // Read where the draft was drawn: the page's region holding that place, whatever the page drew again meanwhile.
            const region = drawn.element.closest("[data-graview-page-main], main") ?? regionOf(mainNow());
            findings = drawnFindings(was, readDrawn(region, was.records.map((one) => one.label)), { fields: fieldsOf(here, part), asked: askedWords() });
            // Every control it drew pressed, headless and nothing applied, and what a person could do on each record kept.
            const pressed = drawn.handle.presses ? await drawn.handle.presses(source).catch(() => undefined) : undefined;
            if (pressed) {
              held.pressed = pressed;
              findings = [...findings, ...pressFindings(pressed, wantedOf(was, idsOf(here, part, was)), acts.filter((one) => one.toggle).map((one) => one.act), nounOf(part))];
            }
          }
        }
        const drew = lookOf(drawnNow());
        if (findings.length === 0) {
          const entry = entryOf(`Draw “${part.name}” anew: ${askedWords()}`, "offered", []);
          held.steps.push({ kind: "view", source, said: describeChange(part.name, was, drawnNow()) ?? `${part.name} has a new design. Compare Before and After.`, entry });
          held.before = false;
        } else await showLatest();
        return { findings, drew };
      } finally {
        held.covering = false;
        tell();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifest, keptViews, original, held, tell, forkOf, drawnNow, here, part, entryOf, showLatest],
  );

  /** One turn of the agent, from the person's last words: it looks, reads, drafts, is told what the checks found, and drafts again. */
  const agentTurn = useCallback(async (pressedLines: readonly string[] = []) => {
    if (!manifest || !forkHost) {
      say("graview", "Its settings can't do that, and a new design can't be drawn for it here.");
      return;
    }
    const stop = new AbortController();
    held.stop = stop;
    held.markup ??= markupOf(mainNow());
    const stepsBefore = held.steps.length;
    const latest = [...held.steps].reverse().find((one) => one.kind === "view") as Extract<Step, { kind: "view" }> | undefined;
    const result = await runDesignAgent({
      ai,
      part: said,
      manifest,
      talk: held.talk,
      keep: keepsOf(original(), mainNow(), part.name, here, part),
      ...(held.markup ? { markup: held.markup } : {}),
      ...(latest ? { current: latest.source } : held.kept ? { current: held.kept } : {}),
      host: { look: () => lookOf(drawnNow()), read: () => dataOf(here, part), draft: judgeDraft },
      onEvent: (event) => step(event),
      ...(held.about ? { about: held.about } : {}),
      acts,
      ...(pressedLines.length > 0 ? { pressed: pressedLines } : {}),
      noun: nounOf(part),
      signal: stop.signal,
    });
    // Stopped: the page was put back when Stop was pressed; nothing more of this turn.
    if (held.stop !== stop) return;
    held.stop = null;
    if (held.events.at(-1)?.kind === "streaming") held.events.pop();
    aiDesk.record(entryOf(`Draw “${part.name}” anew: ${askedWords()}`, held.steps.length > stepsBefore ? "offered" : "failed", result.stages, held.steps.length > stepsBefore ? {} : { failed: result.last?.findings.join(" ") ?? result.said }));
    /*
     * NEVER A CLAIM NOBODY CHECKED: what the controls of a draft do is said by
     * the press check — what was pressed and accepted — and a sentence of
     * the model's that says what a control does is not said for it.
     */
    if (result.passed) {
      const checked = held.pressed ? pressSaid(held.pressed, acts, nounOf(part)) : undefined;
      const own = CONTROL_WORDS.test(result.said) ? undefined : result.said;
      say("graview", [own ?? (checked ? undefined : "Here it is on the page."), checked].filter(Boolean).join(" "));
    } else say("graview", result.said);
    // Two drafts failed the same way: the person chooses — keep the last one anyway, where it drew, or stop.
    if (result.ended === "stuck") setPhase({ at: "stuck", ...(result.keepable && result.last ? { source: result.last.source } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, aiDesk, acts, drawnNow, entryOf, forkHost, held, here, judgeDraft, mainNow, manifest, original, part, said, say, setPhase, step]);

  /**
   * "IT DOESN'T WORK": the design on the page — the newest draft, or the
   * one kept — has every control pressed, headless and nothing applied,
   * and what came of it is said to the person and handed to the agent,
   * before it says anything of its own.
   */
  const pressTheDesign = useCallback(async (): Promise<readonly string[]> => {
    const latest = [...held.steps].reverse().find((one) => one.kind === "view") as Extract<Step, { kind: "view" }> | undefined;
    const source = latest?.source ?? held.kept;
    if (!source || !manifest) return [];
    step({ kind: "look", text: "Pressing every control on the page" });
    const drawn = await placeOfView(manifest.name);
    if ("failed" in drawn || !drawn.handle.presses) return [];
    const pressed = await drawn.handle.presses(source).catch(() => undefined);
    if (!pressed) return [];
    held.pressed = pressed;
    const was = original();
    const broken = pressFindings(pressed, wantedOf(was, idsOf(here, part, was)), acts.filter((one) => one.toggle).map((one) => one.act), nounOf(part));
    const lines = broken.length > 0 ? broken : pressed.controls.slice(0, 8).map((one) => `${one.control}: ${one.says}`);
    step(broken.length > 0 ? { kind: "check", text: `Check: ${broken.length} ${broken.length === 1 ? "control doesn't" : "controls don't"} work — fixing` } : { kind: "passed", text: "Check: every control works" });
    say("graview", broken.length > 0 ? `I pressed every control: ${broken.join(" ")}` : `I pressed every control. ${pressSaid(pressed, acts, nounOf(part)) ?? "Each one did what it says."}`);
    return lines;
  }, [acts, held, here, manifest, original, part, say, step]);

  /** The person's words: the settings where they can say it, else the agent — one turn. */
  const askFor = useCallback(
    async (words: string, mode: Asked["mode"] = "describe") => {
      if (held.phase.at === "working") return;
      const pointed = held.pointed;
      held.pointed = null;
      const asked: Asked = { mode, words, ...(pointed ? { pointed } : {}) };
      // The person's words as they typed them: what they are about is said beside them, never glued on.
      held.about = pointed ?? held.about;
      say("person", words);
      held.events = [];
      held.since = Date.now();
      setPhase({ at: "working" });
      original();
      held.markup ??= markupOf(mainNow());
      // Told a control does not work, the design on the page is pressed first, and what was found goes to the agent.
      const complaint = IT_DOES_NOT_WORK.test(words) ? await pressTheDesign().catch(() => []) : [];
      // A control that does not work is never a setting: those words go to the agent, with the press check behind them.
      const quick = !IT_DOES_NOT_WORK.test(words) && (await bySettings(asked).catch(() => false));
      if (!quick) await agentTurn(complaint);
      if ((held.phase as Phase).at === "working") setPhase(held.steps.length > 0 ? { at: "draft" } : { at: "open" });
    },
    [agentTurn, bySettings, held, mainNow, original, pressTheDesign, say, setPhase],
  );

  /** Stop: at once — the turn's drafts gone, the page as it was before it began. */
  const stopTurn = useCallback(() => {
    if (held.phase.at !== "working") return;
    const stop = held.stop;
    held.stop = null;
    stop?.abort();
    held.covering = false;
    held.steps = held.steps.filter((one) => one.entry.at < new Date(held.since).toISOString());
    void showLatest();
    say("graview", "Stopped. The page is as it was.");
    setPhase(held.steps.length > 0 ? { at: "draft" } : { at: "open" });
  }, [held, say, setPhase, showLatest]);

  const compare = useCallback(
    async (before: boolean) => {
      const latest = held.steps.at(-1);
      if (!latest || before === held.before) return;
      held.before = before;
      tell();
      if (before) await backFromDraft();
      else await show(latest);
    },
    [held, backFromDraft, show, tell],
  );

  const keep = useCallback(async () => {
    const latest = held.steps.at(-1);
    if (!latest || held.phase.at !== "draft") return;
    setPhase({ at: "keeping" });
    try {
      let undo: (() => void | Promise<void>) | undefined;
      let note: string | undefined;
      if (latest.kind === "spec") {
        await backFromDraft();
        const answer: ProposeChangeAnswer = await onProposeChange!(proposalOf(latest.edits, latest.said, ai.name));
        if (answer === "declined") {
          say("graview", "It wasn't kept.");
          return setPhase({ at: "draft" });
        }
        if (typeof answer === "object") [undo, note] = [answer.undo, answer.note];
      } else {
        const answer: ViewReviseAnswer = await keptViews!.fork!(forkOf(latest.source));
        held.putBack = null;
        keptViews!.draftFork?.(null);
        held.kept = latest.source;
        if (answer) [undo, note] = [answer.undo, answer.note];
      }
      aiDesk.record({ ...latest.entry, outcome: "accepted" });
      held.steps = [];
      held.before = false;
      setPhase({ at: "kept", ...(undo ? { undo } : {}), ...(note ? { note } : {}) });
    } catch {
      say("graview", "It couldn't be kept.");
      setPhase({ at: "draft" });
    }
  }, [held, setPhase, backFromDraft, onProposeChange, ai.name, keptViews, forkOf, aiDesk, say]);

  /** Keep anyway, where two drafts failed the same way: the last one kept as the person chose, one Undo after. */
  const keepAnyway = useCallback(
    async (source: string) => {
      if (held.phase.at !== "stuck") return;
      const step: Step = { kind: "view", source, said: `${part.name} kept as it was last drafted.`, entry: entryOf(`Draw “${part.name}” anew: ${askedWords()}`, "offered", []) };
      held.steps.push(step);
      held.phase = { at: "draft" };
      await keep();
      // Not kept: the draft goes again, and the page stands as it was.
      if (held.steps.at(-1) === step) {
        held.steps.pop();
        setPhase(held.steps.length > 0 ? { at: "draft" } : { at: "open" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [held, part.name, entryOf, keep, setPhase],
  );
  /** Stop, where two drafts failed the same way: nothing kept, the page as it was. */
  const stopStuck = useCallback(() => {
    say("graview", "Stopped. The page is as it was.");
    setPhase(held.steps.length > 0 ? { at: "draft" } : { at: "open" });
  }, [held, say, setPhase]);

  const discard = useCallback(() => {
    const latest = held.steps.at(-1);
    if (latest) aiDesk.record({ ...latest.entry, outcome: "dismissed" });
    held.steps = [];
    held.before = false;
    void backFromDraft();
    say("graview", "Put back as it was.");
    setPhase({ at: "open" });
  }, [held, aiDesk, backFromDraft, say, setPhase]);

  const undo = useCallback(async () => {
    if (held.phase.at !== "kept" || !held.phase.undo) return;
    try {
      await held.phase.undo();
      held.kept = null;
      say("graview", "Undone. The page is as it was.");
      setPhase({ at: "undone" });
    } catch {
      say("graview", "It couldn't be put back.");
    }
  }, [held, say, setPhase]);

  /* Words that came with the ask — typed in the menu, or a suggestion taken — are asked at once. */
  useEffect(() => {
    if (held.began || !(ask.mode === "just" || (ask.mode === "describe" && ask.words))) return;
    held.began = true;
    void askFor(ask.mode === "just" ? "Make it easier to read at a glance" : ask.words!, ask.mode);
  }, [held, ask.mode, ask.words, askFor]);

  /* Escape: Stop while it works, else put it away. */
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || held.phase.at === "highlighting") return;
      event.preventDefault();
      if (held.phase.at === "working") return stopTurn();
      putAway();
      const back = ask.returnTo?.isConnected ? ask.returnTo : document.querySelector<HTMLElement>("[data-graview-page-title], main h1");
      if (back && !back.hasAttribute("tabindex") && !back.matches("a[href], button, input, select, textarea")) back.setAttribute("tabindex", "-1");
      back?.focus?.();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [held, putAway, stopTurn, ask.returnTo]);

  if (phase.at === "highlighting") {
    return (
      <Highlighter
        box={mainNow()}
        root={mainNow()}
        whole={part.elements}
        wholeSaid="The whole page"
        cancel={() => setPhase({ at: "open" })}
        chose={(elements) => {
          held.pointed = { name: aboutOf(elements) ?? nameParts(elements.map(readPart)), lines: partLines(elements.map(readPart)) };
          setPhase({ at: "open" });
        }}
      />
    );
  }

  const latest = held.steps.at(-1);
  return (
    <>
      {held.covering ? <Redesigning over={mainNow()} name={part.name} said={`Graview is drafting “${part.name}”…`} /> : null}
      <BetterPanel
        name={part.name}
        scope={scope}
        phase={phase.at}
        talk={held.talk}
        steps={held.events}
        since={held.since}
        working={phase.at === "working" || phase.at === "keeping"}
        {...(latest && phase.at === "draft" ? { draft: { said: latest.said, before: held.before } } : {})}
        {...(phase.at === "kept" ? { kept: { ...(phase.note ? { note: phase.note } : {}), ...(phase.undo ? { undo: () => void undo() } : {}) } } : {})}
        {...(phase.at === "stuck" ? { stuck: { ...(phase.source !== undefined ? { keepAnyway: () => void keepAnyway(phase.source!) } : {}), stop: stopStuck } } : {})}
        about={(held.pointed ?? held.about)?.name ?? part.name}
        ask={(words) => void askFor(words)}
        just={() => void askFor("Make it easier to read at a glance", "just")}
        point={() => setPhase({ at: "highlighting" })}
        stop={stopTurn}
        compare={(before) => void compare(before)}
        keep={() => void keep()}
        discard={discard}
        close={putAway}
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
function keepsOf(was: DrawnRead, main: Element | null, name: string, here: ReturnType<typeof useGraview<AnySchema>>, part: PagePart): PageViewKeeps {
  // The page's own title, never the app's name in the bar above it: the page draws it, so a draft never does.
  const page = regionOf(main);
  // The home's body is all a new design replaces: what is drawn over it — the app's name in the bar — is its title.
  const above = part.slot === "home" ? [...(main?.querySelectorAll("h1") ?? [])].find((one) => page !== main && !page?.contains(one)) : undefined;
  const title = words(above?.textContent) || words(page?.querySelector("[data-graview-page-title]")?.textContent) || (part.slot === "home" ? "" : words(page?.querySelector("h1")?.textContent)) || (part.record ? words(nameOf(here.store, here.store.graph.getNode(part.record))) : "") || name;
  const ids = idsOf(here, part, was);
  const says = Object.fromEntries(
    was.records.flatMap((one) => (one.facts?.length || (one.under && one.under !== title) ? [[one.label, { ...(ids[one.label] ? { id: ids[one.label] } : {}), ...(one.facts?.length ? { shows: one.facts } : {}), ...(one.under && one.under !== title ? { under: one.under } : {}) }]] : [])),
  );
  const grouping = groupingOf(here, was, ids, title);
  return { title, headings: was.headings.filter((one) => one !== title), records: was.records.map((one) => one.label), ...(Object.keys(says).length > 0 ? { says } : {}), ...(grouping ? { grouping } : {}) };
}

/** Each record the page showed, by its words: its id, for the checklist a draft is held to. */
export function recordIdsOf(store: PageStore, part: Pick<PagePart, "record" | "kind">, was: DrawnRead): Record<string, string> {
  const nodes = nodesOfPart(store, part);
  const out: Record<string, string> = {};
  for (const one of was.records) {
    const node = nodes.find((each) => words(nameOf(store, each)) === words(one.label));
    if (node) out[one.label] = node.id;
  }
  return out;
}
const idsOf = (here: ReturnType<typeof useGraview<AnySchema>>, part: PagePart, was: DrawnRead) => recordIdsOf(here.store, part, was);

/**
 * HOW THE PAGE GROUPED ITS RECORDS, read from the graph: each record sits
 * under the heading that is the name of a record it is linked to (a task
 * under its list's name) — the link's kind, the kind of the record named,
 * and which end the grouped record is. Undefined where no one link says it
 * for most of them: the checklist's headings stand alone then.
 */
function groupingOf(here: ReturnType<typeof useGraview<AnySchema>>, was: DrawnRead, ids: Readonly<Record<string, string>>, title: string): PageViewKeeps["grouping"] {
  const { store } = here;
  const grouped = was.records.filter((one) => one.under && one.under !== title && ids[one.label]);
  if (grouped.length < 2) return undefined;
  const edges = store.graph.allEdges();
  const count = new Map<string, number>();
  for (const one of grouped) {
    const id = ids[one.label]!;
    for (const edge of edges) {
      const other = edge.from === id ? edge.to : edge.to === id ? edge.from : undefined;
      const named = other !== undefined ? store.graph.getNode(other) : undefined;
      if (!named || words(nameOf(store, named)) !== words(one.under!)) continue;
      const key = `${edge.kind}\u0000${named.kind}\u0000${edge.from === id ? "from" : "to"}`;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  const best = [...count].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < grouped.length / 2) return undefined;
  const [edge, kind, end] = best[0].split("\u0000") as [string, string, "from" | "to"];
  return { edge, kind, record: end };
}

/** The page's own region inside the face: its <main>, never the app's bar and footer around it. */
const regionOf = (face: Element | null): Element | null => face?.querySelector("main") ?? face;

/**
 * THE PAGE AS IT WAS DRAWN, its markup for a new design to start from:
 * elements and their words, the classes and data a person never reads
 * left out, what is hidden and what draws no words left out, kept short.
 */
function markupOf(main: Element | null): string | null {
  if (!main?.isConnected) return null;
  // The page's own region, not the app's bar and footer around it.
  const copy = (main.querySelector("main") ?? main).cloneNode(true) as Element;
  for (const gone of copy.querySelectorAll("script, style, svg, button, input, select, textarea, [hidden], [aria-hidden='true'], [data-graview-popover]")) gone.remove();
  for (const element of [copy, ...copy.querySelectorAll("*")]) for (const name of [...element.getAttributeNames()]) element.removeAttribute(name);
  const html = copy.outerHTML.replace(/\s+/g, " ").replace(/<(div|span)>\s*<\/\1>/g, "").trim();
  return html.length > 6000 ? html.slice(0, 6000) : html;
}

/** What the records of the part are called in the agent's steps: "tasks". */
const nounOf = (part: PagePart) => (part.slot === "list" || part.slot === "group" ? part.name.toLowerCase() : part.slot === "record" ? "parts" : "records");

/** Each record the page showed, with its id and what a person could do on it there. */
function wantedOf(was: DrawnRead, ids: Readonly<Record<string, string>>): { label: string; id: string; presses?: boolean; opens?: boolean }[] {
  return was.records.flatMap((one) => (ids[one.label] ? [{ label: one.label, id: ids[one.label]!, ...(one.presses ? { presses: true } : {}), ...(one.opens ? { opens: true } : {}) }] : []));
}

/**
 * THE ACTS A PRESS MAY ASK FOR ON THE PART'S RECORDS: each act whose
 * subject is the kind (none that makes a record), its title, the argument
 * the record goes in, and — where it writes one yes-or-no field — what it
 * marks ("done"), so a new design can finish a task as the page did.
 */
function actsOf(here: ReturnType<typeof useGraview<AnySchema>>, part: PagePart): ActToBind[] {
  const { store } = here;
  const kinds = part.kind ? [part.kind] : store.schema.kinds;
  const shapeOf = (kind: string) => ((store.schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape ?? {}) as Record<string, unknown>;
  const yesOrNo = (field: unknown): boolean => {
    let def = (field as { _zod?: { def?: { type?: string; innerType?: unknown } } } | undefined)?._zod?.def;
    for (let depth = 0; depth < 6 && def && def.type !== "boolean" && def.innerType !== undefined; depth++) def = (def.innerType as { _zod?: { def?: { type?: string; innerType?: unknown } } })._zod?.def;
    return def?.type === "boolean";
  };
  return store.allMutations().flatMap((mutation): ActToBind[] => {
    const subject = mutation.subject as { kinds: readonly string[] | "*"; arg: string } | undefined;
    if (!subject || (mutation as { creates?: readonly string[] }).creates?.length) return [];
    const kind = kinds.find((one) => subject.kinds === "*" || subject.kinds.includes(one));
    if (!kind) return [];
    const writes = (mutation as { writes?: readonly string[] }).writes ?? [];
    const toggle = writes.length === 1 && yesOrNo(shapeOf(kind)[writes[0]!]) ? writes[0] : undefined;
    return [{ act: mutation.name, title: String((mutation as { title?: unknown }).title ?? mutation.name), record: subject.arg, ...(toggle ? { toggle } : {}) }];
  }).slice(0, 24);
}

/** The page's own region, found again where the draft drew the page anew. */
function document_main(): Element | null {
  return document.querySelector("[data-graview-page-main], main") ?? document.querySelector("[data-graview-face]");
}
