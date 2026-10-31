import type { GraviewDocument } from "@graview/core/document";
import type { Decide } from "./fast.js";
import type { HostAi, ThinkingProvider } from "./ai.js";
import { thinkingOf } from "./inline-ai.js";
import type { SectionMode, SectionStage } from "./section.js";

/*
 * MAKE ANY PAGE BETTER (Roadmap f-make-any-page-better), the half that is
 * pure but for the models it asks: fetched with "Make “Tasks” better" on a
 * built-in page (`@graview/tools/section`).
 *
 *   aboutTheLook   words typed in the menu: about how the part under the
 *                  cursor looks, or about its records? (the Fast slot)
 *   specCanSay     can the view spec say it, or does it need its own view?
 *                  (the Fast slot)
 *   draftPageSpec  the least edits over the view spec that do it: the light
 *                  model first, the full one where its answer cannot be
 *                  read and to repair what the checker refused, once
 *   draftPageView  the page as a worker view of its own, seeded from the
 *                  page as it stands and revised as asked, judged and
 *                  repaired once
 *
 * Nothing is kept here: the page shows what passes as a draft and the
 * host keeps it.
 */

/** The page's part, as the models are told it. */
export interface PagePartSaid {
  readonly name: string;
  readonly slot: "list" | "group" | "record" | "home" | "place";
  readonly kind?: string;
  readonly group?: string;
}

/** The Fast slot the host gave, or its `decide`, where AI is not off. */
const fastOf = (ai: HostAi | undefined): { readonly model: string; readonly decide: Decide } | undefined => (ai === undefined || ai.off ? undefined : (ai.fast ?? (ai.decide ? { model: ai.name ?? "decide", decide: ai.decide } : undefined)));

/** Words that are about how something looks or is laid out, read without a model where there is no Fast slot. */
const LOOK = /\b(look|looks|looking|nicer|prettier|cleaner|ugly|layout|laid out|lay it out|design|style|styled|theme|colou?rs?|font|bigger|smaller|larger|wider|narrower|taller|shorter|spacing|space|padding|margin|compact|dense|denser|roomier|columns?|grid|cards?|rows?|show (?:the )?\S+ (?:on|in) (?:each|every|the)|sort(?:ed)? by|order(?:ed)? by|group(?:ed)? by|readable|easier to read|at a glance|icons?|badges?|headings?|bold|highlight)\b/i;

/** Whether words typed in the menu are about how the part looks or about its records, and who said so. */
export async function aboutTheLook(ai: HostAi | undefined, words: string, name: string): Promise<{ readonly about: "look" | "records"; readonly by: "fast" | "words"; readonly confidence?: number }> {
  const said = words.trim();
  const fast = fastOf(ai);
  if (fast && said) {
    try {
      const decided = await fast.decide(
        { typed: said, on: name },
        {
          about: {
            type: "choice",
            instructions: `Somebody right-clicked “${name}” in an app and typed “${said}”. Is it about how “${name}” looks or is laid out, or about the records in it?`,
            criteria: {
              look: "How it looks or is laid out: making it look better, its style, size or spacing, what each row, card or page shows, its order or grouping",
              records: "The records themselves: changing, closing, assigning, adding, deleting or moving them, or a question about them",
            },
          },
        },
      );
      ai?.meter?.({ tier: "fast", model: fast.model, inputTokens: decided.usage.inputTokens, outputTokens: decided.usage.outputTokens, interaction: "menu" });
      const answer = decided.answers["about"];
      if (answer?.type === "choice" && (answer.choice === "look" || answer.choice === "records")) return { about: answer.choice, by: "fast", confidence: answer.confidence };
    } catch {
      // A Fast slot that fails leaves the words to decide.
    }
  }
  return { about: LOOK.test(said) ? "look" : "records", by: "words" };
}

/** Words that need drawing the view spec has no word for, read without a model where there is no Fast slot. */
const DRAWING = /\b(colou?rs?|font|typeface|bigger|smaller|larger|wider|narrower|taller|spacing|padding|margin|border|shadow|rounded|corners?|columns? side by side|side by side|grid|chart|graph|picture of|animation|background|gradient|icons?|css|kanban|calendar)\b/i;

/**
 * SPEC FIRST, UNLESS THE FAST SLOT IS SURE: a page goes to a view of its
 * own only where it says so with at least this confidence. A vague ask
 * ("make this page look better") is tried over the spec, whose model may
 * still answer that the spec cannot say it.
 */
