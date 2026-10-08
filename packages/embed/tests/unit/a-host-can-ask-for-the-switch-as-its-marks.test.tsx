// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed, preload } from "../../src/index.js";

beforeAll(() => preload());

/**
 * THE SWITCH AS ITS MARKS ALONE, ASKED FOR BY THE HOST. The box a host
 * gives an app is the host's to know: a landing page's narrow box, or a
 * page that already says what the faces are, asks for `switch: "icons"`
 * and the bar draws the scene's and the pages' marks without their words
 * at every width — the words still the buttons' names and titles. Left
 * alone, the switch says its words where the bar has room.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const schema = createSchema([plot]);
const app = defineApp({ name: "Seedbed", schema, mutations: [] });

async function bar(options: { readonly switch?: "words" | "icons" }) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<Embed app={app} face="pages" fonts={false} {...options} />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  const group = host.querySelector('[data-testid="app-faces"]');
  const said = {
    form: group?.getAttribute("data-switch"),
    names: [...(group?.querySelectorAll("button") ?? [])].map((button) => button.textContent),
    titles: [...(group?.querySelectorAll("button") ?? [])].map((button) => button.getAttribute("title")),
  };
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("the switch a host asks for", () => {
  it("is drawn as its marks alone when the host says `switch: \"icons\"`, its words its names", async () => {
    expect(await bar({ switch: "icons" })).toEqual({ form: "icons", names: ["Scene", "Pages"], titles: ["Scene", "Pages"] });
  });

  it("says its words where there is room when the host says nothing", async () => {
    expect((await bar({})).form).toBe("words");
  });
});
