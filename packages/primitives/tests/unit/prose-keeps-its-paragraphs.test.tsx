// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Fields, TextBody, textBlocks } from "../../src/index.js";

/**
 * PROSE KEEPS ITS PARAGRAPHS (FR-146), SPANS THE RECORD UNDER ITS LABEL AND
 * IS CHANGED IN A TEXT AREA (FR-147), IN THE ORDER THE KIND DECLARES (FR-148).
 *
 * Graview Cloud's workshop: an email drafted in full in a `text` field drew
 * as one block in a narrow column, its facts in the order the record was
 * written. Here the draft's blocks are read as paragraphs and lists, every
 * word a text node; the record's fields are drawn in declared order; and
 * editing the draft keeps every line break through the store.
 */
/** The text area is fetched the first time one is opened: wait for it. */
async function opened<T extends Element>(find: () => T | null): Promise<T> {
  for (let tries = 0; tries < 100; tries++) {
    const found = find();
    if (found) return found;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error("the text area never opened");
}

const DRAFT = "Hi Todd,\n\nThank you for two good days.\n\nWhat we agreed:\n\n1. Price it by the acre.\n2. Three townships first.\n\n- Who signs for the county\n* How the cost share is paid\n\nBest,\nNick";

describe("the blocks plain text is written in", () => {
  it("a blank line is a paragraph, a numbered run an ordered list, a dashed or starred run a bulleted one", () => {
    expect(textBlocks(DRAFT)).toEqual([
      { t: "p", lines: ["Hi Todd,"] },
      { t: "p", lines: ["Thank you for two good days."] },
      { t: "p", lines: ["What we agreed:"] },
      { t: "ol", start: 1, items: ["Price it by the acre.", "Three townships first."] },
      { t: "ul", items: ["Who signs for the county", "How the cost share is paid"] },
      { t: "p", lines: ["Best,", "Nick"] },
    ]);
  });

  it("a list may follow its lead line without a blank line, and starts where it starts", () => {
    expect(textBlocks("Still open:\n3. The soil tests\n4. The letter")).toEqual([
      { t: "p", lines: ["Still open:"] },
      { t: "ol", start: 3, items: ["The soil tests", "The letter"] },
    ]);
  });

  it("is drawn as <p>, <br>, <ol> and <ul>, and markup in the text stays text", () => {
    const html = renderToStaticMarkup(<TextBody text={`${DRAFT}\n\n<script>alert(1)</script> <b>not bold</b>`} />);
    expect(html.match(/<p /g)?.length).toBe(5);
    expect(html).toContain('<ol start="1"');
    expect(html.match(/<li>/g)?.length).toBe(4);
    expect(html).toContain("<br/>Nick");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
  });
});

const deliverable = defineNode("deliverable", {
  fields: z.object({
    due: z.string().optional(),
    name: z.string(),
    status: z.enum(["drafting", "sent"]),
    subject: z.string().optional(),
    draft: z.string().max(20_000).optional(),
  }),
  plural: "Deliverables",
  display: { labels: { subject: "Subject line" } },
});
const schema = createSchema([deliverable]);
const { defineMutation } = bindSchema(schema);
const edit = defineMutation("edit-deliverable", {
  title: "Change the deliverable",
  subject: { kinds: ["deliverable"], arg: "id" },
  writes: ["due", "status", "subject", "draft"],
  input: z.object({ id: nodeRef(["deliverable"]), due: z.string().optional(), status: z.enum(["drafting", "sent"]).optional(), subject: z.string().optional(), draft: z.string().max(20_000).optional() }),
  apply(ctx, args) {
    const { id, ...rest } = args;
    ctx.patchNode(id, rest);
  },
});

describe("a record's fields", () => {
  it("are drawn in declared order, the draft the record's width under its label with its paragraphs kept, and edited with its line breaks", async () => {
    // Written as Cloud wrote it: status first, the draft and the subject added later.
    const store = new Store({ schema, mutations: [edit], invariants: [], snapshot: { nodes: [{ id: "email", kind: "deliverable", status: "drafting", due: "2026-10-28", draft: DRAFT, subject: "What we agreed", name: "Email to Todd" }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={createViews(schema)}>
          <Fields id="email" shown={["Email to Todd"]} />
        </GraviewProvider>,
      );
    });
    const labels = [...host.querySelectorAll("dt")].map((dt) => (dt.firstChild?.textContent ?? "").trim());
    expect(labels).toEqual(["Due", "Status", "Subject line", "Draft"]);
    const long = host.querySelector('[data-graview-long="draft"]')!;
    expect(long).not.toBeNull();
    expect((long as HTMLElement).style.gridColumn).toBe("1 / -1");
    expect(long.querySelectorAll("dd p").length).toBe(4);
    expect(long.querySelectorAll("dd ol > li").length).toBe(2);

    const opener = long.querySelector<HTMLButtonElement>("dt button")!;
    expect(opener.getAttribute("aria-label")).toBe("Edit the draft");
    await act(async () => opener.click());
    const area = await opened(() => host.querySelector<HTMLTextAreaElement>('textarea[data-graview-field="draft"]'));
    expect(area.value).toBe(DRAFT);
    expect(area.getAttribute("aria-label")).toBe("Draft");
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(area, `${DRAFT}\n\nP.S. The maps.`);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
    expect(store.graph.getNode("email")?.["draft"]).toBe(`${DRAFT}\n\nP.S. The maps.`);
    expect(host.querySelector('[data-graview-long="draft"] dd')!.querySelectorAll("p").length).toBe(5);
    // The keyboard is back on the control that opened it.
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Edit the draft");
    await act(async () => root.unmount());
    host.remove();
  });

  it("Escape puts the draft back", async () => {
    const store = new Store({ schema, mutations: [edit], invariants: [], snapshot: { nodes: [{ id: "email", kind: "deliverable", status: "drafting", draft: DRAFT, name: "Email to Todd" }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={createViews(schema)}>
          <Fields id="email" />
        </GraviewProvider>,
      );
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-graview-long="draft"] dt button')!.click());
    const area = await opened(() => host.querySelector<HTMLTextAreaElement>("textarea"));
    await act(async () => area.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector("textarea")).toBeNull();
    expect(store.graph.getNode("email")?.["draft"]).toBe(DRAFT);
    await act(async () => root.unmount());
    host.remove();
  });
});