export const OWN_VIEW_WHEN_SURE = 0.6;

/** Whether the view spec can say what was asked of the page, or it needs a view of its own. */
export async function specCanSay(ai: HostAi | undefined, words: string, part: PagePartSaid): Promise<{ readonly can: boolean; readonly by: "fast" | "words"; readonly confidence?: number }> {
  const said = words.trim();
  if (!said) return { can: true, by: "words" };
  const fast = fastOf(ai);
  if (fast) {
    try {
      const decided = await fast.decide(
        { asked: said, on: part.name, page: part.slot },
        {
          can: {
            type: "choice",
            instructions: `Somebody asked of the page “${part.name}”: “${said}”. Can the app's view settings do it, or does it need drawing of its own?`,
            criteria: {
              spec: "The view settings can do it: which fields a card, a row or a page shows and in what order, a headline, a badge with a tone, a figure, a progress bar, a list of related records, how a list is sorted, grouped or filtered, a field's label or format",
              drawing: "It needs drawing the settings have no word for: colors, fonts, sizes, spacing, borders or shadows, a layout or columns side by side, a chart, a calendar, a board, or markup and styles of its own",
            },
          },
        },
      );
      ai?.meter?.({ tier: "fast", model: fast.model, inputTokens: decided.usage.inputTokens, outputTokens: decided.usage.outputTokens, interaction: "section" });
      const answer = decided.answers["can"];
      if (answer?.type === "choice" && (answer.choice === "spec" || answer.choice === "drawing")) return { can: answer.choice === "spec" || answer.confidence < OWN_VIEW_WHEN_SURE, by: "fast", confidence: answer.confidence };
    } catch {
      // Read from the words.
    }
  }
  return { can: !DRAWING.test(said), by: "words" };
}

/** The edit ops a page's look may be changed by: the view spec, and nothing else of the app. */
export const PAGE_SPEC_OPS = ["set-view", "set-glance", "set-page-fields", "arrange-pages", "set-label", "set-format"] as const;
const ARRANGING = new Set(["sort", "group", "filters"]);

/** What in these edits is not the view spec's, in sentences: empty when every one is. */
export function notTheSpec(edits: readonly unknown[]): string[] {
  const said: string[] = [];
  if (edits.length === 0) said.push("It changed nothing.");
  for (const edit of edits) {
    const op = (edit as { op?: unknown } | null)?.op;
    if (typeof op !== "string" || !(PAGE_SPEC_OPS as readonly string[]).includes(op)) {
      said.push(`“${String(op)}” is not a change to how a page reads.`);
      continue;
    }
    if (op === "arrange-pages") for (const key of Object.keys(edit as object)) if (key !== "op" && !ARRANGING.has(key)) said.push(`arrange-pages may say only sort, group and filters here, not “${key}”.`);
    if (op === "set-label" && (edit as { field?: unknown }).field === undefined) said.push("set-label may name only a field's label here, not a kind's.");
  }
  return said;
}

