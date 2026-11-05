import type { HostAi, ThinkingProvider } from "./ai.js";
import { asksToReword, cssFindings, findingKind, findingsOf, type DraftFinding, type DrawnRead } from "./draft-check.js";
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

/**
 * WHAT THE AGENT MAY DO IN ONE STEP, the whole set: look at the page
 * again, read its records again, edit the script in place (exact find and
 * replace pairs the code applies — a small change), draft the whole script
 * (a redesign), say it is done, or ask the person.
 */
export const DESIGN_AGENT_MOVES = ["look", "read", "edit", "draft", "done", "ask"] as const;

/** What the agent may do in one step. */
export type DesignAgentMove = (typeof DESIGN_AGENT_MOVES)[number];

/** One change of an edit: text found exactly once in the script, and what stands there instead. */
export interface ScriptEdit {
  readonly find: string;
  readonly replace: string;
}

/** How much of a script the agent is shown whole, to quote from: far past any view a chat writes. */
const SCRIPT_SHOWN = 64_000;

/** Text quoted back to the agent: whole when short, its start when long. */
const quotedBack = (text: string) => (text.length > 80 ? `${text.slice(0, 79)}…` : text);

/**
 * AN EDIT APPLIED BY THE CODE, NEVER BY THE MODEL (Roadmap
 * f-better-ui-small-edits): each find looked for in the script as it stands
 * after the edits before it, and replaced where it is there exactly once.
 * One that is not there, or is there more than once, is said back in words
 * the agent can act on ("appears 3 times …: quote more of the text around
 * the place you mean") and nothing is applied. `where` names the script
 * in those words ("the script on the page", "your last draft").
 */
export function applyEdits(source: string, edits: readonly ScriptEdit[], where: string): { readonly source: string } | { readonly findings: readonly string[] } {
  const findings: string[] = [];
  let edited = source;
  edits.forEach((edit, at) => {
    const said = `Edit ${at + 1}: “${quotedBack(edit.find)}”`;
    if (!edit.find) return void findings.push(`${said} is no text to find: quote the text to change, exactly as it stands in ${where}.`);
    let times = 0;
    for (let from = edited.indexOf(edit.find); from >= 0 && times < 2; from = edited.indexOf(edit.find, from + edit.find.length)) times += 1;
    if (times === 0) {
      const squashed = (text: string) => text.replace(/\s+/g, "");
      const spaced = squashed(edit.find).length > 0 && squashed(edited).includes(squashed(edit.find));
      return void findings.push(`${said} is not in ${where}${spaced ? " as written, but is there with other spacing" : ""}: quote it exactly as it stands there, spaces and quotes included.`);
    }
    if (times > 1) {
      const count = edited.split(edit.find).length - 1;
      return void findings.push(`${said} appears ${count} times in ${where}: quote more of the text around the place you mean, so it appears once.`);
    }
    const index = edited.indexOf(edit.find);
    edited = `${edited.slice(0, index)}${edit.replace}${edited.slice(index + edit.find.length)}`;
  });
  if (findings.length > 0) return { findings };
  if (edited === source) return { findings: [`Your edits change nothing in ${where}: replace the text with something else, or say you are done.`] };
  return { source: edited };
}

/** An act a press may ask for on the records drawn. */
export interface ActToBind {
  readonly act: string;
  readonly title: string;
  /** The argument the record goes in (`data-record` fills it). */
  readonly record: string;
  /** What it marks on or off, where it is a toggle ("done"). */
  readonly toggle?: string;
}

/** A step the agent took and what came of it, as the next request tells it back. */
export interface DesignAgentStep {
  readonly said: string;
  readonly did: DesignAgentMove;
  /** With an edit: the changes it asked for, as it gave them. */
  readonly edits?: readonly ScriptEdit[];
  /** What came of it: what the page shows (look), the records (read), the checks' findings and what the draft drew (draft, edit). */
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
  readonly kind: "look" | "read" | "edit" | "draft" | "check" | "passed" | "said" | "streaming" | "stuck";
  /** In plain words, for the panel: "Looking at Tasks", "Check: dates lost on 3 tasks — fixing". */
  readonly text: string;
  /** With a check, and where it is stuck: what the checks found, each whole with its kind, as the agent was handed them. */
  readonly findings?: readonly DraftFinding[];
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
  /** The headings of the part being changed: where the person asks for a heading's words to change, these may change, in their place. */
  readonly rewordable?: readonly string[];
  /** What the person is talking about, by its name ("Someday"), and what they pointed at, a line each: said beside their words, never in them. */
  readonly about?: { readonly name: string; readonly lines?: readonly string[] };
  /** The acts a press may ask for on these records (`data-act`), each with its title, the argument the record goes in, and whether it marks one thing on or off. */
  readonly acts?: readonly ActToBind[];
  /** What pressing every control of the draft on the page came to, a line each — where the person said it does not work. */
  readonly pressed?: readonly string[];
}

