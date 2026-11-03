import type { HostAi, ThinkingProvider } from "./ai.js";
import { cssFindings, type DrawnRead } from "./draft-check.js";
import { thinkingOf } from "./inline-ai.js";
import { checklistOf, groupingRule, PAGE_VIEW_SYSTEM, readPageViewReply, type ForkManifest, type PagePartSaid, type PageViewKeeps } from "./page-better.js";
import type { SectionStage } from "./section.js";

/*
 * BETTER UI AS A CONVERSATION (Roadmap f-make-any-page-better): a new
 * design is made the way a person's connected chat makes one — a strong
 * model that looks at the page, reads what it shows, drafts, is told what
 * its draft broke and what it drew, and fixes it, as many times as it
 * takes, saying each step in a sentence — inside the app, in a panel
 * beside the part. The checks a draft is held to are what the agent is
 * told, never a refusal to the person: it decides when it is done, or asks.
 *
 * One plain request at a time through the host's Thinking slot (prompt in,
 * text out), so any model a host lends works: the agent answers one JSON
 * object a step — what it says, what it does — and the page runs the step.
 */

/** What the agent may do in one step. */
export type DesignAgentMove = "look" | "read" | "draft" | "done" | "ask";

/** A step the agent took and what came of it, as the next request tells it back. */
export interface DesignAgentStep {
  readonly said: string;
  readonly did: DesignAgentMove;
  /** What came of it: what the page shows (look), the records (read), the checks' findings and what the draft drew (draft). */
  readonly result?: unknown;
}

/** A line of the conversation: the person's words or the agent's. */
export interface DesignTalk {
  readonly who: "person" | "graview";
  readonly said: string;
}

/** What the page runs for the agent: it looks, reads, and draws a draft where only the agent sees it. */
export interface DesignAgentHost {
  /** What the page draws now, record by record: headings, each record's words and the heading it sits under, how they stand. */
  look(): unknown;
  /** The records the view is handed and the fields they carry. */
  read(): unknown;
  /**
   * Draws a script where nobody sees it and judges it: the findings (empty
   * when it may be shown) and what it drew. A draft that passes is shown on
   * the page as the draft by the host, before the next step.
   */
  draft(source: string): Promise<{ readonly findings: readonly string[]; readonly drew: unknown }>;
}

/** Told as the agent works: a step to show in the panel. */
export interface DesignAgentEvent {
  /** `streaming`: the agent's words so far, as the model writes them — replaced by the next, and gone when the step is said. */
  readonly kind: "look" | "read" | "draft" | "check" | "passed" | "said" | "streaming";
  /** In plain words, for the panel: "Looking at Tasks", "Check: dates lost on 3 tasks — fixing". */
  readonly text: string;
}

export interface DesignAgentOptions {
  readonly ai: HostAi;
  readonly part: PagePartSaid;
  readonly manifest: ForkManifest;
  /** The conversation so far, the person's last words last. */
  readonly talk: readonly DesignTalk[];
  /** What the page must keep: its title (drawn by the page), headings, records, what each says and where it sits. */
  readonly keep?: PageViewKeeps;
  /** The page as drawn, its markup, to start from. */
  readonly markup?: string;
  /** The draft on the page now (a passing one, or the kept view), to change again. */
  readonly current?: string;
  readonly host: DesignAgentHost;
  readonly onEvent?: (event: DesignAgentEvent) => void;
  /** Stops the turn at once: the result is `stopped`. */
  readonly signal?: AbortSignal;
  /** The most requests one turn makes (12). */
  readonly steps?: number;
  /** How long one request may take before the turn says the model did not answer (10 minutes). */
  readonly stepMs?: number;
  /** What the records are called, for the steps the panel shows ("dates lost on 3 tasks"). */
  readonly noun?: string;
  /** A part of a view the person is changing: only it changes, every other part of the script kept as it is. */
  readonly section?: string;
}

export type DesignAgentResult = {
  /** How the turn ended: the agent said it was done, asked the person something, ran out of steps, or was stopped. */
  readonly ended: "done" | "ask" | "steps" | "stopped" | "no-model";
  /** Its last words to the person. */
  readonly said: string;
  /** The last draft that passed this turn, shown on the page: none where nothing passed. */
  readonly passed?: { readonly source: string };
  /** The last draft it made, passed or not, and what was still wrong with it. */
  readonly last?: { readonly source: string; readonly findings: readonly string[] };
  readonly steps: readonly DesignAgentStep[];
  readonly stages: readonly SectionStage[];
};

/** The most requests one turn of the agent makes. */
export const DESIGN_AGENT_STEPS = 12;

