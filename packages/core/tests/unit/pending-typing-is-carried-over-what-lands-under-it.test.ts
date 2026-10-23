import { describe, expect, it } from "vitest";
import { createSchema, defineNode, Store, TYPE_TEXT, z, type Operation } from "../../src/index.js";
import "../../src/typing.js";

/**
 * A CLIENT'S PENDING TYPING IS CARRIED OVER WHAT LANDS UNDER IT (Roadmap
 * f-collab-text, phase 3). A page's keystrokes are shown and pending while
 * the server is asked; when the server's ops land under them
 * (`Store.rebase`), each is carried over the splices those ops took on its
 * field, so the page reaches the text the server will — and the server's
 * own op for one of the page's batches is that batch, not a second copy.
 */
const note = defineNode("note", { fields: z.object({ body: z.string().max(5000).optional() }) });
const schema = createSchema([note]);
const seeded = () => new Store({ schema, snapshot: { nodes: [{ id: "n1", kind: "note", body: "Hello world" }], edges: [] } as never });
const type = (store: Store<typeof schema>, at: number, insert: string, remove = 0, batch?: string) =>
  store.applyAll([{ name: TYPE_TEXT, args: { node: "n1", field: "body", at, remove, insert } }], batch ? { batch } : {});
const body = (store: Store<typeof schema>) => (store.graph.getNode("n1") as { body: string }).body;

describe("pending typing is carried over what lands under it", () => {
  it("carries two pending runs over somebody else's splice, as the server will", () => {
    const server = seeded();
    const page = seeded();
    const first = type(page, 11, "!", 0, "batch:page:1");
    const second = type(page, 0, "Oh. ", 0, "batch:page:2");
    // Somebody else typed into the middle first, on the server.
    const theirs = type(server, 5, ", dear").ops;
    page.rebase({ confirmed: theirs, pending: [first.batch, second.batch] });
    expect(body(page)).toBe("Oh. Hello, dear world!");
    // The server takes the first run with the revision it was typed at, then the second past it.
    const landed = server.applyAll([{ name: TYPE_TEXT, args: { node: "n1", field: "body", at: 11, remove: 0, insert: "!", rev: -1 } }], { batch: first.batch }).ops;
    page.rebase({ confirmed: landed, pending: [second.batch], drop: [first.batch] });
    expect(body(page)).toBe("Oh. Hello, dear world!");
    const sent = page.log.all().filter((op: Operation) => op.batch === second.batch)[0]!.mutation!.args as { at: number; insert: string };
    server.applyAll([{ name: TYPE_TEXT, args: { node: "n1", field: "body", at: sent.at, remove: 0, insert: sent.insert, rev: server.log.length - 1 } }], { batch: second.batch });
    expect(body(server)).toBe(body(page));
  });

  it("takes a refused run out from under the typing after it", () => {
    const page = seeded();
    const refused = type(page, 0, "Dear ", 0, "batch:page:1");
    const after = type(page, 16, "!", 0, "batch:page:2");
    expect(body(page)).toBe("Dear Hello world!");
    page.rebase({ confirmed: [], pending: [after.batch], drop: [refused.batch] });
    expect(body(page)).toBe("Hello world!");
  });
});