export type DesignAgentResult = {
  /** How the turn ended: the agent said it was done, asked the person something, ran out of steps, was stopped — or two drafts in a row failed the same way (`stuck`, said plainly in `said`). */
  readonly ended: "done" | "ask" | "steps" | "stopped" | "no-model" | "stuck";
  /** Stuck: whether the last draft drew, so a person may keep it anyway. */
  readonly keepable?: boolean;
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
  '{"say": "<one short plain sentence the person reads: what you are doing or what you found>", "do": "look" | "read" | "edit" | "draft" | "done" | "ask", "edits": [{"find": "<text copied exactly from the script, there once>", "replace": "<what stands there instead>"}], "in": "page" | "draft", "source": "<the whole script>"}',
  "edits (and, if you like, in) only with edit; source only with draft.",
  "You are shown, before your first step, what the page draws now (what_the_page_draws: its headings, each record's words and the heading it sits under, how they stand) and the records your view is handed (records_it_is_handed): edit or draft first.",
  "- look: see what the page draws now again, as it stands.",
  "- read: the records and fields your view is handed, again.",
  "- edit: change the script in place. Each find is text copied exactly from your_draft_on_the_page — or, with \"in\": \"draft\", from your_last_draft — long enough to be there once; replace is what stands there instead (\"\" takes it out). The code applies them in order, then draws and checks the result exactly as it does a draft; a find that is not there once is handed back to you. For a small change — a color, a corner, a size, a word, one rule, one part — answer with an edit, never the whole script again: \"no rounded corners on the logo\" is one edit of one declaration.",
  "- draft: for a redesign, or where there is no script on the page yet, your whole script, drawn where only you see it. You are told what the checks found (records, headings, dates, statuses or groups it lost; words it shows as the computer keeps them; a style the page will not keep, by its rule) and what it drew.",
  "With an edit or a draft, \"say\" is one sentence of what it does, as the person will read it once it is on the page (\"Tasks are cards now, side by side, each with its status and date.\"). One the checks pass is shown to the person on the page, and your turn ends there.",
  "- done: you have finished this request; say in one sentence what you changed. Only once an edit or a draft passed, unless you must ask.",
  "- ask: ask the person one short question, and wait for their answer.",
  "A control that changes a record is a press bound to one of the app's acts (acts_a_press_may_ask_for): <button data-act=\"finish\" data-record=\"${task.id}\">Done</button> — the host runs the act for that record when it is pressed. A field the person types into is named for the act's argument, inside a fieldset with the press; data-prefill=\"field\" fills it with the record's own text; data-save on a field saves it as it is typed. Never a checkbox, a toggle or a button bound to nothing, and never graview.act from your own click handler: it is refused. Every control on a record the page let a person press (marking it done, opening it) is kept, bound to the same act. A press that marks a record (an act with `marks`) shows what it marked from the record's own field: a record already marked says so and offers the act that undoes it (reopen), so a person sees the press land. The code presses every control headless and tells you what each one did.",
  "Keep everything the page showed unless the person asked otherwise: every record, every heading, each record's words (its status, its dates, its counts) and its group. Fix what the checks found — with an edit where the fix is small — and keep going until one passes. Write to a person, never about code: no words like view, script, spec, host, CSS or stylesheet in what you say.",
].join("\n");

