// @vitest-environment jsdom
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A FORM NAMES ITS PARTS, and an app's own selector reaches them.
 *
 * Every field, label, picker and submit was styled inline, so a product's
 * design could restyle a form only with `!important` — an inline style
 * beats every selector there is. Each part now says what it is in
 * `data-graview-part`, and its look is a rule of one element's weight
 * rather than a style attribute: `[data-graview-part="control"]` in the
 * app's sheet wins, and with no sheet the form looks as it did.
 */
const bed = defineNode("bed", { fields: z.object({ label: z.string() }), plural: "Beds" });
const schema = createSchema([bed]);
const { defineMutation } = bindSchema(schema);
const sow = defineMutation("sow", {
  title: "Sow something",
  input: z.object({
    bed: nodeRef(["bed"]),
    crop: z.string(),
    rows: z.number().min(1).max(12),
    depth: z.enum(["shallow", "deep"]),
    covered: z.boolean().optional(),
    companions: z.array(z.string()).optional(),
  }),
  apply: () => undefined,
});
const store = new Store({
  schema,
  mutations: [sow],
  snapshot: { nodes: [{ id: "bed-1", kind: "bed", label: "North Bed" }], edges: [] },
});

const drawn = () => {
  document.body.innerHTML = renderToStaticMarkup(<DerivedForm store={store} mutation={sow} />);
  return document.body;
};
const parts = (root: Element, part: string) => [...root.querySelectorAll(`[data-graview-part="${part}"]`)];
afterEach(() => {
  document.body.innerHTML = "";
});

describe("a form names its parts", () => {
  it("marks the form, each field, its label, its control and the submit", () => {
    const root = drawn();
    expect(parts(root, "form")).toHaveLength(1);
    expect(parts(root, "field").map((field) => field.getAttribute("data-graview-field"))).toEqual([
      "node",
      "text",
      "number",
      "choice",
      "boolean",
    ]);
    /* A field's label and its control are inside the field they belong to. */
    for (const field of parts(root, "field")) {
      expect(parts(field, "label")).toHaveLength(1);
      expect(parts(field, "control")).toHaveLength(1);
    }
    expect(parts(root, "picker")).toHaveLength(2);
    expect(parts(root, "group").map((group) => group.getAttribute("data-graview-field"))).toEqual(["list"]);
    expect(parts(root, "add")).toHaveLength(1);
    expect(parts(root, "submit").map((button) => button.textContent)).toEqual(["Sow something"]);
  });

  it("styles its parts with rules an app's selector outranks, not with style attributes", () => {
    const root = drawn();
    const marked = [...root.querySelectorAll("[data-graview-part]")];
    expect(marked.length).toBeGreaterThan(10);
    expect(marked.filter((element) => element.hasAttribute("style")).map((element) => element.getAttribute("data-graview-part"))).toEqual([]);
  });

  it("looks as it did with no sheet of the app's own: a control is still a target", () => {
    const root = drawn();
    const [text] = parts(root, "control").filter((control) => control.getAttribute("type") === "text");
    const style = getComputedStyle(text!);
    expect(style.minHeight).toBe("24px");
    expect(style.padding).toBe("7px 10px");
    const [picker] = root.querySelectorAll('[data-graview-part="picker"] > select');
    expect(getComputedStyle(picker!).paddingRight).toBe("28px");
  });
});
