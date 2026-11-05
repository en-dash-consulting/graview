import { describe, expect, it } from "vitest";
import type { HostAi } from "../../src/ai.js";
import { applyEdits, checkSaid, cssFindings, DESIGN_AGENT_MOVES, DESIGN_AGENT_SYSTEM, findingKind, readAgentReply, runDesignAgent, stuckSaid, type DesignAgentEvent, type DesignAgentHost } from "../../src/section.js";

/*
 * A SMALL CHANGE IS AN EDIT (Roadmap f-better-ui-small-edits). Seen on
 * 0.1.66: on a home view of some 15 KB a chat wrote, "fix the En Dash logo
 * in this hero to not have rounded corners" is one declaration — and the
 * agent could only answer with the whole script, every byte of it judged,
 * three times over, and nothing kept. The agent may now answer with exact
 * find-and-replace pairs that the framework applies to the script, drawn
 * and judged as a whole draft is; a find that is not there once is handed
 * back in words. And a style refused says which rule and why.
 */
const part = { name: "Home", slot: "home" as const };
const manifest = { name: "home", attach: "view", cardinality: "many" as const, replaces: "page" as const };

const SECTIONS = ["Who we are", "What we build", "How we work", "Who we build with", "What people say", "Where to find us"];
const CARDS = SECTIONS.map((section, at) => Array.from({ length: 6 }, (_, one) => `${section.split(" ").at(-1)} card ${at * 6 + one + 1}`));

/** A home view as a chat writes one: a hero with the logo, and cards in headed sections, under a long stylesheet. */
function homeView(): string {
  const rules = [
    ".home{display:grid;gap:28px;padding:24px;color:var(--graview-ink);background:var(--graview-ground)}",
    ".home .hero{display:flex;align-items:center;gap:18px;padding:32px;border:1px solid var(--graview-edge);background:var(--graview-panel)}",
    // The logo: its corners rounded, and a property the host never kept — the page draws it without that already.
    ".home .lg{width:56px;height:56px;border-radius:10px;image-rendering:pixelated}",
    ".home .hero h1{margin:0;font-size:2rem;line-height:1.1}",
    ".home .hero p{margin:6px 0 0;color:var(--graview-ink-muted)}",
    ".home .card{padding:16px;border:1px solid var(--graview-edge);border-radius:10px;background:var(--graview-panel)}",
    ".home .chip{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.8rem;color:var(--graview-accent)}",
    ".home section h2{margin:0 0 12px;font-size:1.25rem}",
    ".home .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}",
    "@media (max-width: 640px){.home{padding:12px}.home .hero{flex-direction:column;align-items:flex-start}}",
  ];
  // Each section's own rules, as a chat writes them: one per section, many lines in all.
  const own = SECTIONS.map((_, at) => `.home .s${at} .card h3{margin:0 0 4px;font-size:1rem;letter-spacing:.01em}\n.home .s${at} .card p{margin:0;color:var(--graview-ink-muted);line-height:1.45}\n.home .s${at} .card:hover{border-color:var(--graview-accent)}`);
  const sections = SECTIONS.map(
    (section, at) => `      <section class="s${at}" aria-labelledby="s${at}-h">
        <h2 id="s${at}-h">${section}</h2>
        <div class="grid">
${CARDS[at]!.map((card, one) => `          <article class="card" data-key="c${at}-${one}"><h3>${card}</h3><p>What ${card.toLowerCase()} is about, said in a sentence or two so a person reading the page at a glance knows why it is here and what to do next.</p><span class="chip">${one % 2 ? "New" : "Ongoing"}</span></article>`).join("\n")}
        </div>
      </section>`,
  );
  return [
    `graview.style(\`${[...rules, ...own].join("\n")}\`);`,
    "graview.onProps((props) => {",
    "  const logo = props.brand && props.brand.logo ? props.brand.logo : \"\";",
    "  graview.render(graview.html`",
    '    <div class="home">',
    '      <header class="hero"><img class="lg" alt="En Dash" src="${logo}"><div><h1>En Dash</h1><p>Small software, made carefully, with the people who use it.</p></div></header>',
    sections.join("\n"),
    "    </div>`);",
    "});",
  ].join("\n");
}