/** What one request tells the agent: the page, the conversation, the steps it took this turn and what came of each. */
export function designAgentPrompt(options: Pick<DesignAgentOptions, "part" | "manifest" | "talk" | "keep" | "markup" | "current" | "section" | "about" | "acts" | "pressed" | "rewordable"> & { readonly seen?: { readonly look: unknown; readonly read: unknown }; readonly lastDraft?: string }, steps: readonly DesignAgentStep[]): string {
  // A script is shown whole, to be quoted from exactly: one cut short is said to be.
  const whole = (script: string) => (script.length > SCRIPT_SHOWN ? `${script.slice(0, SCRIPT_SHOWN)}\n/* … the script goes on: quote only what you see */` : script);
  // A heading the person asked to reword is theirs to change, where it stands: never one they are told to keep as it was.
  const reword = asksToReword(options.talk.filter((one) => one.who === "person").map((one) => one.said).join(" "));
  const rewordable = reword ? (options.rewordable ?? []) : [];
  const keep = options.keep && rewordable.length > 0 ? { ...options.keep, headings: options.keep.headings.filter((one) => !rewordable.some((own) => own.trim().toLowerCase() === one.trim().toLowerCase())) } : options.keep;
  return JSON.stringify({
    page: options.part.name,
    view: { attach: options.manifest.attach, cardinality: options.manifest.cardinality, reads: options.manifest.reads ?? {} },
    conversation: options.talk.map((one) => ({ [one.who === "person" ? "person" : "you"]: one.said })),
    ...(options.about && options.about.name !== options.part.name ? { about: options.about.name, ...(options.about.lines?.length ? { pointed_at: options.about.lines } : {}) } : {}),
    ...(options.acts?.length ? { acts_a_press_may_ask_for: options.acts.map((one) => ({ act: one.act, title: one.title, record_goes_in: one.record, ...(one.toggle ? { marks: one.toggle } : {}) })) } : {}),
    ...(options.pressed?.length ? { the_controls_as_pressed: options.pressed, then: "The person says something does not work. This is what pressing every control of your draft found: fix what failed, with controls bound to acts." } : {}),
    ...(options.section ? { only_change: `Change only the part “${options.section}” of your_draft_on_the_page; keep every other part of the script as it is, byte for byte.` } : {}),
    ...(keep ? { ...(keep.title ? { the_page_draws_its_title: keep.title } : {}), keep_these_headings: keep.headings, records: checklistOf(keep), ...(keep.grouping ? { grouping: groupingRule(keep.grouping) } : {}) } : {}),
    ...(reword
      ? { you_may_reword: rewordable.length > 0 ? `The person asked for a heading's words to change: ${rewordable.map((one) => `“${one}”`).join(", ")} may say new words, in the same place. Keep every other heading as it was.` : "The person asked for a heading's words to change: the heading they mean may say new words, in the same place. Keep every other heading as it was." }
      : {}),
    ...(options.markup && !options.current ? { the_page_as_html: options.markup.slice(0, 5000) } : {}),
    ...(options.current ? { your_draft_on_the_page: whole(options.current) } : {}),
    // The last draft of this turn, which did not pass, whole: what an edit "in": "draft" quotes from.
    ...(options.lastDraft !== undefined && options.lastDraft !== options.current ? { your_last_draft: whole(options.lastDraft) } : {}),
    // The steps so far this turn, each with what came of it; the earlier drafts said by what came of them.
    your_steps: steps.map((one, at) => ({ said: one.said, did: one.did, ...(one.edits ? { edits: one.edits } : {}), ...(one.result !== undefined ? { result: one.result } : {}), ...(at < steps.length - 1 && (one.did === "draft" || one.did === "edit") ? { note: one.did === "edit" ? "an earlier edit" : "an earlier draft" } : {}) })),
    ...(steps.length === 0 && options.seen ? { what_the_page_draws: options.seen.look, records_it_is_handed: options.seen.read } : {}),
    next: steps.length === 0 ? (options.current ? "Edit or draft first, as one JSON object." : "Draft first, as one JSON object.") : "Your next step, as one JSON object.",
  });
}

/** One answer of the agent, read. */
export interface AgentReply {
  readonly say: string;
  readonly do: DesignAgentMove;
  /** With a draft: the whole script. */
  readonly source?: string;
  /** With an edit: its changes, in order. */
  readonly edits?: readonly ScriptEdit[];
  /** With an edit: the script it changes — the one on the page (the default) or its own last draft. */
  readonly in?: "page" | "draft";
}

/** The changes of an edit as the agent gave them: each a find with text and a replace; undefined where any is not. */
function editsOf(given: unknown): ScriptEdit[] | undefined {
  if (!Array.isArray(given) || given.length === 0) return undefined;
  const edits: ScriptEdit[] = [];
  for (const one of given as unknown[]) {
    const find = (one as { find?: unknown } | null)?.find;
    const replace = (one as { replace?: unknown } | null)?.replace;
    if (typeof find !== "string" || find.length === 0 || typeof replace !== "string") return undefined;
    edits.push({ find, replace });
  }
  return edits;
}

