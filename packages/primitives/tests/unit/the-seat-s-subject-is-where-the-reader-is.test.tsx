import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, withFocus, withWithin } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews, useSubject } from "../../src/index.js";

/**
 * WHAT "THIS" MEANS TO THE SEAT, read from where the reader already is:
 * the selection when there is one, else what the pointer has settled on,
 * else the place being looked at — so the conversation and the reader
 * cannot disagree about what a message means.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([task, note]);
bindSchema(schema);
const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit" }, { id: "t2", kind: "task", label: "Book the van" }] as never, edges: [] },
  });

function Said() {
  const subject = useSubject();
  return <p data-id={subject.id ?? ""} data-because={subject.because}>{subject.name}</p>;
}

const draw = (view = EMPTY_VIEW, selection: readonly string[] = []) =>
  renderToStaticMarkup(
    <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={view} initialSelection={selection}>
      <Said />
    </GraviewProvider>,
  );

describe("the seat's subject is what the reader chose, else where they are", () => {
  it("is the whole thing when nothing is chosen and nothing is pointed at", () => {
    const html = draw();
    expect(html).toContain('data-because="place"');
    expect(html).toContain("the whole thing");
  });

  it("is the selection when there is one, by the thing's own name", () => {
    const html = draw(EMPTY_VIEW, ["t1"]);
    expect(html).toContain('data-because="selection"');
    expect(html).toContain('data-id="t1"');
    expect(html).toContain("Pay the deposit");
  });

  it("says how many more when several are chosen", () => {
    expect(draw(EMPTY_VIEW, ["t1", "t2"])).toContain("Book the van and 1 more");
  });

  it("is the place you are looking at, by its registered name", () => {
    const html = draw(withWithin(withFocus(EMPTY_VIEW, "aggregate:task"), "view", "the-list"), []);
    expect(html).toContain('data-because="place"');
    expect(html).toContain("Tasks");
  });

  it("names a group of several kinds by their plurals, never by its id", () => {
    const html = draw(withFocus(EMPTY_VIEW, "aggregate:note+task"), []);
    expect(html).toContain("Notes and Tasks");
    expect(html.replace(/<[^>]*>/g, " ")).not.toContain("note+task");
  });
});