export const PAGE_SPEC_SYSTEM = [
  "You change how one page of a Graview app reads, by editing its view spec: data that says what a kind's card, row and page show, and how a list opens. Nothing in it is code: no CSS, no markup, no colors or sizes of your own.",
  "You are told the page (a kind's list, one group of it, a record's page, or the home), what was asked, the kind's fields and relations, and its spec as it stands.",
  'Answer with one JSON object and nothing else: {"edits": [...], "said": "<one sentence to the person saying what will change>"}. Or, where the spec has no word for it (colors, fonts, sizes, spacing, layout, a chart), answer {"cannot": "<one sentence saying what it would need>"}.',
  "The edits you may use, and no others:",
  '{"op":"set-view","kind":K,"slot":"card"|"row"|"page","blocks":[...]} — a kind\'s card, its row on a list, the blocks over its record page; {"op":"set-view","slot":"home","blocks":[...]} — the home. Blocks: {"title":"{name}"}, {"headline":"{count(out(\'rel\'))} things"}, {"text":"{field}","lines":2}, {"badge":"{field}","tone":"good"|"warn"|"bad"|"neutral"|"accent"}, {"field":"due","as":"date"|"time"|"datetime"|"relative"|"money"|"percent"|"count","label":"Due"}, {"figure":"expr","as":"number"|"money"|"percent","label":"..."}, {"progress":{"value":"done","max":"total"},"label":"..."}, {"list":"out(\'rel\')" or "all(\'kind\')","as":"row"|"card","sort":{"by":"f","direction":"asc"|"desc"},"limit":5,"group":{"by":"f"},"empty":"None yet."}, {"group":[...blocks],"direction":"row"|"column"}, {"when":"rule expression","show":[...blocks]}, {"divider":true}. Templates say {field}; a row always leads with {"title":"{name}"} or the record\'s label field.',
  '{"op":"set-glance","kind":K,"fields":[...]} — the few facts said beside a record\'s name on a list.',
  '{"op":"set-page-fields","kind":K,"fields":[...],"groups":[{"title":"...","fields":[...]}]} — the order and groups of a record page\'s facts.',
  '{"op":"arrange-pages","sort":{K:{"by":"f","direction":"asc"|"desc"}},"group":{K:{"by":"f"}},"filters":{K:["f"]}} — how a kind\'s list opens. A list sorts by one of its kind\'s fields or computed values, and groups only by a choice or a yes-or-no field of its own: grouping by a relation or by the record that holds it is not the spec\'s to say.',
  '{"op":"set-label","kind":K,"field":F,"label":"..."}, {"op":"set-format","kind":K,"field":F,"format":"money"|"percent"|"duration"|null}.',
  "Name only fields and relations the kind has. Change only what the ask needs, on this page's kind. Keep every fact the page shows now unless asked to drop one.",
  "Do what was asked or answer cannot: never something else in its place (grouping by another field than the one asked for, say).",
].join("\n");

/** What the model is told of the page and its spec. */
export function pageSpecPrompt(ask: { readonly part: PagePartSaid; readonly document: GraviewDocument; readonly mode: SectionMode; readonly words?: string; readonly highlighted?: readonly string[]; readonly shows?: string; readonly findings?: readonly string[]; readonly last?: unknown }): string {
  const kind = ask.part.kind;
  const doc = ask.document as GraviewDocument & { readonly views?: Readonly<Record<string, unknown>>; readonly pages?: { readonly lists?: Readonly<Record<string, unknown>> } };
  const spec = kind ? (doc.kinds[kind] as Readonly<Record<string, unknown>> | undefined) : undefined;
  const asked = ask.mode === "just" ? "Make this page better: easier to read at a glance, the facts a person needs first. Change no data." : (ask.words ?? "").trim();
  return JSON.stringify({
    page: { name: ask.part.name, is: ask.part.slot === "list" ? "a kind's list" : ask.part.slot === "group" ? `one group of a kind's list (“${ask.part.group}”)` : ask.part.slot === "record" ? "a record's page (every record of the kind)" : ask.part.slot === "home" ? "the home" : "a place", ...(kind ? { kind } : {}) },
    asked,
    ...(ask.highlighted?.length ? { pointed_at: ask.highlighted } : {}),
    ...(spec ? { fields: spec["fields"], relations: spec["edges"] ?? spec["relations"], computed: spec["computed"], glance: spec["glance"], pageFields: spec["pageFields"] } : { kinds: Object.keys(doc.kinds) }),
    now: { ...(kind ? { views: doc.views?.[kind] ?? null, list: doc.pages?.lists?.[kind] ?? null } : { home: doc.views?.["home"] ?? null }) },
    ...(ask.shows ? { shows: ask.shows.slice(0, 1500) } : {}),
    ...(ask.findings?.length ? { your_last_answer: ask.last, what_broke: ask.findings, repair: "Your last answer was refused as said in what_broke. Answer again, fixing each one — or, where the spec cannot do what was asked, answer cannot." } : {}),
  });
}

/** The first JSON object in a model's answer. */
function jsonOf(text: string): Record<string, unknown> | undefined {
  const fenced = /```(?:json|js|javascript)?\s*([\s\S]*?)```/.exec(text)?.[1];
  for (const body of fenced ? [fenced, text] : [text]) {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // The next.
    }
  }
  return undefined;
}