export const DESIGN_AGENT_SYSTEM = [
  PAGE_VIEW_SYSTEM.split("\n").filter((line) => !line.startsWith("Answer with one JSON object")).join("\n"),
  "",
  "You are Graview, redesigning one page of an app with the person who is looking at it. You work in steps, and each answer is ONE JSON object and nothing else:",
  '{"say": "<one short plain sentence the person reads: what you are doing or what you found>", "do": "look" | "read" | "draft" | "done" | "ask", "source": "<the whole script, only with draft>"}',
  "You are shown, before your first step, what the page draws now (what_the_page_draws: its headings, each record's words and the heading it sits under, how they stand) and the records your view is handed (records_it_is_handed): draft first.",
  "- look: see what the page draws now again, as it stands.",
  "- read: the records and fields your view is handed, again.",
  "- draft: your whole script, drawn where only you see it, with \"say\" one sentence of what it does, as the person will read it once it is on the page (\"Tasks are cards now, side by side, each with its status and date.\"). You are told what the checks found (records, headings, dates, statuses or groups it lost; words it shows as the computer keeps them; styles the page will not keep) and what it drew. A draft the checks pass is shown to the person on the page, and your turn ends there.",
  "- done: you have finished this request; say in one sentence what you changed. Only once a draft passed, unless you must ask.",
  "- ask: ask the person one short question, and wait for their answer.",
  "Keep everything the page showed unless the person asked otherwise: every record, every heading, each record's words (its status, its dates, its counts) and its group. Fix what the checks found and draft again; keep going until a draft passes. Write to a person, never about code: no words like view, script, spec, host, CSS or stylesheet in what you say.",
].join("\n");

/** What one request tells the agent: the page, the conversation, the steps it took this turn and what came of each. */
export function designAgentPrompt(options: Pick<DesignAgentOptions, "part" | "manifest" | "talk" | "keep" | "markup" | "current" | "section"> & { readonly seen?: { readonly look: unknown; readonly read: unknown } }, steps: readonly DesignAgentStep[]): string {
  const keep = options.keep;
  return JSON.stringify({
    page: options.part.name,
    view: { attach: options.manifest.attach, cardinality: options.manifest.cardinality, reads: options.manifest.reads ?? {} },
    conversation: options.talk.map((one) => ({ [one.who === "person" ? "person" : "you"]: one.said })),
    ...(options.section ? { only_change: `Change only the part “${options.section}” of your_draft_on_the_page; keep every other part of the script as it is, byte for byte.` } : {}),
    ...(keep ? { ...(keep.title ? { the_page_draws_its_title: keep.title } : {}), keep_these_headings: keep.headings, records: checklistOf(keep), ...(keep.grouping ? { grouping: groupingRule(keep.grouping) } : {}) } : {}),
    ...(options.markup && !options.current ? { the_page_as_html: options.markup.slice(0, 5000) } : {}),
    ...(options.current ? { your_draft_on_the_page: options.current.slice(0, 9000) } : {}),
    // The steps so far this turn, each with what came of it; only the last draft's script whole, the earlier ones said by what came of them.
    your_steps: steps.map((one, at) => ({ said: one.said, did: one.did, ...(one.result !== undefined ? { result: one.result } : {}), ...(at < steps.length - 1 && one.did === "draft" ? { note: "an earlier draft" } : {}) })),
    ...(steps.length === 0 && options.seen ? { what_the_page_draws: options.seen.look, records_it_is_handed: options.seen.read } : {}),
    next: steps.length === 0 ? "Draft first, as one JSON object." : "Your next step, as one JSON object.",
  });
}

/** One answer of the agent read: what it said and did, with its script for a draft; undefined where it is not one. */
export function readAgentReply(text: string): { readonly say: string; readonly do: DesignAgentMove; readonly source?: string } | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const move = parsed["do"];
  if (move !== "look" && move !== "read" && move !== "draft" && move !== "done" && move !== "ask") return undefined;
  const say = typeof parsed["say"] === "string" ? parsed["say"].trim() : "";
  if (move !== "draft") return { say, do: move };
  const view = readPageViewReply(JSON.stringify({ source: parsed["source"], said: say }));
  return view ? { say, do: "draft", source: view.source } : undefined;
}

/**
 * WHAT THE CHECKS FOUND, IN A FEW WORDS for the panel: "dates lost on 3
 * tasks", "2 tasks missing", "a task moved to another group". The agent
 * is told the findings whole; the person sees this.
 */
