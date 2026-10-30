import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HostAi, ThinkingProvider } from "../../src/ai.js";
import { composeSection, locateSection, readSectionReply, reviseSection, sectionPrompt } from "../../src/section.js";

/*
 * MAKE THIS SECTION BETTER (Roadmap f-make-this-section-better). A section
 * of a worker view is found in its script by the name the menu said — a
 * landmark by its label, what labels it or its heading, else a heading's
 * block — with the rules that style only it; a revision replaces exactly
 * those, and every other byte of the script stays as it was. The light
 * model asks first, the full one where its answer cannot be read; what the
 * page's judgment finds is handed back once, then refused in words.
 */
const before = readFileSync(new URL("../../../guest/tests/fixtures/revisions/home-before.js", import.meta.url), "utf8");

const WEEK = {
  markup: `<section class="hf-week" aria-labelledby="wk"><h2 id="wk">This week</h2>
      <ol class="hf-days">\${days.map((day) => graview.html\`<li class="hf-wk-day js-pick" data-key="\${day}"><h3>\${day}</h3></li>\`)}</ol>
    </section>`,
  css: `.hf-week { display: grid; gap: 12px; }
  .hf-days { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
  .hf-wk-day { border-radius: var(--graview-radius); padding: 8px; background: var(--graview-panel); }
  .hf-wk-day h3 { font-size: 13px; margin: 0; }`,
  said: "Laid the days out as a list that wraps on a phone.",
};

const slot = (model: string, answers: string[], heard: string[] = []): ThinkingProvider => ({
  model,
  think: async ({ prompt }) => {
    heard.push(prompt);
    return { text: answers.shift() ?? "", usage: { inputTokens: 10, outputTokens: 5 } };
  },
});

describe("a section of a view, found in its script", () => {
  it("is the landmark its label's words name, with the rules that style only it", () => {
    const found = locateSection(before, "This week")!;
    expect(found.markup.text.startsWith('<section class="hf-week" aria-labelledby="wk">')).toBe(true);
    expect(found.markup.text.endsWith("</section>")).toBe(true);
    expect(found.rules.map((rule) => rule.selector)).toEqual([".hf-week", ".hf-wk-day", ".hf-wk-day h3"]);
    expect(found.shared).toEqual([]);
    expect(locateSection(before, "dinner")!.rules.map((rule) => rule.selector)).toEqual([".hf-dinner"]);
  });

  it("is a heading's block where no landmark is named so", () => {
    const script = "graview.render(graview.html`<div><h2>Soon</h2><p class='a'>x</p><p>y</p><h2>Later</h2><p>z</p></div>`);";
    const found = locateSection(script, "Soon")!;
    expect(found.markup.text).toBe("<h2>Soon</h2><p class='a'>x</p><p>y</p>");
  });

  it("is nothing where the script draws no section of that name", () => {
    expect(locateSection(before, "Breakfast")).toBeUndefined();
  });
});

describe("a section's revision, composed whole", () => {
  it("replaces the section and its own rules, and keeps every other byte as it was", () => {
    const found = locateSection(before, "This week")!;
    const after = composeSection(before, found, WEEK);
    expect(after.slice(0, found.rules[0]!.start)).toBe(before.slice(0, found.rules[0]!.start));
    const tail = before.slice(found.markup.end);
    expect(after.endsWith(tail)).toBe(true);
    expect(after).toContain('<ol class="hf-days">');
    expect(after).toContain(".hf-days { display: grid;");
    // The rules of the rest — the greeting's and Dinner's — are untouched.
    expect(after).toContain("  .hf-hello { font-size: 28px; color: var(--graview-ink); }");
    expect(after).toContain("  .hf-dinner { padding: 16px; }");
    expect(after.match(/\.hf-wk-day h3/g)).toHaveLength(1);
  });

  it("adds a stylesheet of its own to a script that had none", () => {
    const script = "graview.render(graview.html`<section aria-label=\"Box\">x</section>`);";
    const after = composeSection(script, locateSection(script, "Box")!, { markup: '<section aria-label="Box" class="b">y</section>', css: ".b { color: var(--graview-ink); }" });
    expect(after).toBe('graview.style(`\n.b { color: var(--graview-ink); }\n`);\ngraview.render(graview.html`<section aria-label="Box" class="b">y</section>`);');
  });
});