/** The model's answer read: the edits and the sentence, or what it says the spec cannot do; undefined when it is neither. */
export function readPageSpecReply(text: string): { readonly edits: readonly unknown[]; readonly said: string } | { readonly cannot: string } | undefined {
  const parsed = jsonOf(text);
  if (!parsed) return undefined;
  if (typeof parsed["cannot"] === "string" && parsed["cannot"].trim()) return { cannot: parsed["cannot"].trim() };
  if (!Array.isArray(parsed["edits"])) return undefined;
  return { edits: parsed["edits"], said: typeof parsed["said"] === "string" && parsed["said"].trim() ? parsed["said"].trim() : "Changed how this page reads." };
}

type Asked = (provider: ThinkingProvider, stage: SectionStage["stage"], system: string, prompt: string) => Promise<string | undefined>;

/** Asks a slot, timed, what it spent kept as a stage. */
function asker(stages: SectionStage[]): Asked {
  return async (provider, stage, system, prompt) => {
    const began = Date.now();
    try {
      const reply = await provider.think({ system, prompt, state: {} as never, catalog: { candidates: [] } as never });
      stages.push({ stage, model: provider.model, ms: Date.now() - began, ...(reply.usage ? { usage: reply.usage } : {}) });
      return reply.text;
    } catch {
      stages.push({ stage, model: provider.model, ms: Date.now() - began });
      return undefined;
    }
  };
}

export interface DraftPageSpecOptions {
  readonly ai: HostAi;
  readonly document: GraviewDocument;
  readonly part: PagePartSaid;
  readonly mode: SectionMode;
  readonly words?: string;
  readonly highlighted?: readonly string[];
  readonly shows?: string;
  /** THE HOST'S JUDGMENT of the edits: the checker's refusal and anything else that keeps them from being offered, in sentences; empty when they may be. */
  readonly judge: (edits: readonly unknown[]) => Promise<readonly string[]>;
  /** Told when the first try was refused and is handed back, with what was refused. */
  readonly repairing?: (findings: readonly string[]) => void;
}

export type DraftPageSpecResult =
  | { readonly ok: true; readonly edits: readonly unknown[]; readonly said: string; readonly repaired: boolean; readonly stages: readonly SectionStage[] }
  | { readonly ok: false; readonly cannot?: string; readonly refused: string; readonly stages: readonly SectionStage[] };

/**
 * THE LEAST EDITS OVER THE VIEW SPEC: the light model first — the full one
 * where its answer cannot be read — held to the spec's ops and judged by
 * the host (its checker); what is refused is handed back once to the full
 * model, and refused in words if it fails again. A model that says the
 * spec cannot do it is answered `cannot`, for the page to offer its own view.
 */
export async function draftPageSpec(options: DraftPageSpecOptions): Promise<DraftPageSpecResult> {
  const stages: SectionStage[] = [];
  const light = options.ai.off ? undefined : options.ai.light;
  const full = thinkingOf(options.ai);
  const first = light ?? full;
  if (!first) return { ok: false, refused: options.ai.withoutModel ?? "Changing a page needs AI, and none is on here.", stages };
  const ask = asker(stages);
  const base = { part: options.part, document: options.document, mode: options.mode, ...(options.words ? { words: options.words } : {}), ...(options.highlighted ? { highlighted: options.highlighted } : {}), ...(options.shows ? { shows: options.shows } : {}) };
  const read = async (provider: ThinkingProvider, stage: SectionStage["stage"], prompt: string) => {
    const text = await ask(provider, stage, PAGE_SPEC_SYSTEM, prompt);
    return text === undefined ? undefined : readPageSpecReply(text);
  };
  let answer = await read(first, light ? "light" : "thinking", pageSpecPrompt(base));
  if (!answer && light && full && full !== light) answer = await read(full, "thinking", pageSpecPrompt(base));
  if (!answer) return { ok: false, refused: "The model did not answer with a change to this page.", stages };
  if ("cannot" in answer) return { ok: false, cannot: answer.cannot, refused: answer.cannot, stages };
  const judged = async (edits: readonly unknown[]) => {
    const own = notTheSpec(edits);
    return own.length > 0 ? own : [...(await options.judge(edits))];
  };
  let findings = await judged(answer.edits);
  if (findings.length === 0) return { ok: true, edits: answer.edits, said: answer.said, repaired: false, stages };
  const repairer = full ?? first;
  options.repairing?.(findings);
  const again = await read(repairer, repairer === light ? "light" : "thinking", pageSpecPrompt({ ...base, findings, last: answer }));
  if (again && "cannot" in again) return { ok: false, cannot: again.cannot, refused: again.cannot, stages };
  if (!again) return { ok: false, refused: `It could not be changed so: ${findings.join(" ")}`, stages };
  findings = await judged(again.edits);
  if (findings.length > 0) return { ok: false, refused: `It could not be changed so: ${findings.join(" ")}`, stages };
  return { ok: true, edits: again.edits, said: again.said, repaired: true, stages };
}