export function checkSaid(findings: readonly string[], noun = "records"): string {
  const said: string[] = [];
  for (const finding of findings) {
    const facts = /no longer says what it said: (.*?)(?: and (\d+) more)?\. Show/.exec(finding);
    if (facts) {
      const on = new Set([...facts[1]!.matchAll(/” on “([^”]+)”/g)].map((one) => one[1]));
      const days = [...facts[1]!.matchAll(/“([^”]+)” on “/g)].some((one) => /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(one[1]!));
      const count = on.size + Number(facts[2] ?? 0);
      said.push(`${days ? "dates" : "details"} lost on ${count === 1 ? `one of the ${noun}` : `${count} ${noun}`}`);
      continue;
    }
    const lost = /^It no longer shows (.*?)(?: and (\d+) more)?: show every record/.exec(finding);
    if (lost) {
      const count = [...lost[1]!.matchAll(/“/g)].length + Number(lost[2] ?? 0);
      said.push(`${count === 1 ? `one of the ${noun}` : `${count} ${noun}`} missing`);
    } else if (/no longer shows the heading/.test(finding)) said.push("headings missing");
    else if (/moved to another group|more often than the page did/.test(finding)) said.push(`${noun} in the wrong group`);
    else if (/drawn twice/.test(finding)) said.push("the title drawn twice");
    else if (/markup as words|a date as “|as the computer keeps it|a field's name/.test(finding)) said.push("words shown as the computer keeps them");
    else if (/did not draw|not drawn|threw/.test(finding)) said.push("it didn't draw");
    else if (/not allowed|removed|reaches outside/.test(finding)) said.push("styles the page won't keep");
  }
  const unique = [...new Set(said)];
  return unique.length > 0 ? unique.slice(0, 3).join(", ") : "something didn't draw right";
}

/** A model's answer, or "stopped" the moment the signal says so — or "late" past `ms`. */
async function unlessStopped<T>(answer: Promise<T>, signal: AbortSignal | undefined, ms?: number): Promise<{ readonly value: T } | "stopped" | "late"> {
  if (signal?.aborted) return "stopped";
  let stop: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const raced = await Promise.race([
    answer.then((value) => ({ value })),
    ...(signal ? [new Promise<"stopped">((done) => signal.addEventListener("abort", (stop = () => done("stopped")), { once: true }))] : []),
    ...(ms !== undefined ? [new Promise<"late">((done) => (timer = setTimeout(() => done("late"), ms)))] : []),
  ]);
  if (stop) signal?.removeEventListener("abort", stop);
  if (timer) clearTimeout(timer);
  return raced;
}

/**
 * ONE TURN OF THE AGENT: from the person's last words, step by step — it
 * looks, reads, drafts, is told what the checks found and what it drew,
 * and drafts again — until it says it is done, asks, runs out of steps or
 * is stopped. Each step is told (`onEvent`) for the panel. Nothing is kept
 * here: a draft that passed is the host's to show, and the person's to keep.
 */
export async function runDesignAgent(options: DesignAgentOptions): Promise<DesignAgentResult> {
  const stages: SectionStage[] = [];
  const steps: DesignAgentStep[] = [];
  const model: ThinkingProvider | undefined = options.ai.off ? undefined : (options.ai.design ?? thinkingOf(options.ai) ?? options.ai.light);
  if (!model) return { ended: "no-model", said: options.ai.withoutModel ?? "Changing how a page looks needs AI, and none is on here.", steps, stages };
  const tell = (event: DesignAgentEvent) => options.onEvent?.(event);
  const noun = options.noun ?? (options.part.slot === "record" ? "parts" : "records");
  let passed: { readonly source: string } | undefined;
  let last: { readonly source: string; readonly findings: readonly string[] } | undefined;
  let unreadable = 0;
  const most = Math.max(2, options.steps ?? DESIGN_AGENT_STEPS);
  /* What the page draws and what the view is handed, looked at once before the first request: one request less for the person to wait on. */
  tell({ kind: "look", text: `Looking at ${options.part.name}` });
  const seen = { look: options.host.look(), read: options.host.read() };
  for (let at = 0; at < most; at++) {
    const began = Date.now();
    const asked = await unlessStopped(
      (model.stream
        ? model.stream({ system: DESIGN_AGENT_SYSTEM, prompt: designAgentPrompt({ ...options, seen }, steps), state: {} as never, catalog: { candidates: [] } as never }, (soFar) => tell({ kind: "streaming", text: writingSaid(soFar) }), options.signal)
        : model.think({ system: DESIGN_AGENT_SYSTEM, prompt: designAgentPrompt({ ...options, seen }, steps), state: {} as never, catalog: { candidates: [] } as never })
      ).then(
        (reply) => {
          stages.push({ stage: "thinking", model: model.model, ms: Date.now() - began, ...(reply.usage ? { usage: reply.usage } : {}) });
          return reply.text as string | undefined;
        },
        () => {
          stages.push({ stage: "thinking", model: model.model, ms: Date.now() - began });
          return undefined;
        },
      ),
      options.signal,
      options.stepMs ?? 10 * 60_000,
    );
    if (asked === "late") return { ended: "steps", said: passed ? "The model stopped answering; here is where it got to." : "The model didn't answer in time. Ask again, or say it another way.", ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
    if (asked === "stopped") return { ended: "stopped", said: "Stopped.", ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
    const move = asked.value === undefined ? undefined : readAgentReply(asked.value);
    if (!move) {
      unreadable += 1;
      if (unreadable >= 3) break;
      steps.push({ said: "", did: "look", result: { error: "Your answer was not one JSON object with say and do (and the whole script in source for a draft). Answer again." } });
      continue;
    }
    if (move.do === "look") {
      tell({ kind: "look", text: `Looking at ${options.part.name}` });
      steps.push({ said: move.say, did: "look", result: options.host.look() });
    } else if (move.do === "read") {
      tell({ kind: "read", text: `Reading what ${options.part.name} shows` });
      steps.push({ said: move.say, did: "read", result: options.host.read() });
    } else if (move.do === "draft") {
      tell({ kind: "draft", text: move.say ? `Drafting: ${move.say.replace(/\.$/, "")}` : "Drafting" });
      const stripped = cssFindings(move.source!);
      const drawn = stripped.length > 0 ? { findings: stripped, drew: undefined } : await unlessStopped(options.host.draft(move.source!), options.signal).then((one) => (typeof one === "string" ? undefined : one.value));
      if (!drawn) return { ended: "stopped", said: "Stopped.", ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
      last = { source: move.source!, findings: drawn.findings };
      if (drawn.findings.length === 0) {
        passed = { source: move.source! };
        tell({ kind: "passed", text: "Check: nothing lost — it's on the page" });
        steps.push({ said: move.say, did: "draft", result: { findings: [], drew: drawn.drew, shown: "It passed and is on the page now." } });
        // A draft that passed ends the turn: the person sees it, and says what next.
        return { ended: "done", said: move.say || "Here it is.", passed, last, steps, stages };
      } else {
        tell({ kind: "check", text: `Check: ${checkSaid(drawn.findings, noun)} — fixing` });
        steps.push({ said: move.say, did: "draft", result: { findings: drawn.findings, drew: drawn.drew } });
      }
    } else if (move.do === "ask") {
      return { ended: "ask", said: move.say || "What would you like it to look like?", ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
    } else {
      if (!passed && last && last.findings.length > 0 && at < most - 2) {
        // Done is only done once a draft passed: told so once, it fixes what is left or asks.
        steps.push({ said: move.say, did: "done", result: { not_yet: "No draft has passed the checks yet. Fix what the last check found and draft again, or ask the person." } });
        continue;
      }
      return { ended: "done", said: move.say || (passed ? "Done." : "I stopped here."), ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
    }
  }
  return { ended: "steps", said: passed ? "Here is where it got to." : "I haven't got it right yet. Tell me more, or ask me to keep going.", ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
}

/**
 * WHAT THE AGENT IS WRITING, SAID AS IT WRITES IT: the sentence it is
 * saying (its `say`, as far as it has got), then how far into the design
 * it is — never its code.
 */
export function writingSaid(soFar: string): string {
  const said = /"say"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(soFar)?.[1];
  let say = "";
  if (said !== undefined) {
    try {
      say = JSON.parse(`"${said.replace(/\\$/, "")}"`) as string;
    } catch {
      say = said;
    }
  }
  const source = soFar.indexOf('"source"');
  const lines = source >= 0 ? soFar.slice(source).split("\\n").length : 0;
  const writing = lines > 1 ? `writing it, ${lines} lines so far` : "";
  if (say && writing) return `${say.replace(/\.$/, "")} — ${writing}`;
  if (say) return say;
  return writing ? `Writing the design, ${lines} lines so far` : "Thinking…";
}

/** What the page draws, read for the agent: headings, and each record with what it says, where it sits and how it stands. */
export function lookOf(read: DrawnRead): unknown {
  return {
    headings: read.headings,
    records: read.records.map((one) => ({ record: one.label, says: one.facts ?? [], ...(one.under ? { under: one.under } : {}), at: { top: one.top, left: one.left }, type_px: one.size })),
  };
}
