// @vitest-environment jsdom
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import tasks from "../../../core/tests/document/fixtures/tasks.gdd.json";
import { listStandsAsItIs } from "../../src/context-menu.js";
import { addressAsksForTheList } from "../../src/page-places.js";
import { createPageRegistry } from "../../src/registry.js";

/**
 * A KEPT OPTION MUST CHANGE THE PAGE. `pages.lists.<kind>.opens` is drawn by
 * the framework's list page, so what a design registered for a kind's list,
 * and the address that asks for the app's own list, stand as they are
 * whatever is kept: "Other ways to show this" is not offered on them.
 */
const compiled = compileDocument(tasks as never);
if (!compiled.ok) throw new Error("the tasks fixture compiles");
const schema = compiled.app.schema;
const Page = () => null;

describe("a list that opens as a place", () => {
  const asks = (search: string, edges: readonly string[] = [], flows = false) => addressAsksForTheList(new URLSearchParams(search), edges, flows);

  it("is the list again when the address narrows it, so Find and a link keep working", () => {
    for (const word of ["q=brief", "archived=true", "by=assigned-to", "with=assigned-to", "past=1", "sort=due", "group=status"]) expect(asks(`?${word}`), word).toBe(true);
    expect(asks("?assigned-to=p1", ["assigned-to"])).toBe(true);
  });

  it("stays the place at its plain address, and on a filter a picture narrows itself", () => {
    expect(asks("")).toBe(false);
    expect(asks("?assigned-to=p1")).toBe(false);
    expect(asks("?filter=status:doing")).toBe(false);
  });

  it("is the list again on a filter where the place flows, whose blocks would not narrow", () => {
    expect(asks("?filter=status:doing", [], true)).toBe(true);
  });
});

describe("a list a design replaces", () => {
  it("stands as it is, and the kinds the design left alone do not", () => {
    const stands = listStandsAsItIs(createPageRegistry(schema).register("task", "list", Page as never) as never, "");
    expect(stands("task")).toBe(true);
    expect(stands("person")).toBe(false);
  });

  it("is not what a design's record page or its shell alone replaces", () => {
    const stands = listStandsAsItIs(createPageRegistry(schema).register("task", "record", Page as never).surface("shell", Page as never) as never, "");
    expect(stands("task")).toBe(false);
  });

  it("is none where no design was handed in", () => {
    expect(listStandsAsItIs(undefined, "")("task")).toBe(false);
  });

  it("stands too at an address that narrows it, where a kept option would not be drawn", () => {
    expect(listStandsAsItIs(undefined, "?q=brief")("task")).toBe(true);
    expect(listStandsAsItIs(undefined, "?assigned-to=p1", () => ["assigned-to"])("task")).toBe(true);
    expect(listStandsAsItIs(undefined, "?drawn=nothing")("task")).toBe(false);
  });

  it("stands too at the address that asks for the list the app draws by itself", () => {
    expect(listStandsAsItIs(undefined, "?drawn=built-in")("task")).toBe(true);
  });
});
