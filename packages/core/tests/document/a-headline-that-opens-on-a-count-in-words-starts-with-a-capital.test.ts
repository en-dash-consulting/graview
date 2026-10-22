import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { resolveFor } from "../../src/describe.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { headlineSaid } from "../../src/document/template.js";
import { parseTemplate } from "../../src/document/template-parse.js";

/**
 * A HEADLINE THAT OPENS ON A COUNT IN WORDS STARTS WITH A CAPITAL, with or
 * without `| capital`. Threat Watch's "{count(all('indicator')) | words}
 * indicators…" read "seventy-two indicators…" at the top of its home. Only
 * a headline, only words the framework wrote (`words`, `plural`,
 * `relative`), and only a first word all in lower case: text the author
 * wrote first, and a record's own name, stay as they were spelled.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/review.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/review.seed.json", import.meta.url), "utf8"));
const said = (template: string, text: string) => headlineSaid(parseTemplate(template), text);

describe("a headline that opens on a count in words", () => {
  it("says 'Two findings, worst first' with no | capital", () => {
    const home = (review.views.home as { headline?: string }[]).map((block) =>
      block.headline ? { ...block, headline: block.headline.replace(" | capital", "") } : block,
    );
    expect(JSON.stringify(home)).not.toContain("capital");
    const compiled = compileDocument({ ...review, views: { ...review.views, home } }, { today: () => "2026-10-15" });
    if (!compiled.ok) throw new Error("the review did not compile");
    const store = new Store<AnySchema>({ schema: compiled.app.schema as AnySchema, mutations: compiled.app.mutations ?? [], policy: compiled.app.policy!, snapshot: seed });
    const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
    const blocks = resolveFor(store, owner, null, { app: compiled.app });
    expect(blocks.find((block) => block.key === "headline")).toMatchObject({ t: "headline", text: "Two findings, worst first" });
  });

  it("capitalizes words the framework wrote at the start: seventy-two, threats, 3 days ago is left as digits", () => {
    expect(said("{count(all('indicator')) | words} indicators", "seventy-two indicators")).toBe("Seventy-two indicators");
    expect(said("{count(all('threat')) | plural: 'threat'} open", "threats open")).toBe("Threats open");
    expect(said("{seen | relative}", "3 days ago")).toBe("3 days ago");
  });

  it("leaves text the author wrote first, a record's own name and a word not all lower case as written", () => {
    expect(said("only {count(all('x')) | words} left", "only three left")).toBe("only three left");
    expect(said("{name}", "iPhone launch")).toBe("iPhone launch");
    expect(said("{name} stays", "eBay stays")).toBe("eBay stays");
    expect(said("{names | words}", "cVEs")).toBe("cVEs");
  });
});
