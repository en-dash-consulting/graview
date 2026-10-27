import type { GraviewDocument } from "@graview/core/document";
import { TRAITS, TRAIT_WORDS, traitsOf, type TraitName } from "@graview/core/compose";
import type { Answer, Decide } from "./fast.js";
import type { Question } from "./questions.js";
import { choiceOf, noulOf, scoreOf } from "./tidy/system-one.js";

/*
 * `@graview/tools/starter` — THE STARTER'S QUESTIONS AS DATA (Roadmap
 * f-starter-judgments; Cloud's design docs/design/starter.md).
 *
 * A person types what they want to keep track of; a box answers with the
 * templates that fit, and on "kinda" asks which of a template's parts to
 * keep and which traits to add. Code owns the catalog, the parts and the
 * composing (`traitsOf` and the starting document composed from parts, on
 * `@graview/core/compose`);
 * a System One model supplies the common sense of matching words to
 * structure. So the questions are data of the Fast slot's shape — a Score,
 * a Noul, a Choice — over one state, answered in one request by whatever
 * `decide` the host passes (Jev, as `dream` takes one; a stub in a test),
 * and read back by code with thresholds a host may move without asking
 * again. Nothing here is a prose prompt, and nothing here names a vendor.
 *
 * Its own entry, on no page: a host asks it from a server or a terminal.
 */

/** A template as the starter reads it: Cloud's `GraviewTemplate` satisfies it; so does any document with a title and a pitch. */
export interface StarterTemplate {
  readonly id: string;
  readonly title: string;
  readonly pitch: string;
  readonly useCases?: readonly string[];
  /** A longer word on it; the first 280 characters go to the model. */
  readonly readme?: string;
  readonly document: GraviewDocument;
}

/** How well a template fits, in five self-contained levels, read as 0 to 4. */
export const FIT_LEVELS = [
  "A different job: none of what they described.",
  "Touches it: shares a part with what they described, but is for something else.",
  "Covers part of what they described.",
  "Close: most of what they described, with a part missing or named differently.",
  "Exactly this: what they described, as they described it.",
] as const;

/** Who will use it, as a Choice's criteria. */
export const AUDIENCES = {
  just_me: "One person, for themselves.",
  household: "A household: a family, a couple, flatmates.",
  team: "A team: colleagues, a club, a committee, a company.",
  public: "The public, reading it: a guide, a map, a record book other people look up.",
} as const;
export type Audience = keyof typeof AUDIENCES;

/** Whether it ends, as a Choice's criteria. */
export const HORIZONS = {
  one_off: "A one-off: a project, an event, a trip, a search, a season — it ends.",
  kept_going: "Kept going: a routine, a catalog, a watch, a roster, a record book — it never ends.",
} as const;
export type Horizon = keyof typeof HORIZONS;

/** One request: the state the model reads and the typed questions over it, keyed so `readStarter` can say each answer back. */
export interface StarterAsk {
  readonly state: Readonly<Record<string, unknown>>;
  readonly questions: Readonly<Record<string, Question>>;
}

/** How the answers are read. Each is what Cloud's starter reads at when unsaid. */
export interface StarterThresholds {
  /** A template is shown at this fit level or above (0 to 4). 2, "covers part of what they described", when unsaid. */
  readonly show?: number;
  /** At most this many templates shown, best first. 3 when unsaid. */
  readonly top?: number;
  /** A trait is needed at this Noul or above. 0.7 when unsaid. */
  readonly need?: number;
  /** A part is kept at this Noul or above. 0.5 when unsaid. */
  readonly keep?: number;
  /** A trait the template lacks is added at this Noul or above. 0.7 when unsaid. */
  readonly add?: number;
}
const DEFAULTS: Required<StarterThresholds> = { show: 2, top: 3, need: 0.7, keep: 0.5, add: 0.7 };