/** A worker view's manifest for the page a part is on: its name, title, what it attaches to and draws. */
export interface ForkManifest {
  readonly name: string;
  /** None: the view is the page it was made of, not a place of its own beside it. */
  readonly title?: string;
  readonly attach: string;
  readonly cardinality: "one" | "many";
  readonly replaces?: "page";
  readonly reads?: { readonly kinds?: readonly string[]; readonly edges?: readonly string[] };
}

const slug = (words: string) => words.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "page";

/**
 * THE VIEW A PAGE BECOMES: a kind's list (a group's too) is a view of many
 * that is the list page, a record's page a view of one that is the whole
 * page, the home the home's body — each reading the kinds and the
 * relations the kind is linked by — untitled, so it is that page and not a
 * place of its own beside it. Undefined for a place, which a lens draws.
 */
export function forkManifest(part: PagePartSaid, links: { readonly kinds: readonly string[]; readonly edges: readonly string[] }): ForkManifest | undefined {
  const reads = { ...(links.kinds.length ? { kinds: [...links.kinds] } : {}), ...(links.edges.length ? { edges: [...links.edges] } : {}) };
  const read = Object.keys(reads).length > 0 ? { reads } : {};
  if ((part.slot === "list" || part.slot === "group") && part.kind) return { name: `${slug(part.kind)}-list`, attach: part.kind, cardinality: "many", replaces: "page", ...read };
  if (part.slot === "record" && part.kind) return { name: `${slug(part.kind)}-page`, attach: part.kind, cardinality: "one", replaces: "page", ...read };
  if (part.slot === "home") return { name: "home-page", attach: "home", cardinality: "many", ...read };
  return undefined;
}

export const PAGE_VIEW_SYSTEM = [
  "You write a Graview worker view: one plain script, no imports and no build, that draws one page of an app through the global `graview`, in place of the page the app drew by itself.",
  "The global: graview.style(css) a stylesheet; graview.onProps((props) => …) on every push of what it is shown; graview.render(graview.html`…`) draws markup, every ${value} escaped; graview.html`` nests.",
  "props.nodes holds the records a view of many is drawn for and those it reads; props.node the record a view of one is drawn for. A record is plain data: id, kind, label, and each field by name. props.edges are {kind, from, to}. props.choices[kind][field][option] is a choice's label.",
  'Link to a record with <a data-record="${node.id}">…</a>. Give repeated rows data-key="${node.id}". Name each part a person would name with a heading, in a <section aria-labelledby="part-h"> whose heading has id="part-h"; never aria-label.',
  "Style with var(--graview-ink), var(--graview-ink-muted), var(--graview-panel), var(--graview-edge), var(--graview-accent), var(--graview-ground), var(--graview-radius) — never colors of your own. Lay it out well at a phone's width and at a desk's. Set no height.",
  "Never write the words import, export or require, nor <script>, <style>, or on…= attributes. Never style :host, ::slotted or ::part, nor use url(), @import or @font-face: style the view's own outer element instead.",
  "You are told the page as it stands — its headings and what it shows — and the data it reads. Keep every heading it has (the same words) and show the same data, then change it as asked.",
  'Answer with one JSON object and nothing else: {"source": "<the whole script>", "said": "<one sentence to the person saying what you changed>"}.',
].join("\n");

/** What the model is told of the page it rewrites as a view. */
export function pageViewPrompt(ask: { readonly part: PagePartSaid; readonly manifest: ForkManifest; readonly mode: SectionMode; readonly words?: string; readonly highlighted?: readonly string[]; readonly outline: string; readonly data: unknown; readonly findings?: readonly string[]; readonly last?: unknown }): string {
  const asked = ask.mode === "just" ? "Make this page better: easier to read at a glance, laid out cleanly, in the app's own look. Change no data it shows." : (ask.words ?? "").trim();
  return JSON.stringify({
    page: ask.part.name,
    view: { attach: ask.manifest.attach, cardinality: ask.manifest.cardinality, reads: ask.manifest.reads ?? {} },
    asked,
    ...(ask.highlighted?.length ? { pointed_at: ask.highlighted } : {}),
    as_it_stands: ask.outline.slice(0, 4000),
    data: ask.data,
    ...(ask.findings?.length ? { your_last_answer: ask.last, what_broke: ask.findings, repair: "Your last answer broke as said in what_broke. Answer again, fixing each one." } : {}),
  });
}