/** One answer of the agent read: what it said and did, with its script for a draft and its changes for an edit; undefined where it is not one. */
export function readAgentReply(text: string): AgentReply | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const move = DESIGN_AGENT_MOVES.find((one) => one === parsed["do"]);
  if (!move) return undefined;
  const say = typeof parsed["say"] === "string" ? parsed["say"].trim() : "";
  if (move === "edit") {
    const edits = editsOf(parsed["edits"]);
    const into = parsed["in"] === "draft" || parsed["in"] === "page" ? parsed["in"] : undefined;
    return edits ? { say, do: "edit", ...(into ? { in: into } : {}), edits } : undefined;
  }
  if (move !== "draft") return { say, do: move };
  const view = readPageViewReply(JSON.stringify({ source: parsed["source"], said: say }));
  return view ? { say, do: "draft", source: view.source } : undefined;
}

/**
 * A STYLE REFUSED, SAID BY ITS RULE (Roadmap f-better-ui-small-edits): which
 * rule, what of it was kept and what is not allowed — "“.home .lg” keeps
 * border-radius; image-rendering isn't allowed" — never only "styles the
 * page won't keep", which is what is said where the words name no rule.
 */
function styleSaid(finding: string): { readonly short: string; readonly still: string } {
  const rule = /^In “(.+?)”, /.exec(finding)?.[1];
  const kept = /\((.+?) (?:is|are) kept\)/.exec(finding)?.[1];
  const named = /the (?:property|function) “([^”]+)”/i.exec(finding)?.[1];
  const what = named ? (/the function/i.test(finding) ? `${named}()` : named) : /url\(\) is not allowed/.test(finding) ? "url()" : /a value of “([^”]+)”/i.test(finding) ? `that value of ${/a value of “([^”]+)”/i.exec(finding)![1]}` : undefined;
  const selector = /^The selector “([^”]+)” reaches outside/.exec(finding)?.[1];
  if (selector) return { short: `the selector “${selector}” reaches outside the page`, still: `uses the selector “${selector}”, which reaches outside the page` };
  const at = /^“(@[\w-]+)” is not allowed/.exec(finding)?.[1];
  if (at) return { short: `${at} isn't allowed`, still: `uses ${at}, which isn't allowed` };
  if (/^The stylesheet is too long/.test(finding)) return { short: "the styles are too long to keep", still: "has styles too long to keep" };
  if (!what) return { short: "styles the page won't keep", still: "uses styles the page won't keep" };
  const where = rule ? ` in “${rule}”` : "";
  return { short: rule && kept ? `“${rule}” keeps ${kept}; ${what} isn't allowed` : `${what}${where} isn't allowed`, still: `uses ${what}${where}, which isn't allowed` };
}

/** A finding said two ways: in a few words for the panel's step ("dates lost on 3 tasks"), and as what a draft still does ("loses the dates on 3 tasks"). */
function phrased(finding: string, noun: string): { readonly short: string; readonly still: string } {
  const who = (count: number) => (count === 1 ? `one of the ${noun}` : `${count} ${noun}`);
  switch (findingKind(finding)) {
    case "fact-lost": {
      const facts = /no longer says what it said: (.*?)(?: and (\d+) more)?\. Show/.exec(finding);
      const on = new Set([...(facts?.[1] ?? "").matchAll(/” on “([^”]+)”/g)].map((one) => one[1]));
      const days = [...(facts?.[1] ?? "").matchAll(/“([^”]+)” on “/g)].some((one) => /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(one[1]!));
      const count = Math.max(1, on.size + Number(facts?.[2] ?? 0));
      return { short: `${days ? "dates" : "details"} lost on ${who(count)}`, still: `loses ${days ? "the dates" : "details"} on ${who(count)}` };
    }
    case "record-lost": {
      const lost = /^It no longer shows (.*?)(?: and (\d+) more)?: show every record/.exec(finding);
      const count = Math.max(1, [...(lost?.[1] ?? "").matchAll(/“/g)].length + Number(lost?.[2] ?? 0));
      return { short: `${who(count)} missing`, still: `leaves out ${who(count)}` };
    }
    case "record-twice":
    case "record-moved":
      return { short: `${noun} in the wrong group`, still: `puts ${noun} in the wrong group` };
    case "heading-lost":
      return { short: "headings missing", still: "drops headings the page had" };
    case "section-lost": {
      const name = /^“(.*)” is not drawn any more/.exec(finding)?.[1] ?? "";
      return { short: `the part “${name}” missing`, still: `drops the part “${name}”` };
    }
    case "title-twice":
      return { short: "the title drawn twice", still: "draws the title twice" };
    case "computer-words":
      return { short: "words shown as the computer keeps them", still: "shows words as the computer keeps them" };
    case "did-not-draw":
      return { short: "it didn't draw", still: "doesn't draw" };
    case "style-refused":
      return styleSaid(finding);
    case "edit-missed": {
      if (/^There is no script to edit/.test(finding)) return { short: "nothing to edit yet", still: "has nothing to edit" };
      if (/^Your edits change nothing/.test(finding)) return { short: "the edit changes nothing", still: "changes nothing" };
      const times = /appears (\d+) times/.exec(finding)?.[1];
      return times ? { short: `an edit's text appears ${times} times`, still: `quotes text that appears ${times} times` } : { short: "an edit's text isn't in the script", still: "quotes text that isn't in the script" };
    }
    case "unstyled":
      return { short: "a part left without its style", still: "leaves a part without its style" };
    case "control":
      return { short: "a control that doesn't work", still: "has a control that doesn't work" };
    default: {
      // Said in its own words: its first sentence, as the agent was told it.
      const own = (/^(.*?[.!?])(\s|$)/.exec(finding.trim())?.[1] ?? finding.trim()).replace(/[.!?]+$/, "");
      const short = own.length > 120 ? `${own.slice(0, 119)}…` : own;
      return { short, still: `fails a check: ${short}` };
    }
  }
}

