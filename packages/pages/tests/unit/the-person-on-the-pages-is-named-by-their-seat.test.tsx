import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/*
 * The journeys' verdict on main read "user-lena — you, your seat and your
 * settings" on the pages of the discography, and "u-4f1c9a" on the
 * gauntlet's, on every job: the app handed the routed face its seats, the
 * face read them for its history, and the provider it draws the bar under
 * was never given them — so the person's button named a principal id.
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs" });
const schema = createSchema([song]);
const Shelf: ViewComponent<typeof schema> = ({ nodes }) => <div>{nodes?.length ?? 0}</div>;

describe("the person on the pages", () => {
  it("is named by the seat the app offered them under, never by a principal id", () => {
    const principal = { kind: "human" as const, id: "user-lena", roles: ["label"] };
    const html = renderToStaticMarkup(
      <PagesApp
        context={
          {
            store: new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "s1", kind: "song", label: "Hometown" }] as never, edges: [] } }),
            views: createViews(schema).register("song", { cardinality: "many", fidelity: "full" }, Shelf),
            principal,
            seats: [{ label: "Lena, the label", principal }],
          } as PageContext<typeof schema>
        }
        initialPath="/"
      />,
    );
    expect(html).toContain('data-testid="profile-button"');
    expect(html).toContain("Lena, the label — you, your seat and your settings");
    expect(html).not.toContain("user-lena");
  });
});
