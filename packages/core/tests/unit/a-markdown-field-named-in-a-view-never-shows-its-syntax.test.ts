import { describe, expect, it } from "vitest";
import { blockContextFor, compileBlocks, resolveBlocks } from "../../src/blocks.js";
import { createSchema, defineNode, markdownField, Store, z, type AnySchema } from "../../src/index.js";

/**
 * A MARKDOWN FIELD NAMED IN A VIEW NEVER SHOWS ITS SYNTAX (FR-180). A
 * declared `{ "text": "{body}" }` block printed the field as written —
 * "## Plan", "**Friday**" — where the record's own page drew it as prose.
 * A text block that is the field alone is drawn as Markdown on a page; in a
 * card or a row it is said by its start; beside other words, or in a title,
 * it is said as its words with the syntax taken out.
 */
const brief = defineNode("brief", { fields: z.object({ name: z.string(), body: markdownField().optional(), plain: z.string().optional() }), plural: "Briefs" });
const schema = createSchema([brief]) as unknown as AnySchema;
const BODY = "## Plan\n\nShip it **Friday**, with [the notes](https://graview.dev). Then the rest.\n\n- one\n- two";
const node = { id: "brief:one", kind: "brief", name: "One", body: BODY, plain: "## not markdown" };
const store = new Store<AnySchema>({ schema, snapshot: { nodes: [node], edges: [] } as never });

const resolved = (slot: "page" | "card" | "row", blocks: readonly unknown[]) => resolveBlocks(compileBlocks(blocks as never), blockContextFor(store, null, node, { slot }));

describe("a Markdown field named in a view", () => {
  it("is drawn as Markdown on a page when a text block is the field alone", () => {
    const [block] = resolved("page", [{ text: "{body}" }]);
    expect(block).toMatchObject({ t: "text", text: BODY, markdown: true });
  });

  it("is said by its start, the syntax taken out, in a card or a row", () => {
    for (const slot of ["card", "row"] as const) {
      const [block] = resolved(slot, [{ text: "{body}" }]);
      expect(block).toMatchObject({ t: "text" });
      expect((block as { markdown?: true }).markdown).toBeUndefined();
      expect((block as { text: string }).text).not.toMatch(/[#*[\]]/);
      expect((block as { text: string }).text).toMatch(/^Plan/);
    }
  });

  it("is said as its words beside other words and in a title, on any face", () => {
    const [text, title] = resolved("page", [{ text: "Notes: {body}" }, { title: "{body}" }]);
    expect((text as { text: string }).text).toBe("Notes: Plan Ship it Friday, with the notes. Then the rest. one two");
    expect((title as { text: string }).text).not.toMatch(/[#*[\]]/);
    expect((text as { markdown?: true }).markdown).toBeUndefined();
  });

  it("leaves a plain text field and a filtered one as they were", () => {
    const [plain, filtered] = resolved("page", [{ text: "{plain}" }, { text: "{body|upper}" }]);
    expect(plain).toMatchObject({ text: "## not markdown" });
    expect((filtered as { text: string }).text).toBe(BODY.toUpperCase());
  });
});