const HOME = homeView();
const LOGO = ".home .lg{width:56px;height:56px;border-radius:10px;image-rendering:pixelated}";
const SQUARE = ".home .lg{width:56px;height:56px;border-radius:0;image-rendering:pixelated}";

/** A model that answers in turn, the prompts it was given. */
function agentOf(answers: readonly object[]): { ai: HostAi; prompts: Record<string, unknown>[] } {
  const prompts: Record<string, unknown>[] = [];
  let at = 0;
  const think = async ({ prompt }: { prompt: string }) => {
    prompts.push(JSON.parse(prompt) as Record<string, unknown>);
    return { text: JSON.stringify(answers[Math.min(at++, answers.length - 1)]) };
  };
  return { ai: { thinking: { model: "full", think } } as unknown as HostAi, prompts };
}

/** A page that judges a draft as the real one would on this home: every heading and every card still drawn. */
const host = (drawn: string[] = []): DesignAgentHost => ({
  look: () => ({ headings: SECTIONS, records: CARDS.flat().map((record) => ({ record })) }),
  read: () => ({ count: CARDS.flat().length }),
  draft: async (source) => {
    drawn.push(source);
    const lost = CARDS.flat().filter((card) => !source.includes(card));
    const headings = SECTIONS.filter((heading) => !source.includes(heading));
    return {
      findings: [...(lost.length ? [`It no longer shows ${lost.slice(0, 4).map((one) => `“${one}”`).join(", ")}${lost.length > 4 ? ` and ${lost.length - 4} more` : ""}: show every record the page showed.`] : []), ...(headings.length ? [`It no longer shows the headings ${headings.map((one) => `“${one}”`).join(", ")}: keep each heading the page had.`] : [])],
      drew: { headings: SECTIONS.filter((heading) => source.includes(heading)) },
    };
  },
});

const talk = [{ who: "person" as const, said: "fix the En Dash logo in this hero to not have rounded corners" }];

