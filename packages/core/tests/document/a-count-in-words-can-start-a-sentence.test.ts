import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { resolveFor } from "../../src/describe.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { parseTemplate, renderTemplate } from "../../src/document/index.js";
import { TemplateError } from "../../src/document/template-parse.js";

/**
 * A COUNT IN WORDS CAN START A SENTENCE: `| capital`.
 *
 * The review app's headline was "{count(all('finding')) | words}
 * findings, worst first", and read "fifty-seven findings, worst first".
 * `capital` upper-cases the first letter of what was said, after another
 * formatter or alone — one formatter more, named like the others.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/review.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/review.seed.json", import.meta.url), "utf8"));
const empty = { node: null, kinds: new Map(), today: "2026-10-15" };

describe("| capital", () => {
  it("starts a headline with a count in words: 'Two findings, worst first'", () => {
    const compiled = compileDocument(review, { today: () => "2026-10-15" });
    if (!compiled.ok) throw new Error("the review did not compile");
    const store = new Store<AnySchema>({ schema: compiled.app.schema as AnySchema, mutations: compiled.app.mutations ?? [], policy: compiled.app.policy!, snapshot: seed });
    const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
    const home = resolveFor(store, owner, null, { app: compiled.app });
    expect(home.find((block) => block.key === "headline")).toMatchObject({ t: "headline", text: "Two findings, worst first" });
  });

  it("follows any formatter, or stands alone", () => {
    expect(renderTemplate(parseTemplate("{57 | words | capital} findings"), empty)).toBe("Fifty-seven findings");
    expect(renderTemplate(parseTemplate("{'draft' | capital}"), empty)).toBe("Draft");
    expect(renderTemplate(parseTemplate("{3 | words} left"), empty)).toBe("three left");
  });

  it("is the only formatter that may follow another, and is said once", () => {
    expect(() => parseTemplate("{57 | words | money}")).toThrow(TemplateError);
    expect(() => parseTemplate("{57 | capital | capital}")).toThrow(TemplateError);
  });
});
