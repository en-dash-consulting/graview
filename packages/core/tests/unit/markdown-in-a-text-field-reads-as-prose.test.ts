import { describe, expect, it } from "vitest";
import { markdownBlocks, markdownHtml, safeHref } from "../../src/markdown.js";
import { excerptOf } from "../../src/excerpt-of.js";
import { excerpt } from "../../src/excerpt.js";
import { createSchema, defineNode, markdownField, z } from "../../src/index.js";
import { isMarkdownField, readableFields } from "../../src/words.js";
import { nodeJsonSchema } from "../../src/json-schema.js";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/edit.js";
import { diffDocuments } from "../../src/document/diff.js";
import { fieldSpecOf } from "../../src/document/field-spec.js";
import { capabilities } from "../../src/capabilities.js";

/*
 * FR-180: a text field may be written in Markdown. The record's page draws
 * it as prose, safely; everything else says its start, with the syntax
 * taken out.
 */

const BRIEF = [
  "## What 0.1.29 answers",
  "",
  "0.1.29 answers your brief after 0.1.28: **FR-180**, in `capabilities().shipped`. Offer the format only when it lists FR-180.",
  "",
  "- A text field may say `format: \"markdown\"`",
  "- Lists say an *excerpt*",
  "  - nested, by indenting",
  "",
  "1. first",
  "2. second",
  "",
  "> Quoted, with a [link](https://graview.dev/docs).",
  "",
  "```ts",
  "const x = 1 < 2;",
  "```",
  "",
  "---",
  "",
  "| Op | Says |",
  "|:---|---:|",
  "| set-people | a sentence |",
].join("\n");

describe("Markdown read safely (FR-180)", () => {
  it("reads headings, paragraphs, lists, emphasis, code, quotes, links, rules and tables", () => {
    const html = markdownHtml(BRIEF);
    expect(html).toContain("<h4>What 0.1.29 answers</h4>");
    expect(html).toContain("<strong>FR-180</strong>");
    expect(html).toContain("<code>capabilities().shipped</code>");
    expect(html).toContain("<ul><li>A text field may say <code>format: &quot;markdown&quot;</code></li>");
    expect(html).toContain("<em>excerpt</em>");
    expect(html).toMatch(/<li><p>Lists say an <em>excerpt<\/em><\/p><ul><li>nested, by indenting<\/li><\/ul><\/li>/);
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
    expect(html).toContain('<blockquote><p>Quoted, with a <a href="https://graview.dev/docs" rel="noopener noreferrer nofollow" target="_blank">link</a>.</p></blockquote>');
    expect(html).toContain("<pre><code>const x = 1 &lt; 2;</code></pre>");
    expect(html).toContain("<hr>");
    expect(html).toContain('<th style="text-align:left">Op</th><th style="text-align:right">Says</th>');
    expect(html).toContain("<td style=\"text-align:left\">set-people</td>");
    // Not one mark of the syntax shows.
    expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/\*\*|##|```|\|---/);
  });

  it("keeps a line break inside a paragraph", () => {
    expect(markdownHtml("one\ntwo")).toBe("<p>one<br>two</p>");
  });

  it("runs nothing, whatever it holds", () => {
    const hostile = [
      "<script>alert(1)</script>",
      '<img src=x onerror="alert(1)">',
      "[click](javascript:alert(1))",
      "[click](JaVaScRiPt:alert(1))",
      "[click](java\tscript:alert(1))",
      "[data](data:text/html;base64,PHNjcmlwdD4=)",
      "[relative](/admin)",
      "![pic](https://evil.example/x.png)",
      "<javascript:alert(1)>",
      "&lt;script&gt;alert(1)&lt;/script&gt; &#0; &#x0; &#xD800; &#1114112;",
      '[x](https://ok.example/" onmouseover="alert(1))',
      "<a href=\"javascript:alert(1)\">a</a>",
    ].join("\n\n");
    const html = markdownHtml(hostile);
    // Every link is one of the web's, its attributes the renderer's own; every other "<" is text.
    for (const link of html.match(/<a [^>]*>/g) ?? []) expect(link).toMatch(/^<a href="https:\/\/[^"<>\s]+" rel="noopener noreferrer nofollow" target="_blank">$/);
    // Every tag is one the renderer wrote.
    for (const tag of html.matchAll(/<\/?([a-z0-9]+)/gi)) expect(["p", "a"]).toContain(tag[1]!.toLowerCase());
    // The picture is its words, a link to its address — never drawn.
    expect(html).toContain('<a href="https://evil.example/x.png" rel="noopener noreferrer nofollow" target="_blank">pic</a>');
    // An entity is its character, escaped again on the way out; a control character is not made.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toMatch(/\u0000/);
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref(" https://x.example")).toBe("https://x.example");
    expect(safeHref("mailto:nick@example.com")).toBe("mailto:nick@example.com");
    expect(safeHref("https://")).toBeUndefined();
  });

  it("reads a huge or pathological text in a moment", () => {
    const cases = [
      "*a ".repeat(20_000),
      "**".repeat(20_000),
      "[".repeat(20_000),
      "`".repeat(20_000),
      "_a".repeat(20_000),
      `# ${" ".repeat(20_000)}x`,
      `\`\`\`${"a".repeat(20_000)}\``,
      "- a\n".repeat(5_000),
      "  ".repeat(5_000) + "- deep",
      ">".repeat(20_000) + " deep",
      "h h ".repeat(10_000),
      "<".repeat(20_000),
      "&#".repeat(20_000),
      Array.from({ length: 200 }, (_, i) => `${"  ".repeat(i)}- level ${i}`).join("\n"),
      `${"x".repeat(19_000)}\n\n${"\n".repeat(2000)}- end`,
    ];
    for (const text of cases) {
      const started = performance.now();
      markdownHtml(text);
      excerptOf(text, { markdown: true });
      expect(performance.now() - started, text.slice(0, 20)).toBeLessThan(500);
    }
  });

  it("nests no deeper than it can draw", () => {
    const blocks = markdownBlocks(">".repeat(50) + " deep");
    let depth = 0;
    let at: (typeof blocks)[number] | undefined = blocks[0];
    while (at?.t === "quote") {
      depth++;
      at = at.blocks[0];
    }
    expect(depth).toBeLessThanOrEqual(9);
  });
});

