// @vitest-environment jsdom
import { createViews } from "@graview/react";
import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { describe, expect, it } from "vitest";
import tasks from "../../../core/tests/document/fixtures/tasks.gdd.json";
import { pageMayChange, pagePartOf, type PartHere } from "../../src/page-parts.js";
import { outlineOf, drawnSignature } from "../../src/page-better.js";

/**
 * MAKE ANY PAGE BETTER (Roadmap f-make-any-page-better): the menu names
 * the narrowest part of a built-in page the view spec says as one thing —
 * the list, never the record a row is; a group by its heading's own words;
 * every page of a kind; the home — and offers it only to a seat that may
 * change the app or give the page its own view.
 */
const compiled = compileDocument(tasks as never);
if (!compiled.ok) throw new Error("the tasks fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }], edges: [] } as never });
const owner = { kind: "human" as const, id: "p1", roles: ["owner"] };
const here = (more: Partial<PartHere> = {}): PartHere => ({ store, principal: owner, views: createViews(app.schema), keptViews: undefined, onProposeChange: () => "applied", composeChange: () => ({ ok: false, refused: "no" }), ...more }) as PartHere;

function page(): { main: HTMLElement; row: HTMLElement; groupHead: HTMLElement } {
  document.body.innerHTML = `<div data-graview-face="pages"><main data-graview-page-main=""><h1>Tasks</h1>
    <section data-testid="list-group"><h2 class="graview-group-head">Someday <span>3</span></h2><ul><li data-graview-record="t1"><a href="/tasks/t1">Write the brief</a></li></ul></section></main></div>`;
  return { main: document.querySelector("main")!, row: document.querySelector("li a")!, groupHead: document.querySelector("h2")! };
}

describe("a built-in page's part", () => {
  it("is the list on a row of it, never the record the row is", () => {
    const { row, main } = page();
    const part = pagePartOf({ about: ["aggregate:task"], at: row }, here());
    expect(part).toMatchObject({ name: "Tasks", slot: "list", kind: "task" });
    expect(part!.elements).toEqual([main]);
  });

  it("is the group on its heading, in the heading's own words", () => {
    const { groupHead } = page();
    expect(pagePartOf({ about: ["aggregate:task"], at: groupHead }, here())).toMatchObject({ name: "Someday", slot: "group", group: "Someday" });
  });

  it("is every page of the kind on a record's page, and the home on the home", () => {
    const { main } = page();
    expect(pagePartOf({ on: "t1", about: ["t1"], at: main }, here())).toMatchObject({ name: "Task page", slot: "record", record: "t1" });
    expect(pagePartOf({ about: [], home: true, at: main }, here())).toMatchObject({ name: "Home", slot: "home" });
    expect(pagePartOf({ about: [], at: main }, here())).toBeUndefined();
  });

  it("is offered to a seat that may change the app, and not to one that may not", () => {
    const { row } = page();
    const part = pagePartOf({ about: ["aggregate:task"], at: row }, here())!;
    expect(pageMayChange(part, here())).toBe(true);
    expect(pageMayChange(part, here({ principal: { kind: "human", id: "v", roles: ["viewer"] } }))).toBe(false);
    expect(pageMayChange(part, here({ onProposeChange: undefined }))).toBe(false);
  });

  it("is read as it stands: its headings and its rows, a line each", () => {
    const { main } = page();
    expect(outlineOf(main)).toBe("# Tasks\n## Someday\n- Write the brief");
    expect(drawnSignature(main)).toContain("Write the brief");
  });
});
