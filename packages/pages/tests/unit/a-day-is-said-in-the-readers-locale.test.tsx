import { createSchema, defineNode, isoDate, sayIn, SCHEMES, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A DAY IS SAID IN THE READER'S LOCALE (FR-178). The eighth walk read "10
 * Sep 2023" in an app written for the United States. A page says a day the
 * way en-US does unless the app's brand says its own locale, and a host
 * that knows its reader passes theirs, which wins.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), due: isoDate, at: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", due: "2023-09-10", at: "2023-09-10T15:30" }] as never, edges: [] },
  });
const page = (context: Omit<PageContext<typeof schema>, "store">) => renderToStaticMarkup(<PagesApp context={{ store: store(), ...context }} initialPath="/tasks/t1" />);

afterEach(() => sayIn({}));

describe("a record's page", () => {
  it("says its day and its moment for en-US when nobody says otherwise", () => {
    const html = page({});
    expect(html).toContain("Sep 10, 2023");
    expect(html).toContain("Sep 10, 2023, 3:30 PM");
    expect(html).not.toMatch(/10 Sept? 2023/);
  });

  it("says them for the app's locale when its brand names one", () => {
    const html = page({ brand: { name: "Tasks", schemes: SCHEMES, locale: "en-GB" } });
    expect(html).toMatch(/10 Sept? 2023, 15:30/);
  });

  it("says them for the reader's locale a host passed, over the app's", () => {
    const html = page({ brand: { name: "Tasks", schemes: SCHEMES, locale: "en-US" }, locale: "en-GB" });
    expect(html).toMatch(/10 Sept? 2023, 15:30/);
    expect(html).not.toContain("Sep 10, 2023");
  });
});