describe("a small change asked of Better UI", () => {
  it("is kept from the first step as one changed declaration on a 15 KB home view", async () => {
    expect(HOME.length).toBeGreaterThan(14_000);
    expect(HOME.split(LOGO)).toHaveLength(2);
    const { ai, prompts } = agentOf([{ say: "The logo has square corners now.", do: "edit", edits: [{ find: ".home .lg{width:56px;height:56px;border-radius:10px", replace: ".home .lg{width:56px;height:56px;border-radius:0" }] }]);
    const drawn: string[] = [];
    const events: DesignAgentEvent[] = [];
    const result = await runDesignAgent({ ai, part, manifest, talk, current: HOME, host: host(drawn), onEvent: (one) => events.push(one), noun: "cards" });
    expect(result).toMatchObject({ ended: "done", said: "The logo has square corners now.", passed: { source: HOME.replace(LOGO, SQUARE) } });
    expect(prompts).toHaveLength(1);
    // The agent was shown the whole script it edits, never its first 9 KB.
    expect(prompts[0]!["your_draft_on_the_page"]).toBe(HOME);
    // One declaration changed, every other byte as it was.
    const before = HOME.split("\n");
    const after = result.passed!.source.split("\n");
    expect(after).toHaveLength(before.length);
    const changed = after.flatMap((line, at) => (line === before[at] ? [] : [[before[at], line]]));
    expect(changed).toEqual([[LOGO, SQUARE]]);
    expect(drawn).toEqual([result.passed!.source]);
    expect(events.map((one) => one.kind)).toEqual(["look", "edit", "passed"]);
    expect(events.find((one) => one.kind === "edit")?.text).toBe("Changing: The logo has square corners now");
  });

  it("hands back a find that is there more than once, in words, and draws nothing until it is there once", async () => {
    const { ai, prompts } = agentOf([
      { say: "Square corners.", do: "edit", edits: [{ find: "border-radius:10px", replace: "border-radius:0" }] },
      { say: "Square corners on the logo.", do: "edit", edits: [{ find: ".home .lg{width:56px;height:56px;border-radius:10px", replace: ".home .lg{width:56px;height:56px;border-radius:0" }] },
    ]);
    const drawn: string[] = [];
    const events: DesignAgentEvent[] = [];
    const result = await runDesignAgent({ ai, part, manifest, talk, current: HOME, host: host(drawn), onEvent: (one) => events.push(one), noun: "cards" });
    expect(result).toMatchObject({ ended: "done", passed: { source: HOME.replace(LOGO, SQUARE) } });
    expect(drawn).toHaveLength(1);
    const told = (prompts[1]!["your_steps"] as { did: string; edits?: unknown; result?: { findings?: string[] } }[])[0]!;
    expect(told).toMatchObject({ did: "edit", edits: [{ find: "border-radius:10px", replace: "border-radius:0" }] });
    expect(told.result?.findings).toEqual(["Edit 1: “border-radius:10px” appears 3 times in the script on the page: quote more of the text around the place you mean, so it appears once."]);
    expect(findingKind(told.result!.findings![0]!)).toBe("edit-missed");
    expect(events.find((one) => one.kind === "check")?.text).toBe("Check: an edit's text appears 3 times — fixing");
  });

  it("hands back a find that is not in the script, and an edit with no script to edit", async () => {
    expect(applyEdits(HOME, [{ find: ".home .logo{border-radius:10px}", replace: "" }], "the script on the page")).toEqual({
      findings: ["Edit 1: “.home .logo{border-radius:10px}” is not in the script on the page: quote it exactly as it stands there, spaces and quotes included."],
    });
    expect(applyEdits(HOME, [{ find: ".home .lg{ width:56px", replace: "" }], "the script on the page")).toEqual({
      findings: ["Edit 1: “.home .lg{ width:56px” is not in the script on the page as written, but is there with other spacing: quote it exactly as it stands there, spaces and quotes included."],
    });
    expect(applyEdits("a b a", [{ find: "b", replace: "c" }, { find: "c", replace: "d" }], "it")).toEqual({ source: "a d a" });
    const { ai, prompts } = agentOf([
      { say: "Square corners.", do: "edit", edits: [{ find: "border-radius:10px", replace: "border-radius:0" }] },
      { say: "I need the page.", do: "ask" },
    ]);
    await runDesignAgent({ ai, part, manifest, talk, host: host() });
    const told = (prompts[1]!["your_steps"] as { result?: { findings?: string[] } }[])[0]!;
    expect(told.result?.findings).toEqual(["There is no script to edit yet: draft the whole script."]);
  });

  it("edits its own last draft where that is what it means, shown it whole to quote", async () => {
    const draft = HOME.replace(LOGO, ".home .lg{width:56px;height:56px;border-radius:0;image-rendering:pixelated;zoom:2}");
    const { ai, prompts } = agentOf([
      { say: "Square corners.", do: "draft", source: draft },
      { say: "Square corners, nothing else.", do: "edit", in: "draft", edits: [{ find: ";zoom:2}", replace: "}" }] },
    ]);
    const result = await runDesignAgent({ ai, part, manifest, talk, current: HOME, host: host(), noun: "cards" });
    expect(prompts[1]!["your_last_draft"]).toBe(draft);
    expect(result).toMatchObject({ ended: "done", passed: { source: HOME.replace(LOGO, SQUARE) } });
  });

  it("is taught: an edit for a small change, a whole draft for a redesign", () => {
    expect(DESIGN_AGENT_MOVES).toEqual(["look", "read", "edit", "draft", "done", "ask"]);
    expect(DESIGN_AGENT_SYSTEM).toMatch(/- edit: /);
    expect(DESIGN_AGENT_SYSTEM).toMatch(/small change[^\n]*edit/i);
    expect(DESIGN_AGENT_SYSTEM).toMatch(/redesign[^\n]*whole/i);
    expect(readAgentReply(JSON.stringify({ say: "Square.", do: "edit", edits: [{ find: "a", replace: "b" }] }))).toEqual({ say: "Square.", do: "edit", edits: [{ find: "a", replace: "b" }] });
    expect(readAgentReply(JSON.stringify({ say: "Square.", do: "edit", in: "draft", edits: [{ find: "a", replace: "b" }] }))).toEqual({ say: "Square.", do: "edit", in: "draft", edits: [{ find: "a", replace: "b" }] });
    // An edit with nothing to find is no edit.
    expect(readAgentReply(JSON.stringify({ say: "Square.", do: "edit", edits: [] }))).toBeUndefined();
    expect(readAgentReply(JSON.stringify({ say: "Square.", do: "edit", edits: [{ replace: "b" }] }))).toBeUndefined();
  });
});