/**
 * WHAT THE CHECKS FOUND, IN A FEW WORDS for the panel: "dates lost on 3
 * tasks", "2 tasks missing", "the part “This week” missing" — each by what
 * it is (`findingKind`), and one with no name of its own in its own words,
 * never a generic "it didn't draw". The agent is told the findings whole.
 */
export function checkSaid(findings: readonly string[], noun = "records"): string {
  const unique = [...new Set(findings.map((finding) => phrased(finding, noun).short))];
  return unique.slice(0, 3).join(", ");
}

/**
 * WHERE A TURN IS STUCK, SAID PLAINLY: two drafts in a row failed the same
 * way. "I tried twice, and the new design still loses details on 3 tasks.
 * Keep it anyway, or stop?" — and, where the draft never drew, not offered
 * to keep.
 */
export function stuckSaid(finding: string, keepable: boolean, noun = "records"): string {
  return `I tried twice, and the new design still ${phrased(finding, noun).still}. ${keepable ? "Keep it anyway, or stop?" : "Say it another way, or stop?"}`;
}

/** What makes two findings the same: their kind, or the words of one with no kind of its own. */
const sameAs = (finding: string) => {
  const kind = findingKind(finding);
  return kind === "other" ? `other:${finding}` : kind;
};

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
  let drafts = 0;
  /* What the last failed draft failed on, each by what makes two findings the same. */
  let failedBefore = new Set<string>();
  const most = Math.max(2, options.steps ?? DESIGN_AGENT_STEPS);
  /* What the page draws and what the view is handed, looked at once before the first request: one request less for the person to wait on. */
  tell({ kind: "look", text: `Looking at ${options.part.name}` });
  const seen = { look: options.host.look(), read: options.host.read() };
  for (let at = 0; at < most; at++) {
    const began = Date.now();
    const asked = await unlessStopped(
      (model.stream
        ? model.stream({ system: DESIGN_AGENT_SYSTEM, prompt: designAgentPrompt({ ...options, seen, ...(last ? { lastDraft: last.source } : {}) }, steps), state: {} as never, catalog: { candidates: [] } as never }, (soFar) => tell({ kind: "streaming", text: writingSaid(soFar) }), options.signal)
        : model.think({ system: DESIGN_AGENT_SYSTEM, prompt: designAgentPrompt({ ...options, seen, ...(last ? { lastDraft: last.source } : {}) }, steps), state: {} as never, catalog: { candidates: [] } as never })
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
      steps.push({ said: "", did: "look", result: { error: "Your answer was not one JSON object with say and do (with edits for an edit, the whole script in source for a draft). Answer again." } });
      continue;
    }
    if (move.do === "look") {
      tell({ kind: "look", text: `Looking at ${options.part.name}` });
      steps.push({ said: move.say, did: "look", result: options.host.look() });
    } else if (move.do === "read") {
      tell({ kind: "read", text: `Reading what ${options.part.name} shows` });
      steps.push({ said: move.say, did: "read", result: options.host.read() });
    } else if (move.do === "draft" || move.do === "edit") {
      let source = move.source;
      const edits = move.edits ?? [];
      if (move.do === "edit") {
        tell({ kind: "edit", text: move.say ? `Changing: ${move.say.replace(/\.$/, "")}` : "Changing it" });
        // The script it edits: its own last draft where it says so, the one on the page otherwise — or its last draft where the page has none.
        const base = move.in === "draft" ? (last ? { script: last.source, where: "your last draft" } : undefined) : options.current !== undefined ? { script: options.current, where: "the script on the page" } : last ? { script: last.source, where: "your last draft" } : undefined;
        const applied = base ? applyEdits(base.script, edits, base.where) : { findings: [move.in === "draft" ? "There is no script to edit yet: you have made no draft this turn, so edit the script on the page or draft the whole script." : "There is no script to edit yet: draft the whole script."] };
        if ("findings" in applied) {
          // Nothing was drawn: said back in words, and never counted as a draft that failed.
          tell({ kind: "check", text: `Check: ${checkSaid(applied.findings, noun)} — fixing`, findings: findingsOf(applied.findings) });
          steps.push({ said: move.say, did: "edit", edits, result: { findings: applied.findings } });
          continue;
        }
        source = applied.source;
      } else tell({ kind: "draft", text: move.say ? `Drafting: ${move.say.replace(/\.$/, "")}` : "Drafting" });
      const did = move.do;
      const tried = { said: move.say, did, ...(did === "edit" ? { edits } : {}) };
      // A refused style the page's own script had too is no finding: the page draws without it now.
      const stripped = cssFindings(source!, options.current !== undefined ? { already: options.current } : {});
      // Judging that threw is said as what went wrong, to the agent and the host alike — never a draft that "didn't draw".
      const judging = () => options.host.draft(source!).catch((error: unknown) => ({ findings: [`The draft could not be judged: ${String(error instanceof Error ? error.message : error).replace(/[.\s]+$/, "")}.`], drew: undefined }));
      const drawn = stripped.length > 0 ? { findings: stripped, drew: undefined } : await unlessStopped(judging(), options.signal).then((one) => (typeof one === "string" ? undefined : one.value));
      if (!drawn) return { ended: "stopped", said: "Stopped.", ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
      last = { source: source!, findings: drawn.findings };
      drafts += 1;
      const found = findingsOf(drawn.findings);
      try {
        options.ai.onDraftChecked?.({ part: options.part.name, draft: drafts, passed: found.length === 0, findings: found });
      } catch {
        // The host's log is its own: a throw there never stops the turn.
      }
      // The same finding as the draft before: said plainly, with a choice, rather than another "— fixing".
      const again = drawn.findings.find((one) => failedBefore.has(sameAs(one)));
      failedBefore = new Set(drawn.findings.map(sameAs));
      if (again !== undefined) {
        const keepable = !drawn.findings.some((one) => findingKind(one) === "did-not-draw");
        const said = stuckSaid(again, keepable, noun);
        // The step says what failed again; the sentence and the choice are the turn's answer.
        tell({ kind: "stuck", text: `Check: ${checkSaid([again], noun)}, again`, findings: found });
        steps.push({ ...tried, result: { findings: drawn.findings, drew: drawn.drew } });
        return { ended: "stuck", said, keepable, ...(passed ? { passed } : {}), last, steps, stages };
      }
      if (drawn.findings.length === 0) {
        passed = { source: source! };
        tell({ kind: "passed", text: "Check: nothing lost — it's on the page" });
        steps.push({ ...tried, result: { findings: [], drew: drawn.drew, shown: "It passed and is on the page now." } });
        // A draft that passed ends the turn: the person sees it, and says what next.
        return { ended: "done", said: move.say || "Here it is.", passed, last, steps, stages };
      } else {
        tell({ kind: "check", text: `Check: ${checkSaid(drawn.findings, noun)} — fixing`, findings: found });
        steps.push({ ...tried, result: { findings: drawn.findings, drew: drawn.drew } });
      }
    } else if (move.do === "ask") {
      return { ended: "ask", said: move.say || "What would you like it to look like?", ...(passed ? { passed } : {}), ...(last ? { last } : {}), steps, stages };
    } else {
      if (!passed && last && last.findings.length > 0 && at < most - 2) {
        // Done is only done once a draft passed: told so once, it fixes what is left or asks.
        steps.push({ said: move.say, did: "done", result: { not_yet: "No draft has passed the checks yet. Fix what the last check found with an edit or a draft, or ask the person." } });
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
