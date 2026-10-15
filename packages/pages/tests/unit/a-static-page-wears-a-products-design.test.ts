import { readFileSync } from "node:fs";
import type { Principal } from "@graview/core";
import { renderPlace, type StaticDesign } from "@graview/pages/static";
import { describe, expect, it } from "vitest";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";

/**
 * A STATIC PAGE WEARS A PRODUCT'S OWN DESIGN. The routed face takes a
 * design as a registry of components — a record page per kind, a shell
 * around every page — and a host that prints a place had no way to do the
 * same: `renderPlace` wrote the derived page or nothing, so a product whose
 * site is its records (graview.dev) could not render them in its own look.
 * `design.records[kind]` writes a record's page and `design.document` the
 * document around it, each reading only what the seat may see.
 */

const example = JSON.parse(readFileSync(new URL("../../../../apps/todo/src/data/example.json", import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const todo = () => createTodoStore({ snapshot: example });

const design: StaticDesign = {
  records: {
    list: (record) => `<article class="mine"><h1>${record.title}</h1><ol>${record.related("holds").map((task) => `<li data-id="${task.id}">${task.title}</li>`).join("")}</ol></article>`,
    // A writer that answers nothing leaves the derived page.
    task: () => undefined,
  },
  document: (page) => `<!doctype html><title>${page.title}</title><body data-kind="${page.record?.kind ?? "none"}" data-found="${page.found}">${page.main}</body>`,
};

describe("a static page in a product's design", () => {
  it("writes a record's page with the kind's writer, its relations read in the order they were made", () => {
    const store = todo();
    const list = store.graph.nodesOfKind("list")[0]!;
    const tasks = store.graph.out(list.id, "holds");
    expect(tasks.length).toBeGreaterThan(0);
    const page = renderPlace(store, todoApp, list.id, { viewer: keeper, design });
    expect(page.found).toBe(true);
    expect(page.html.startsWith(`<!doctype html><title>${page.title}</title><body data-kind="list" data-found="true"><article class="mine">`)).toBe(true);
    expect([...page.html.matchAll(/data-id="([^"]+)"/g)].map(([, id]) => id)).toEqual(tasks.map((task) => task.id));
    // Not the derived page: none of its markup is there.
    expect(page.html).not.toContain("gv-");
  });

  it("leaves the derived page where the writer answers nothing, inside the design's document", () => {
    const store = todo();
    const task = store.graph.nodesOfKind("task")[0]!;
    const page = renderPlace(store, todoApp, task.id, { viewer: keeper, design });
    expect(page.html).toContain('<body data-kind="task" data-found="true">');
    expect(page.html).toContain('<header class="gv-head">');
  });

  it("hands the document a place that is not a record, and an address nobody has, with nothing to say about a record", () => {
    const store = todo();
    expect(renderPlace(store, todoApp, "/tasks", { viewer: keeper, design }).html).toContain('<body data-kind="none" data-found="true">');
    const missing = renderPlace(store, todoApp, "/lists/nobody", { viewer: keeper, design });
    expect(missing.found).toBe(false);
    expect(missing.html).toContain('<body data-kind="none" data-found="false"><h1>Nothing lives at this address.</h1>');
  });

  it("reads every record of a kind, and one by id, through the same seat", () => {
    const store = todo();
    let counted = -1;
    let named = "";
    const list = store.graph.nodesOfKind("list")[0]!;
    renderPlace(store, todoApp, list.id, {
      viewer: keeper,
      design: {
        records: {
          list: (record, site) => {
            counted = site.records("task").length;
            named = site.record(record.id)?.title ?? "";
            return "";
          },
        },
      },
    });
    expect(counted).toBe(store.seenBy(keeper).graph.nodesOfKind("task").length);
    expect(named).toBeTruthy();
  });
});