/** One template ranked: its expected fit level (0 to 4), the same as 0 to 1, and whether it clears the floor. */
export interface StarterRanked {
  readonly id: string;
  readonly level: number;
  readonly fit: number;
  readonly shown: boolean;
}
/** A choice read: what was chosen, how sure, and the margin over the next. */
export interface StarterChoice<Option extends string> {
  readonly choice: Option;
  readonly confidence: number;
  readonly margin: number;
}
/** The first turn read: every template ranked, the ones to show, the traits needed, who and how long. */
export interface StarterReading {
  readonly turn: "starter";
  /** Every template of the catalog, best first — so "No" can show the next without asking again. */
  readonly ranked: readonly StarterRanked[];
  /** The ids to show: at most `top`, each at `show` or above. */
  readonly top: readonly string[];
  /** The traits what they described needs, in `TRAITS` order. */
  readonly traits: readonly TraitName[];
  /** Every trait's Noul, so the threshold can move later. */
  readonly needs: Readonly<Partial<Record<TraitName, number>>>;
  readonly audience?: StarterChoice<Audience>;
  readonly horizon?: StarterChoice<Horizon>;
}

/** One part of a template a kinda turn asks about: a kind, a rule or a lens, by name (a lens by its title). */
export interface StarterPart {
  readonly part: "kind" | "rule" | "lens";
  readonly name: string;
}
/** The kinda turn read: which parts stay, which go, which traits come. */
export interface KindaReading {
  readonly turn: "kinda";
  readonly keep: readonly StarterPart[];
  readonly drop: readonly StarterPart[];
  /** The traits to add, in `TRAITS` order. */
  readonly add: readonly TraitName[];
  /** Every part with its Noul, as asked. */
  readonly parts: readonly (StarterPart & { readonly keep: number })[];
  /** Every missing trait's Noul. */
  readonly needs: Readonly<Partial<Record<TraitName, number>>>;
}

const README_EXCERPT = 280;
const lower = (value: string) => value.toLowerCase();
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const pluralOf = (kind: string, spec: GraviewDocument["kinds"][string]) => lower(spec.plural ?? `${spec.noun ?? kind.replace(/-/g, " ")}s`);
type Lens = { readonly name?: unknown; readonly title?: unknown };
const lensesOf = (document: GraviewDocument): { name: string; title: string }[] =>
  (Array.isArray(document.lenses) ? (document.lenses as Lens[]) : []).flatMap((lens) => (typeof lens.title === "string" ? [{ name: typeof lens.name === "string" ? lens.name : "lens", title: lens.title }] : []));

/** A template in words, as the model reads it: nothing it could not have told a person. */
function templateState(template: StarterTemplate): Record<string, unknown> {
  const document = template.document;
  return {
    id: template.id,
    title: template.title,
    pitch: template.pitch,
    ...(template.useCases && template.useCases.length > 0 ? { for: template.useCases } : {}),
    keeps: Object.entries(document.kinds ?? {}).map(([kind, spec]) => pluralOf(kind, spec)),
    "made of": traitsOf(document).map((trait) => trait.said),
    ...(template.readme ? { about: template.readme.length > README_EXCERPT ? `${template.readme.slice(0, README_EXCERPT).trimEnd()}…` : template.readme } : {}),
  };
}

const needQuestion = (trait: TraitName, of: string): Question => ({
  type: "noul",
  instructions: `Does ${of} need ${TRAIT_WORDS[trait]}?`,
  criteria: { true: `It needs ${TRAIT_WORDS[trait]}: they said so, or what they said cannot be kept without it.`, false: `Not said, and not needed to keep what they said.` },
});

/**
 * THE FIRST TURN, one request: how well each template of the catalog fits
 * what they said (a Score per template, `fit:<id>`), whether what they said
 * needs each trait of the vocabulary (a Noul per trait, `need:<trait>`),
 * who will use it (`audience`) and whether it ends (`horizon`). The state
 * is what they said and the catalog in words — each template's id, title,
 * pitch, what it is for, what it keeps and what it is made of, the last
 * read off its declaration by `traitsOf`.
 */
