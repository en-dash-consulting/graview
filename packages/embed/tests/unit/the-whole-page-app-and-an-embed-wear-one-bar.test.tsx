// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews, Shell } from "@graview/primitives";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

beforeAll(() => preload());

/**
 * THE WHOLE-PAGE APP AND AN EMBED WEAR ONE BAR ON THE SCENE.
 *
 * The Shell drew a bar of its own on the scene — a wordmark, back and
 * forward arrows, "Lists", the trail, the places as tabs, Find, the
 * standing, Activity and the person — while an embed's scene face wore the
 * one `AppBar`. The same app looked like two apps, and on a phone the
 * Shell's bar wrapped to three rows. Now both draw the `AppBar` with the
 * same parts under the same test ids, the scene's Find and Activity put in
 * it the same way, and what the picture is doing on the picture.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const addNote = defineMutation("add-note", {
  title: "Add a note",
  description: "Bring a note in.",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: `note-${args.label}`, kind: "note", label: args.label } as never);
  },
});
const app = defineApp({ name: "Field notes", schema, mutations: [addNote] });
const snapshot = { nodes: [{ id: "n1", kind: "note", label: "First" }], edges: [] } as never;
const store = () => new Store({ schema, mutations: [addNote], invariants: [], snapshot });
const views = () => registerDefaultViews(schema, createViews(schema));

/** The test ids on the bar, in the order it draws them. */
const barIds = (host: Element) => [...(host.querySelector('[data-testid="app-bar"]')?.querySelectorAll("[data-testid]") ?? [])].map((el) => el.getAttribute("data-testid"));

const settle = async (host: Element) => {
  for (let turn = 0; turn < 200 && !host.querySelector('[data-testid="app-find"] input'); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
};

async function shell(given: Store<typeof schema>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={given} views={views()} initialView={{ ...EMPTY_VIEW, overview: true }} brand={{ name: "Field notes" } as never}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    ),
  );
  await settle(host);
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}

async function embed(given: Store<typeof schema>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, fonts: false, face: "scene", store: given } as unknown as EmbedOptions);
  });
  await settle(host);
  return { host, done: async () => { await act(async () => handle!.unmount()); host.remove(); sessionStorage.clear(); } };
}

describe("the whole-page app and an embed wear one bar on the scene", () => {
  it("draws the same parts under the same test ids, and none of the old bar's", async () => {
    const whole = await shell(store());
    const inEmbed = await embed(store());
    try {
      const said = barIds(whole.host);
      expect(said).toEqual(barIds(inEmbed.host));
      for (const id of ["app-home", "app-name", "app-faces", "app-face-scene", "app-face-pages", "app-find", "standing", "profile-button"]) expect(said, id).toContain(id);
      expect(whole.host.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed")).toBe("true");
      // The Find box is the scene's own, in the bar's place for it.
      expect(whole.host.querySelector('[data-testid="app-find"] [data-testid="find-box"], [data-testid="app-find"] input')).not.toBeNull();
      for (const gone of ["wordmark", "backtrack", "pages-link", "places"]) expect(whole.host.querySelector(`[data-testid="${gone}"]`), gone).toBeNull();
      // One heading names the app, on the bar.
      expect([...whole.host.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Field notes"]);
    } finally {
      await whole.done();
      await inEmbed.done();
    }
  });

  it("puts Activity on both bars once something has happened, before the standing", async () => {
    const one = store();
    const two = store();
    const whole = await shell(one);
    const inEmbed = await embed(two);
    try {
      expect(whole.host.querySelector('[data-testid="activity-button"]')).toBeNull();
      expect(inEmbed.host.querySelector('[data-testid="activity-button"]')).toBeNull();
      await act(async () => {
        one.apply({ name: "add-note", args: { label: "Second" } });
        two.apply({ name: "add-note", args: { label: "Second" } });
      });
      for (const host of [whole.host, inEmbed.host]) {
        const ids = barIds(host);
        expect(ids).toContain("activity-button");
        expect(ids.indexOf("activity-button")).toBeLessThan(ids.indexOf("standing"));
      }
      expect(barIds(whole.host)).toEqual(barIds(inEmbed.host));
    } finally {
      await whole.done();
      await inEmbed.done();
    }
  });
});
