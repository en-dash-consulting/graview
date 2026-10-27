import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRAITS } from "@graview/core/compose";
import type { Answer, Decide } from "../../src/fast.js";
import { askKinda, askStarter, AUDIENCES, FIT_LEVELS, HORIZONS, kindaQuestions, readStarter, starterQuestions, stillUnmet, type StarterTemplate } from "../../src/starter.js";

/*
 * THE STARTER'S QUESTIONS ARE DATA; THE HOST'S MODEL ANSWERS THEM. Over
 * Cloud's catalog of 22 templates, `starterQuestions` asks a Score per
 * template, a Noul per trait, and a Choice each for audience and horizon,
 * and `readStarter` ranks and reads the answers with thresholds. The model
 * here is a stub that judges by word overlap alone — deterministic, as
 * tidy's tests stub Jev — so every claim is about the questions, the state
 * they carry and the reading, not about a model's taste. A real Jev reads
 * the same state and the same questions.
 */
const CATALOG: StarterTemplate[] = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/cloud-catalog.json", import.meta.url), "utf8"));

const STOP = new Set(["the", "and", "for", "our", "with", "what", "who", "its", "each", "that", "this", "from", "one", "per", "where", "when", "which", "all", "are", "was", "not", "but", "has", "have", "they", "them", "their", "you", "your", "just", "about", "into", "than", "then", "also", "only", "any", "can", "ive", "nobody", "something", "someone", "going", "keep", "track", "want", "like", "know", "see", "sees", "say", "says", "does", "did", "need", "needs", "described", "fit", "well", "how", "should", "would", "could", "still", "kept", "whether", "against", "out", "yet", "most", "more", "much"]);
/** Words that count: lower-case, three letters or more, a trailing s dropped so "chores" meets "chore". */
const words = (text: string): Set<string> => new Set(text.toLowerCase().replace(/[’']/g, "").split(/[^a-z]+/).map((word) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word)).filter((word) => word.length >= 3 && !STOP.has(word)));
const overlap = (said: Set<string>, evidence: Set<string>) => [...said].filter((word) => evidence.has(word)).length;
const flat = (value: unknown): string => (typeof value === "string" ? value : Array.isArray(value) ? value.map(flat).join(" ") : value && typeof value === "object" ? Object.values(value).map(flat).join(" ") : "");

/**
 * A STUB SYSTEM ONE: a Score is the share of the sentence's words a
 * template's words in the state carry; a Noul the share of a question's own
 * words the sentence (and the kinda line) says; a Choice the option whose
 * words the sentence says most. Nothing else is read.
 */
const wordOverlap: Decide = async (state, questions) => {
  const { said, different, templates, template } = state as { said: string; different?: string; templates?: Record<string, unknown>[]; template?: Record<string, unknown> };
  const sentence = words(`${said} ${different ?? ""}`);
  const answers: Record<string, Answer> = {};
  const levels = (level: number): Answer => {
    const low = Math.floor(level);
    const high = Math.min(FIT_LEVELS.length - 1, low + 1);
    const probabilities: Record<string, number> = {};
    for (let at = 0; at < FIT_LEVELS.length; at++) probabilities[String(at)] = 0;
    probabilities[String(low)] = 1 - (level - low);
    probabilities[String(high)] = (probabilities[String(high)] ?? 0) + (level - low);
    return { type: "score", score: level, confidence: 0.9, probabilities, legend: {} };
  };
  for (const [key, question] of Object.entries(questions)) {
    if (question.type === "score") {
      const id = key.slice("fit:".length);
      const evidence = words(flat(templates?.find((one) => one["id"] === id) ?? template ?? {}));
      answers[key] = levels(Math.min(FIT_LEVELS.length - 1, (overlap(sentence, evidence) / Math.max(1, sentence.size)) * 8));
    } else if (question.type === "noul") {
      const part = key.startsWith("keep:") ? (template?.["parts"] as { part: string; name: string; words: string }[] | undefined)?.find((one) => key === `keep:${one.part}:${one.name}`) : undefined;
      // A need or add question is judged by what it names after "need", not by its boilerplate.
      const evidence = words(part ? `${part.name} ${part.words}` : (question.instructions.split(" need ").pop() ?? ""));
      answers[key] = { type: "noul", noul: Math.min(1, (overlap(sentence, evidence) / Math.max(1, evidence.size)) * 2) };
    } else {
      const scored = Object.entries(question.criteria).map(([option, meaning]) => [option, overlap(sentence, words(`${option} ${meaning ?? ""}`))] as const);
      const best = scored.reduce((top, one) => (one[1] > top[1] ? one : top), scored[0]!);
      const total = scored.reduce((sum, [, n]) => sum + n, 0) || 1;
      const probabilities: Record<string, number> = {};
      for (const [option, n] of scored) probabilities[option] = n / total;
      answers[key] = { type: "choice", choice: best[0], confidence: best[1] / total, probabilities };
    }
  }
  return { answers, usage: { inputTokens: 0, outputTokens: 0 } };
};

/** Thirty sentences, each written for one template of the catalog: 22 once each, and 8 second ways of asking for the ones people ask for most. */
const SENTENCES: readonly [string, string][] = [
  ["book-writing", "I'm writing a nonfiction book and want to keep the chapters, what readers should take away, and the stories I've checked"],
  ["bug-bash", "A punch list of bugs for our launch: what's broken, where, how bad, and who owns each one"],
  ["club-season", "Our netball club's season: the fixtures, the squad, and who's available for each match"],
  ["content-calendar", "A content calendar for our newsletter and social media: what's going out when and who's making it"],
  ["discography", "A fan catalog of a band's albums and songs, their eras and genres, and who wrote and produced each track"],
  ["event-run-of-show", "The run of show for our conference: what happens when, in which room, and who is running each session"],
  ["gift-exchange", "A secret santa for the office party with wishlists, where each giver sees only their own match"],
  ["hiring-loop", "Our hiring loop: candidates, their interviews, and the interview feedback nobody has written yet"],
  ["household-chores", "Who's doing which chore in our flat this week, and what's overdue"],
  ["job-search", "My job search: the applications I've sent, the people I've talked to, and the next step for each so nothing goes quiet"],
  ["league-record-book", "A record book for our karting league across its seasons: every race, who won, and who took each title"],
  ["market-map", "A sourced map of the project management software market: who makes what, what it costs, and which to pick for what"],
  ["product-roadmap", "Our product roadmap: what we're building now, next and later, the feature requests people voted for, and what shipped in each release"],
  ["reading-list", "A reading list for my thesis: the research questions, the sources behind them, and what each source claims"],
  ["renovation", "Our kitchen renovation: the rooms, the tasks, the purchases, and the trades, so nobody waits on something not yet ordered"],
  ["small-inventory", "The stock in our shop's storeroom: what we have, where it's kept, and what's running low so I know when to reorder"],
  ["team-history", "A fan's history of my football club: every era and season, the games that mattered, the legends, and the honors"],
  ["trip-planner", "A road trip itinerary day by day, with the bookings and stops, so every night has somewhere to sleep"],
  ["vendor-shortlist", "Wedding vendors to compare and book against a budget, one per category"],
  ["voter-guide", "A nonpartisan voter guide to our city council election: when it is, who's running for what, and what's on the ballot"],
  ["watch-desk", "A watchlist of security advisories and outages: what's happening, whether it's confirmed, and what to do about it"],
  ["website", "The pages of our website and the copy on them, from draft to review to live"],
  ["vendor-shortlist", "Suppliers for a conference, with quotes against what we can spend per category, and who we booked"],
  ["household-chores", "A cleaning rota for the housemates"],
  ["trip-planner", "Planning our honeymoon: a two-week holiday with hotels booked for each night"],
  ["job-search", "Keeping track of my career change: roles I've applied for, contacts at each company, and interviews coming up"],
  ["renovation", "A bathroom remodel: the building work, what we've bought, and which trades are coming when"],
  ["hiring-loop", "Recruiting for two openings: each candidate's interviews and who still owes feedback"],
  ["product-roadmap", "A changelog and release notes for our startup's app, with the requests users ask for most"],
  ["gift-exchange", "Kris kringle for the family at Christmas: names in the hat and a draw so nobody sees who has them"],
];

describe("the starter's questions", () => {
  it("asks a Score per template, a Noul per trait, and a Choice each for audience and horizon, over the catalog in words", () => {
    const { state, questions } = starterQuestions("Wedding vendors against a budget", CATALOG);
    expect(SENTENCES).toHaveLength(30);
    expect(CATALOG).toHaveLength(22);
    const keys = Object.keys(questions);
    expect(keys.filter((key) => key.startsWith("fit:"))).toHaveLength(22);
    expect(keys.filter((key) => key.startsWith("need:"))).toHaveLength(TRAITS.length);
    expect(questions["fit:vendor-shortlist"]).toMatchObject({ type: "score", criteria: FIT_LEVELS });
    expect(questions["fit:vendor-shortlist"]!.instructions).toMatch(/Vendor shortlist/);
    expect(questions["need:budget"]).toMatchObject({ type: "noul", instructions: expect.stringMatching(/money against a budget/) });
    expect(questions["audience"]).toMatchObject({ type: "choice", criteria: AUDIENCES });
    expect(questions["horizon"]).toMatchObject({ type: "choice", criteria: HORIZONS });
    // The catalog in words: id, title, pitch, what it is for, what it keeps, and what it is made of — read off its declaration, never a tag.
    const templates = (state as { templates: Record<string, unknown>[] }).templates;
    expect(templates).toHaveLength(22);
    expect(templates.find((one) => one["id"] === "vendor-shortlist")).toMatchObject({ title: "Vendor shortlist", keeps: ["categories", "vendors"], "made of": expect.arrayContaining([expect.stringMatching(/budget/)]) });
    expect(state).toMatchObject({ said: "Wedding vendors against a budget" });
    // No question carries a key the reading cannot say back.
    for (const key of keys) expect(key).toMatch(/^(fit:[a-z0-9-]+|need:[a-z]+|audience|horizon)$/);
  });

  it("ranks the right template in the top three for each of thirty sentences, with a model that judges by word overlap alone", async () => {
    const missed: string[] = [];
    for (const [wanted, said] of SENTENCES) {
      const { reading } = await askStarter(said, CATALOG, wordOverlap);
      const top = reading.ranked.slice(0, 3).map((one) => one.id);
      if (!top.includes(wanted)) missed.push(`"${said}" wanted ${wanted}, got ${top.join(", ")}`);
    }
    expect(missed).toEqual([]);
  });

  it("reads the answers with thresholds, and the same answers again with others: nothing is lost in the reading", async () => {
    const { answers, reading } = await askStarter("Wedding vendors to compare and book against a budget, one per category", CATALOG, wordOverlap);
    expect(reading.turn).toBe("starter");
    expect(reading.ranked[0]).toMatchObject({ id: "vendor-shortlist", shown: true });
    expect(reading.ranked[0]!.fit).toBeGreaterThan(reading.ranked[1]!.fit);
    expect(reading.top.length).toBeLessThanOrEqual(3);
    expect(reading.top[0]).toBe("vendor-shortlist");
    expect(reading.traits).toContain("budget");
    expect(reading.needs["budget"]).toBeGreaterThanOrEqual(0.7);
    // Every template is ranked, shown or not, so a host can show the next on "No".
    expect(reading.ranked.map((one) => one.id).sort()).toEqual(CATALOG.map((one) => one.id).sort());
    // Re-read, stricter: fewer shown, no second call.
    const strict = readStarter(answers, { show: 4, top: 1 });
    expect(strict.turn).toBe("starter");
    if (strict.turn === "starter") {
      expect(strict.top.length).toBeLessThanOrEqual(1);
      expect(strict.ranked.filter((one) => one.shown).every((one) => one.level >= 4)).toBe(true);
    }
  });

  it("says what a refused template leaves unmet: the traits the sentence needs that it lacks", async () => {
    const { reading } = await askStarter("Things with a status, people who own them, due dates, and a budget", CATALOG, wordOverlap);
    expect(reading.traits).toEqual(expect.arrayContaining(["status", "owners", "schedule", "budget"]));
    const vendors = CATALOG.find((one) => one.id === "vendor-shortlist")!;
    const chores = CATALOG.find((one) => one.id === "household-chores")!;
    // The vendor shortlist has a status, dates and a budget; nobody owns a vendor.
    expect(stillUnmet(reading, vendors)).toContain("owners");
    expect(stillUnmet(reading, vendors)).not.toContain("budget");
    // Chores are owned; nothing there is a budget.
    expect(stillUnmet(reading, chores)).toContain("budget");
    expect(stillUnmet(reading, chores)).not.toContain("owners");
  });

  it("reads audience and horizon as choices, with how sure and by how much", async () => {
    const { reading } = await askStarter("A routine for the whole family's household chores, week after week", CATALOG, wordOverlap);
    expect(reading.audience).toMatchObject({ choice: "household" });
    expect(reading.horizon).toMatchObject({ choice: "kept_going" });
    expect(reading.audience!.confidence).toBeGreaterThan(0);
    expect(reading.audience!.margin).toBeGreaterThanOrEqual(0);
  });
});

describe("the kinda turn", () => {
  const vendors = CATALOG.find((one) => one.id === "vendor-shortlist")!;

  it("asks keep? per kind, rule and lens of the template, and add? per trait it lacks, over the sentence and the line", () => {
    const { state, questions } = kindaQuestions("Suppliers for our team offsite against a budget", vendors, "It's a team offsite, not a wedding, and people own each category");
    const keys = Object.keys(questions);
    expect(keys.filter((key) => key.startsWith("keep:kind:"))).toEqual(["keep:kind:vendor", "keep:kind:category"].sort((a, b) => (keys.indexOf(a) - keys.indexOf(b))));
    expect(keys).toContain("keep:rule:within-budget");
    expect(keys).toContain("keep:lens:Vendors by status");
    // The vendor shortlist already has a status, dates, a budget and a comparison: those are not offered to add.
    expect(keys.filter((key) => key.startsWith("add:")).sort()).toEqual(TRAITS.filter((trait) => !["status", "schedule", "budget", "comparison"].includes(trait)).map((trait) => `add:${trait}`).sort());
    expect(questions["keep:kind:vendor"]).toMatchObject({ type: "noul", instructions: expect.stringMatching(/vendors/i) });
    expect(questions["add:owners"]).toMatchObject({ type: "noul", instructions: expect.stringMatching(/people who own things/) });
    expect(state).toMatchObject({ said: "Suppliers for our team offsite against a budget", different: "It's a team offsite, not a wedding, and people own each category", template: { id: "vendor-shortlist" } });
    const parts = (state as { template: { parts: { part: string; name: string; words: string }[] } }).template.parts;
    expect(parts.find((one) => one.part === "kind" && one.name === "vendor")?.words).toMatch(/A business we might hire/);
    expect(parts.find((one) => one.part === "rule" && one.name === "within-budget")?.words).toMatch(/budget/);
  });

  it("reads keep, drop and add from the answers, with thresholds a host may move", () => {
    const { questions } = kindaQuestions("Suppliers for our team offsite against a budget", vendors, "It's a team offsite, not a wedding, and people own each category");
    const answers: Record<string, Answer> = {};
    for (const key of Object.keys(questions)) answers[key] = { type: "noul", noul: key === "keep:kind:vendor" ? 0.95 : key === "keep:kind:category" ? 0.8 : key === "keep:lens:Deadlines" ? 0.2 : key === "add:owners" ? 0.85 : key === "add:places" ? 0.4 : key.startsWith("keep:") ? 0.6 : 0.1 };
    const reading = readStarter(answers);
    expect(reading.turn).toBe("kinda");
    if (reading.turn !== "kinda") return;
    expect(reading.keep).toContainEqual({ part: "kind", name: "vendor" });
    expect(reading.keep).toContainEqual({ part: "kind", name: "category" });
    expect(reading.drop).toEqual([{ part: "lens", name: "Deadlines" }]);
    expect(reading.add).toEqual(["owners"]);
    expect(reading.parts.find((one) => one.name === "vendor")?.keep).toBe(0.95);
    expect(reading.needs["places"]).toBe(0.4);
    // Stricter on keeping, looser on adding: the same answers read again.
    const moved = readStarter(answers, { keep: 0.7, add: 0.3 });
    if (moved.turn !== "kinda") return;
    expect(moved.keep.map((one) => one.name).sort()).toEqual(["category", "vendor"]);
    expect([...moved.add].sort()).toEqual(["owners", "places"]);
  });

  it("runs the turn through the host's decide, as the first turn does", async () => {
    const { reading, answers } = await askKinda("Suppliers for our team offsite against a budget", vendors, "It's a team offsite, not a wedding, and people own each category", wordOverlap);
    expect(reading.turn).toBe("kinda");
    expect(Object.keys(answers).length).toBeGreaterThan(TRAITS.length);
    if (reading.turn === "kinda") expect(reading.add).toContain("owners");
  });

  it("asks nothing of a question set it does not know", () => {
    expect(() => readStarter({ "what:is:this": { type: "noul", noul: 1 } })).toThrow(/what:is:this/);
    expect(() => readStarter({})).toThrow(/no answers/);
  });
});