describe("a style a draft's stylesheet is refused", () => {
  it("names its rule, what of the rule was kept, and why the rest is not", () => {
    const found = cssFindings("graview.style(`.home .hero{padding:32px}\n.home .lg{border-radius:0;image-rendering:pixelated}`); graview.onProps(() => {});");
    expect(found).toEqual(["In “.home .lg”, the property “image-rendering” is not allowed and is removed (border-radius is kept): use ordinary layout, color and type properties."]);
    expect(findingKind(found[0]!)).toBe("style-refused");
    expect(checkSaid(found, "cards")).toBe("“.home .lg” keeps border-radius; image-rendering isn't allowed");
    expect(stuckSaid(found[0]!, true, "cards")).toBe("I tried twice, and the new design still uses image-rendering in “.home .lg”, which isn't allowed. Keep it anyway, or stop?");
    expect(checkSaid(cssFindings("graview.style(`.a{position:fixed;color:red}`);"))).toBe("“.a” keeps color; that value of position isn't allowed");
    expect(checkSaid(cssFindings("graview.style(`.a{background:url(https://x.example/a.png)}`);"))).toBe("url() in “.a” isn't allowed");
    expect(checkSaid(cssFindings("graview.style(`:host{display:block}`);"))).toBe("the selector “:host” reaches outside the page");
  });

  it("is no finding where the page's own script had it already: the page draws without it now", async () => {
    expect(cssFindings(HOME)).toHaveLength(1);
    expect(cssFindings(HOME, { already: HOME })).toEqual([]);
    // A new one is still found.
    expect(cssFindings(HOME.replace(".home .hero h1{margin:0;", ".home .hero h1{margin:0;zoom:2;"), { already: HOME })).toEqual(["In “.home .hero h1”, the property “zoom” is not allowed and is removed (margin, font-size and line-height are kept): use ordinary layout, color and type properties."]);
  });

  it("is said to the panel by its rule, never only as styles the page won't keep", async () => {
    const { ai } = agentOf([
      { say: "Square corners.", do: "draft", source: HOME.replace(LOGO, ".home .lg{width:56px;height:56px;border-radius:0;zoom:2}") },
      { say: "Square corners.", do: "edit", edits: [{ find: LOGO, replace: SQUARE }] },
    ]);
    const events: DesignAgentEvent[] = [];
    await runDesignAgent({ ai, part, manifest, talk, current: HOME, host: host(), onEvent: (one) => events.push(one), noun: "cards" });
    const check = events.find((one) => one.kind === "check");
    expect(check?.text).toBe("Check: “.home .lg” keeps width, height and border-radius; zoom isn't allowed — fixing");
    expect(check?.text).not.toMatch(/won't keep/);
  });
});