describe("a text field said as an excerpt (FR-180)", () => {
  it("says the first block with the syntax taken out", () => {
    expect(excerptOf("## Heading **bold**\n\nThe rest.", { markdown: true })).toBe("Heading bold…");
    expect(excerptOf(BRIEF.split("\n").slice(2).join("\n"), { markdown: true })).toBe(
      "0.1.29 answers your brief after 0.1.28: FR-180, in capabilities().shipped. Offer the format only when it lists FR-180.",
    );
    expect(excerptOf("- [x] done it\n- next", { markdown: true })).toBe("done it…");
    expect(excerptOf("See [the docs](https://graview.dev) and `pnpm verify`", { markdown: true })).toBe("See the docs and pnpm verify");
    expect(excerptOf("snake_case stays, 2 * 3 * 4 stays", { markdown: true })).toBe("snake_case stays, 2 * 3 * 4 stays");
  });

  it("ends the first sentence at a code-ish word's stop, and not at an abbreviation's", () => {
    expect(excerpt("Read it in capabilities().shipped. Then offer the format.")).toBe("Read it in capabilities().shipped.");
    expect(excerpt("The docs live at graview.dev. Read them first.")).toBe("The docs live at graview.dev.");
    expect(excerpt("Bring a dish, e.g. a salad, and see Dr. Lee at noon. Then the rest.")).toBe("Bring a dish, e.g. a salad, and see Dr. Lee at noon.");
    expect(excerpt("Ask the U.S. office (i.e. Sam) first. Then the rest.")).toBe("Ask the U.S. office (i.e. Sam) first.");
    const long = `0.1.29 answers your brief: FR-180, in capabilities().shipped. ${"Offer the format only when it lists FR-180, and say so. ".repeat(4)}`;
    expect(excerptOf(long, { markdown: true })).toBe("0.1.29 answers your brief: FR-180, in capabilities().shipped.");
  });

  it("cuts at about 160 characters, at a word, with an ellipsis", () => {
    const long = `${"word ".repeat(60)}end`;
    const said = excerptOf(long);
    expect(said.length).toBeLessThanOrEqual(161);
    expect(said.endsWith("…")).toBe(true);
    expect(said).not.toMatch(/wor…$/);
  });

  it("keeps plain text's own marks, and says its first paragraph", () => {
    expect(excerptOf("Call the **vendor**\nabout the deposit.\n\nThen the rest.")).toBe("Call the **vendor** about the deposit.");
  });

  it("is what a template's excerpt says, Markdown's commonest marks taken out", () => {
    expect(excerpt("## Ship it\n\n**Friday** — then the notes, the release and the long tail after it.")).toBe("Ship it Friday — then the notes, the release and the long tail after it.");
  });
});

