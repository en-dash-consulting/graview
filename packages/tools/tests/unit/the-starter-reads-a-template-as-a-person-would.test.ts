import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { startingDocument } from "@graview/core/compose";
import type { Answer } from "../../src/fast.js";
import { kindaQuestions, readmeExcerpt, readStarter, starterQuestions, stillUnmet, type KindaReading, type StarterReading, type StarterTemplate } from "../../src/starter.js";

/*
 * THE STARTER READS A TEMPLATE AS A PERSON WOULD, AND SAYS ITS READING
 * WHOLE. A README goes to the model from its first plain sentence with no
 * markdown in it; a fit's level is the expected level rounded once, not
 * the rounded score scaled; `stillUnmet` takes the traits themselves as
 * well as a reading; and a kinda reading's dropped parts — rules and views
 * among them — go straight into `startingDocument`'s `drop`.
 */
const CATALOG: StarterTemplate[] = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/cloud-catalog.json", import.meta.url), "utf8"));
const shortlist = CATALOG.find((one) => one.id === "vendor-shortlist")!;

const README = [
  "# Vendor shortlist",
  "",
  "[![Made with Graview](https://graview.dev/badge.svg)](https://graview.dev)",
  "",
  "## What it is",
  "",
  "Keep the **vendors** you are weighing for an event in one place: their [quotes](https://example.com/quotes), their `status` and _which one_ you booked.",
  "",
  "- One booked per category",
  "- A booked vendor has a quote",
  "",
  "```json",
  "{ \"op\": \"add-kind\" }",
  "```",
  "",
  "| Kind | Says |",
  "| --- | --- |",
  "| vendor | who |",
].join("\n");

describe("a README goes to the model from its first plain sentence, with no markdown", () => {
  it("starts at the first sentence and keeps the words of links, emphasis and code", () => {
    const about = readmeExcerpt(README);
    expect(about.startsWith("Keep the vendors you are weighing for an event in one place: their quotes, their status and which one you booked.")).toBe(true);
    expect(about).not.toMatch(/[#*`|[\]]|\]\(|```|https?:/);
    expect(about).toContain("One booked per category");
  });

  it("is what the first turn's state says of the template", () => {
    const { state } = starterQuestions("vendors for our wedding", [{ ...shortlist, readme: README }]);
    const [template] = (state as { templates: Record<string, unknown>[] }).templates;
    expect(template!["about"]).toBe(readmeExcerpt(README));
  });

  it("is cut at a word, within its length, with an ellipsis", () => {
    const long = `# Title\n\n${"A sentence of plain words about the thing. ".repeat(20)}`;
    const about = readmeExcerpt(long);
    expect(about.length).toBeLessThanOrEqual(281);
    expect(about.endsWith("…")).toBe(true);
    expect(about).not.toMatch(/\s…$/);
  });
});

describe("a fit's level is the expected level, rounded once", () => {
  it("says 3.1 as 3.1, not on the score's 0.04 steps", () => {
    const answer: Answer = { type: "score", score: 3, confidence: 0.9, probabilities: { "3": 0.9, "4": 0.1 }, legend: {} };
    const reading = readStarter({ "fit:vendor-shortlist": answer }) as StarterReading;
    expect(reading.ranked[0]!.level).toBe(3.1);
    expect(reading.ranked[0]!.fit).toBe(0.78);
  });
});

describe("stillUnmet takes the traits themselves", () => {
  it("says the same of a reading and of its traits", () => {
    const reading = { turn: "starter", ranked: [], top: [], traits: ["owners", "budget"], needs: {} } as StarterReading;
    expect(stillUnmet(["owners", "budget"], shortlist)).toEqual(stillUnmet(reading, shortlist));
    expect(stillUnmet(["owners", "budget"], shortlist)).toEqual(["owners"]);
  });
});

describe("a kinda reading's dropped parts go straight into startingDocument", () => {
  it("drops the kind, the rule and the view the reading drops, each said in left", () => {
    const { questions } = kindaQuestions("vendors for our wedding", shortlist, "no deadlines, and no quote rule");
    const answers: Record<string, Answer> = {};
    for (const key of Object.keys(questions)) {
      if (key.startsWith("keep:")) answers[key] = { type: "noul", noul: key === "keep:rule:booked-needs-quote" || key === "keep:lens:Deadlines" ? 0.1 : 0.9, confidence: 0.9 } as Answer;
    }
    const reading = readStarter(answers) as KindaReading;
    expect(reading.drop).toEqual([
      { part: "rule", name: "booked-needs-quote" },
      { part: "lens", name: "Deadlines" },
    ]);
    const made = startingDocument({ base: shortlist.document, name: "Our vendors", drop: reading.drop, add: reading.add });
    expect(made.left.map((part) => `${part.what}:${part.part}`)).toEqual(["rule:booked-needs-quote", "lens:Deadlines"]);
    expect(made.document.rules?.["booked-needs-quote"]).toBeUndefined();
  });
});