export function starterQuestions(said: string, catalog: readonly StarterTemplate[]): StarterAsk {
  const questions: Record<string, Question> = {};
  for (const template of catalog) {
    questions[`fit:${template.id}`] = {
      type: "score",
      instructions: `How well does the template "${template.title}" (${template.pitch}) fit what they described? Judge by what it keeps and what it is made of, not by its name.`,
      criteria: FIT_LEVELS,
    };
  }
  for (const trait of TRAITS) questions[`need:${trait}`] = needQuestion(trait, "what they described");
  questions["audience"] = { type: "choice", instructions: "Who will use what they described?", criteria: AUDIENCES };
  questions["horizon"] = { type: "choice", instructions: "Is what they described a one-off, or something kept going?", criteria: HORIZONS };
  return { state: { said, templates: catalog.map(templateState) }, questions };
}

/** A template's parts as a kinda turn offers them: its kinds, rules and lenses, each in words. */
export function partsOf(template: StarterTemplate): (StarterPart & { readonly words: string })[] {
  const document = template.document;
  const parts: (StarterPart & { readonly words: string })[] = [];
  for (const [kind, spec] of Object.entries(document.kinds ?? {})) {
    parts.push({ part: "kind", name: kind, words: `${capital(pluralOf(kind, spec))}${spec.description ? `: ${spec.description}` : ""}` });
  }
  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    const title = typeof rule.title === "string" ? rule.title : name.replace(/-/g, " ");
    parts.push({ part: "rule", name, words: `The rule "${title}"${rule.description ? `: ${rule.description}` : ""}` });
  }
  for (const lens of lensesOf(document)) parts.push({ part: "lens", name: lens.title, words: `The view "${lens.title}" (a ${lens.name})` });
  return parts;
}

/**
 * THE KINDA TURN, one request: keep each part of this template — a kind, a
 * rule, a lens (`keep:<part>:<name>`) — and add each trait it lacks
 * (`add:<trait>`), given what they said and what is different. The state
 * adds the template's parts in words and the line they typed.
 */
export function kindaQuestions(said: string, template: StarterTemplate, reply: string): StarterAsk {
  const parts = partsOf(template);
  const has = new Set(traitsOf(template.document).map((trait) => trait.trait));
  const questions: Record<string, Question> = {};
  for (const part of parts) {
    questions[`keep:${part.part}:${part.name}`] = {
      type: "noul",
      instructions: `Should the app keep ${part.words} — given what they described, and what they said is different?`,
      criteria: { true: "Keep it: it serves what they described.", false: "Drop it: what they said is different leaves it no use." },
    };
  }
  for (const trait of TRAITS) if (!has.has(trait)) questions[`add:${trait}`] = needQuestion(trait, `what they said is different, which the template "${template.title}" lacks,`);
  return {
    state: { said, different: reply, template: { ...templateState(template), parts, lacks: TRAITS.filter((trait) => !has.has(trait)).map((trait) => TRAIT_WORDS[trait]) } },
    questions,
  };
}

const PART_KEY = /^keep:(kind|rule|lens):(.+)$/s;
const isTrait = (name: string): name is TraitName => (TRAITS as readonly string[]).includes(name);
const byTraitOrder = (a: TraitName, b: TraitName) => TRAITS.indexOf(a) - TRAITS.indexOf(b);

/**
 * THE ANSWERS READ WITH THRESHOLDS. Which turn they answer is said by their
 * keys: `fit:`, `need:`, `audience` and `horizon` are the first turn,
 * `keep:` and `add:` the kinda turn. Every raw answer is kept in what comes
 * back (`ranked`, `needs`, `parts`), so a host that keeps the answers can
 * read them again under other thresholds without asking the model again.
 * An answer under a key no turn asks is refused rather than dropped.
 */