/** The model's view read: the script and the sentence; undefined when it is not one. */
export function readPageViewReply(text: string): { readonly source: string; readonly said: string } | undefined {
  const parsed = jsonOf(text);
  const source = parsed?.["source"];
  if (typeof source !== "string" || !/graview\.(render|onProps)/.test(source)) return undefined;
  return { source, said: typeof parsed!["said"] === "string" && (parsed!["said"] as string).trim() ? (parsed!["said"] as string).trim() : "Made it a view of its own." };
}

export interface DraftPageViewOptions {
  readonly ai: HostAi;
  readonly part: PagePartSaid;
  readonly manifest: ForkManifest;
  readonly mode: SectionMode;
  readonly words?: string;
  readonly highlighted?: readonly string[];
  /** The page as it stands: its headings and the words it shows, a line each. */
  readonly outline: string;
  /** The data it reads: the kind's fields and a few records. */
  readonly data: unknown;
  /** THE PAGE'S JUDGMENT of a view: drawn as a draft, the host's own checks, compared with the page it replaces — the findings that keep it from being offered. */
  readonly judge: (source: string) => Promise<readonly string[]>;
  /** Told when the first try failed and is handed back, with what broke. */
  readonly repairing?: (findings: readonly string[]) => void;
}

export type DraftPageViewResult = { readonly ok: true; readonly source: string; readonly said: string; readonly repaired: boolean; readonly stages: readonly SectionStage[] } | { readonly ok: false; readonly refused: string; readonly stages: readonly SectionStage[] };

/**
 * THE PAGE AS A VIEW OF ITS OWN, revised as asked: the light model first
 * (the full one where its answer cannot be read), judged on the page; what
 * fails is handed back once to the full model, and refused in words if it
 * fails again.
 */
export async function draftPageView(options: DraftPageViewOptions): Promise<DraftPageViewResult> {
  const stages: SectionStage[] = [];
  const light = options.ai.off ? undefined : options.ai.light;
  const full = thinkingOf(options.ai);
  const first = light ?? full;
  if (!first) return { ok: false, refused: options.ai.withoutModel ?? "Making a page its own view needs AI, and none is on here.", stages };
  const ask = asker(stages);
  const base = { part: options.part, manifest: options.manifest, mode: options.mode, outline: options.outline, data: options.data, ...(options.words ? { words: options.words } : {}), ...(options.highlighted ? { highlighted: options.highlighted } : {}) };
  const read = async (provider: ThinkingProvider, stage: SectionStage["stage"], prompt: string) => {
    const text = await ask(provider, stage, PAGE_VIEW_SYSTEM, prompt);
    return text === undefined ? undefined : readPageViewReply(text);
  };
  /*
   * The light model first, as everywhere a card drafts: a whole page from a
   * reasoning model took minutes where the light one took seconds. The full
   * one where the light one's answer cannot be read, and to repair.
   */
  let view = await read(first, first === light ? "light" : "thinking", pageViewPrompt(base));
  if (!view && light && full && full !== light) view = await read(full, "thinking", pageViewPrompt(base));
  if (!view) return { ok: false, refused: "The model did not answer with a view of this page.", stages };
  let findings = await options.judge(view.source);
  if (findings.length === 0) return { ok: true, source: view.source, said: view.said, repaired: false, stages };
  const repairer = full ?? first;
  options.repairing?.(findings);
  const again = await read(repairer, repairer === light ? "light" : "thinking", pageViewPrompt({ ...base, findings, last: { source: view.source.slice(0, 6000), said: view.said } }));
  if (!again) return { ok: false, refused: `It could not be drawn without breaking: ${findings.join(" ")}`, stages };
  findings = await options.judge(again.source);
  if (findings.length > 0) return { ok: false, refused: `It could not be drawn without breaking: ${findings.join(" ")}`, stages };
  return { ok: true, source: again.source, said: again.said, repaired: true, stages };
}