describe("the field, declared (FR-180)", () => {
  const brief = defineNode("brief", { fields: z.object({ title: z.string(), body: markdownField().optional(), notes: z.string().max(5000).optional() }) });
  const schema = createSchema([brief] as const);

  it("is marked through optional, and says so to a tool", () => {
    expect(isMarkdownField(brief.fields.shape.body)).toBe(true);
    expect(isMarkdownField(brief.fields.shape.notes)).toBe(false);
    const json = nodeJsonSchema(brief as never) as { properties: Record<string, Record<string, unknown>> };
    expect(json.properties["body"]).toMatchObject({ contentMediaType: "text/markdown", description: "Written in Markdown." });
    expect(fieldSpecOf(brief.fields.shape.body)).toMatchObject({ type: "text", format: "markdown" });
    void schema;
  });

  it("is read whole on a record and by its start on a glance", () => {
    const node = { id: "b1", kind: "brief", title: "0.1.29", body: BRIEF, notes: "Line one\nline two" };
    const whole = readableFields(node, brief as never);
    expect(whole.find((field) => field.key === "body")).toMatchObject({ value: BRIEF, markdown: true, long: true });
    const glance = readableFields(node, brief as never, { glance: true, said: ["0.1.29"] });
    expect(glance.find((field) => field.key === "body")?.value).toBe("What 0.1.29 answers…");
    expect(glance.find((field) => field.key === "notes")?.value).toBe("Line one line two");
  });

  it("is a document's text field with format markdown, checked, compiled and edited", () => {
    const doc = { format: "graview-document", formatVersion: 1, name: "Roadmap", kinds: { brief: { fields: { title: { type: "string", required: true }, body: { type: "text", format: "markdown" }, line: { type: "string" } } } } };
    const compiled = compileDocument(doc);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const definition = compiled.app.schema.tryDefinition("brief")!;
    expect(isMarkdownField((definition.fields as { shape: Record<string, unknown> }).shape["body"])).toBe(true);
    const wrong = compileDocument({ ...doc, kinds: { brief: { fields: { title: { type: "string", format: "markdown" } } } } });
    expect(wrong.findings.map((finding) => finding.message).join(" ")).toMatch(/"markdown" is a text field's format/);
    const edited = editDocument(compiled.document, [{ op: "retype-field", kind: "brief", field: "body", type: "text" }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(edited.said.join(" ")).toMatch(/brief's body is drawn as written, not as Markdown/);
    expect(edited.document.kinds["brief"]!.fields["body"]!.format).toBeUndefined();
    const back = editDocument(edited.document, [{ op: "retype-field", kind: "brief", field: "body", type: "text", format: "markdown" }]);
    if (!back.ok) throw new Error(JSON.stringify(back.findings));
    expect(back.said.join(" ")).toMatch(/brief's body is now written in Markdown/);
    expect(back.document.kinds["brief"]!.fields["body"]).toMatchObject({ type: "text", format: "markdown" });
    const refused = editDocument(compiled.document, [{ op: "retype-field", kind: "brief", field: "line", type: "string", format: "markdown" }]);
    expect(refused.ok).toBe(false);
  });

  it("is said as Markdown in a change's preview, never as a number's format", () => {
    const before = { format: "graview-document", formatVersion: 1, name: "Roadmap", kinds: { brief: { fields: { title: { type: "string", required: true }, body: { type: "text" } } } } };
    const after = { ...before, kinds: { brief: { fields: { title: { type: "string", required: true }, body: { type: "text", format: "markdown" } } } } };
    const said = diffDocuments(before as never, after as never).sentences.join(" ");
    expect(said).toMatch(/brief's body is now written in Markdown/);
    expect(said).not.toMatch(/undefined|said as|reads 12/);
    const added = editDocument(before as never, [{ op: "add-field", kind: "brief", field: "notes", type: "text", format: "markdown" }]);
    if (!added.ok) throw new Error(JSON.stringify(added.findings));
    expect(added.said.join(" ")).toMatch(/brief gains a field, notes \(text, written in Markdown\)/);
    expect(added.said.join(" ")).not.toMatch(/undefined/);
  });

  it("is named in what the framework has shipped", () => {
    expect(capabilities().shipped).toContain("FR-180");
  });
});