export function readStarter(answers: Readonly<Record<string, Answer>>, thresholds: StarterThresholds = {}): StarterReading | KindaReading {
  const at = { ...DEFAULTS, ...thresholds };
  const keys = Object.keys(answers);
  if (keys.length === 0) throw new Error("readStarter was handed no answers.");
  const strange = keys.filter((key) => !/^(fit:|need:|keep:(kind|rule|lens):|add:)/.test(key) && key !== "audience" && key !== "horizon");
  if (strange.length > 0) throw new Error(`readStarter does not know the question ${strange.map((key) => `"${key}"`).join(", ")}: it reads fit:<template>, need:<trait>, audience and horizon, or keep:<part>:<name> and add:<trait>.`);
  const kinda = keys.some((key) => key.startsWith("keep:") || key.startsWith("add:"));
  if (kinda) {
    const parts: (StarterPart & { readonly keep: number })[] = [];
    const needs: Partial<Record<TraitName, number>> = {};
    for (const [key, answer] of Object.entries(answers)) {
      const part = PART_KEY.exec(key);
      if (part) {
        parts.push({ part: part[1] as StarterPart["part"], name: part[2]!, keep: noulOf(answer) ?? 0 });
        continue;
      }
      const trait = key.slice("add:".length);
      if (key.startsWith("add:") && isTrait(trait)) needs[trait] = noulOf(answer) ?? 0;
    }
    const said = ({ part, name }: StarterPart): StarterPart => ({ part, name });
    return {
      turn: "kinda",
      keep: parts.filter((one) => one.keep >= at.keep).map(said),
      drop: parts.filter((one) => one.keep < at.keep).map(said),
      add: (Object.keys(needs) as TraitName[]).filter((trait) => needs[trait]! >= at.add).sort(byTraitOrder),
      parts,
      needs,
    };
  }
  const ranked: StarterRanked[] = [];
  const needs: Partial<Record<TraitName, number>> = {};
  for (const [key, answer] of Object.entries(answers)) {
    if (key.startsWith("fit:")) {
      const fit = scoreOf(answer, FIT_LEVELS.length) ?? 0;
      const level = Math.round(fit * (FIT_LEVELS.length - 1) * 100) / 100;
      ranked.push({ id: key.slice("fit:".length), level, fit, shown: level >= at.show });
    } else if (key.startsWith("need:")) {
      const trait = key.slice("need:".length);
      if (isTrait(trait)) needs[trait] = noulOf(answer) ?? 0;
    }
  }
  ranked.sort((a, b) => b.fit - a.fit || a.id.localeCompare(b.id));
  const audience = choiceOf(answers["audience"]);
  const horizon = choiceOf(answers["horizon"]);
  return {
    turn: "starter",
    ranked,
    top: ranked.filter((one) => one.shown).slice(0, at.top).map((one) => one.id),
    traits: (Object.keys(needs) as TraitName[]).filter((trait) => needs[trait]! >= at.need).sort(byTraitOrder),
    needs,
    ...(audience && audience.choice in AUDIENCES ? { audience: audience as StarterChoice<Audience> } : {}),
    ...(horizon && horizon.choice in HORIZONS ? { horizon: horizon as StarterChoice<Horizon> } : {}),
  };
}

/** What a template refused leaves unmet: the traits the reading says they need that the template's declaration lacks — what "No" says before it shows the next. */
export function stillUnmet(reading: StarterReading, template: StarterTemplate): TraitName[] {
  const has = new Set(traitsOf(template.document).map((trait) => trait.trait));
  return reading.traits.filter((trait) => !has.has(trait));
}

/** A turn run through the host's model: the reading, the raw answers to keep, and what the call cost. */
export interface StarterTurn<Reading> {
  readonly reading: Reading;
  readonly answers: Readonly<Record<string, Answer>>;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

/** The first turn, asked and read: `starterQuestions`, the host's `decide`, `readStarter`. */
export async function askStarter(said: string, catalog: readonly StarterTemplate[], decide: Decide, thresholds: StarterThresholds = {}): Promise<StarterTurn<StarterReading>> {
  const { state, questions } = starterQuestions(said, catalog);
  const { answers, usage } = await decide(state, questions);
  const reading = readStarter(answers, thresholds);
  if (reading.turn !== "starter") throw new Error("The model answered the first turn with a kinda turn's keys.");
  return { reading, answers, usage };
}

/** The kinda turn, asked and read: `kindaQuestions`, the host's `decide`, `readStarter`. */
export async function askKinda(said: string, template: StarterTemplate, reply: string, decide: Decide, thresholds: StarterThresholds = {}): Promise<StarterTurn<KindaReading>> {
  const { state, questions } = kindaQuestions(said, template, reply);
  const { answers, usage } = await decide(state, questions);
  const reading = readStarter(answers, thresholds);
  if (reading.turn !== "kinda") throw new Error("The model answered the kinda turn with the first turn's keys.");
  return { reading, answers, usage };
}