describe("the model's answer", () => {
  it("is read from JSON, fenced or not, and nothing else", () => {
    expect(readSectionReply('```json\n{"markup":"<section>a</section>","css":"","said":"Done."}\n```')).toEqual({ markup: "<section>a</section>", css: "", said: "Done." });
    expect(readSectionReply("I made it better!")).toBeUndefined();
    expect(readSectionReply('{"markup":"no tags"}')).toBeUndefined();
  });

  it("is asked with the section, its rules, the person's words and what they pointed at", () => {
    const prompt = JSON.parse(sectionPrompt({ located: locateSection(before, "This week")!, mode: "highlight", words: "make them columns", highlighted: ["the seven day blocks"] }));
    expect(prompt.section).toBe("This week");
    expect(prompt.asked).toBe("make them columns");
    expect(prompt.pointed_at).toEqual(["the seven day blocks"]);
    expect(prompt.rules).toHaveLength(3);
  });
});

describe("revising a section", () => {
  it("asks the light model, and offers what the page's judgment passes", async () => {
    const heard: string[] = [];
    const ai: HostAi = { light: slot("light", [JSON.stringify(WEEK)], heard), thinking: slot("full", []) };
    const result = await reviseSection({ ai, source: before, section: "This week", mode: "just", judge: async () => [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.said).toBe(WEEK.said);
    expect(result.repaired).toBe(false);
    expect(result.stages.map((one) => one.stage)).toEqual(["light"]);
    expect(heard).toHaveLength(1);
  });

  it("asks the full model where the light one's answer cannot be read", async () => {
    const ai: HostAi = { light: slot("light", ["Sure! Here you go."]), thinking: slot("full", [JSON.stringify(WEEK)]) };
    const result = await reviseSection({ ai, source: before, section: "This week", mode: "just", judge: async () => [] });
    expect(result.ok && result.stages.map((one) => one.stage)).toEqual(["light", "thinking"]);
  });

  it("hands what broke back once, with the findings, and offers the repair", async () => {
    const heard: string[] = [];
    const broken = { ...WEEK, css: ".hf-week { display: grid; }" };
    const ai: HostAi = { light: slot("light", [JSON.stringify(broken)]), thinking: slot("full", [JSON.stringify(WEEK)], heard) };
    const judge = async (source: string) => (source.includes(".hf-days {") ? [] : ["The class “hf-days” is still drawn and no rule styles it now."]);
    const result = await reviseSection({ ai, source: before, section: "This week", mode: "describe", words: "wrap on a phone", judge });
    expect(result.ok && result.repaired).toBe(true);
    expect(JSON.parse(heard[0]!).what_broke).toEqual(["The class “hf-days” is still drawn and no rule styles it now."]);
  });

  it("refuses in words what still breaks the view after its one repair", async () => {
    const broken = JSON.stringify({ ...WEEK, css: "" });
    const ai: HostAi = { light: slot("light", [broken]), thinking: slot("full", [broken]) };
    const result = await reviseSection({ ai, source: before, section: "This week", mode: "just", judge: async () => ["“This week” is not drawn any more."] });
    expect(result).toMatchObject({ ok: false, refused: "It could not be revised without breaking the view: “This week” is not drawn any more." });
  });

  it("refuses a section the script does not draw, asking no model", async () => {
    const heard: string[] = [];
    const result = await reviseSection({ ai: { light: slot("light", [], heard) }, source: before, section: "Breakfast", mode: "just", judge: async () => [] });
    expect(result).toMatchObject({ ok: false, refused: "“Breakfast” could not be found in the view's code, so it cannot be revised on its own." });
    expect(heard).toEqual([]);
  });
});
