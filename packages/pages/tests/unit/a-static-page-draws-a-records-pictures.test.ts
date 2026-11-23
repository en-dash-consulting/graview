import { createSchema, defineApp, defineNode, fileField, imageField, Store, videoField, z, type FileValue } from "@graview/core";
import { renderPlace } from "@graview/pages/static";
import { describe, expect, it } from "vitest";

/**
 * A STATIC PAGE DRAWS A RECORD'S PICTURES (HQ f-static-render-pictures-site-pdf).
 * `renderPlace` said a picture field by its file's name, so a host that
 * exported an app as a file drew its own grid of pictures beside the page.
 * Now the page draws them as the hosted page does — a record's pictures in
 * a gallery, its video from its poster, its document by the page its host
 * made of it, a list's first picture beside each name — at the address the
 * host serves each file at (`files.src`), as the hosted page is handed it.
 */

const porch: FileValue = { href: "/graview/files/porch.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 120_000, width: 1200, height: 800, caption: "The front porch", focus: { x: 0.25, y: 0.75 } };
const yard: FileValue = { href: "/graview/files/yard.png", name: "yard.png", type: "image/png", bytes: 80_000 };
const tour: FileValue = { href: "/graview/files/tour.mp4", name: "tour.mp4", type: "video/mp4", bytes: 9_000_000, poster: "/graview/files/tour.jpg", duration: 45 };
const deed: FileValue = { href: "/graview/files/deed.pdf", name: "deed.pdf", type: "application/pdf", bytes: 3_400_000, preview: { src: "/graview/files/deed-1.png", width: 600, height: 800 } };

const house = defineNode("house", {
  fields: z.object({ label: z.string(), photos: z.array(imageField()).optional(), tour: videoField().optional(), deed: fileField().optional() }),
  plural: "Houses",
});
const plot = defineNode("plot", { fields: z.object({ label: z.string(), photos: z.array(imageField()).optional() }), plural: "Plots" });
const schema = createSchema([house, plot]);
// A plot's card is declared, and draws its pictures where its `image` block stands.
const app = defineApp({ name: "listings", schema, viewSpecs: { plot: { row: [{ title: "{label}" }, { image: "photos", as: "thumb" }] } } });
const store = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "h1", kind: "house", label: "Elm Street", photos: [porch, yard], tour, deed },
        { id: "h2", kind: "house", label: "Oak Lane" },
        { id: "p1", kind: "plot", label: "North field", photos: [yard] },
      ] as never,
      edges: [],
    },
  });
// The host serves each file under its own base, as Graview Cloud does (`HostFiles.src`).
const files = { src: (href: string) => `https://cdn.example${href}` };

describe("a record's page", () => {
  it("draws its pictures in a gallery, each linked to itself full size, cut around its subject, said by its caption", () => {
    const { html } = renderPlace(store(), app, "/houses/h1", { files });
    expect(html).toContain('<ul class="gv-gallery" aria-label="Photos">');
    expect(html).toContain('<a href="https://cdn.example/graview/files/porch.jpg"><img src="https://cdn.example/graview/files/porch.jpg" alt="The front porch" width="1200" height="800"');
    expect(html).toContain('style="object-position: 25% 75%"');
    expect(html).toContain('src="https://cdn.example/graview/files/yard.png" alt="yard.png"');
    // Drawn, not said: the names are not a line of words where the pictures stand.
    expect(html).not.toContain("<dd>porch.jpg — The front porch, yard.png</dd>");
  });

  it("plays its video from its poster with the browser's controls, and draws its document by its first page, linked", () => {
    const { html } = renderPlace(store(), app, "/houses/h1", { files });
    expect(html).toContain('<video src="https://cdn.example/graview/files/tour.mp4" poster="https://cdn.example/graview/files/tour.jpg" controls');
    expect(html).toContain("0:45");
    expect(html).toContain('<a class="gv-preview" href="https://cdn.example/graview/files/deed.pdf"><img src="https://cdn.example/graview/files/deed-1.png" alt="deed.pdf, its first page" width="600" height="800"');
    expect(html).toContain('<a href="https://cdn.example/graview/files/deed.pdf">deed.pdf</a> <span class="gv-quiet">PDF · 3.4 MB</span>');
    // Still a static page: a player's controls are the browser's, and nothing runs.
    expect(html).not.toMatch(/<script|\son[a-z]+\s*=|<button|javascript:/i);
  });

  it("draws each file at the href the record keeps where the host says nowhere else", () => {
    const { html } = renderPlace(store(), app, "/houses/h1");
    expect(html).toContain('<img src="/graview/files/porch.jpg"');
    expect(html).toContain('poster="/graview/files/tour.jpg"');
  });

  it("keeps the pictures whole on a printed page", () => {
    const { css } = renderPlace(store(), app, "/houses/h1");
    expect(css).toMatch(/\.gv-gallery li \{[^}]*break-inside: avoid/);
  });
});

describe("a list", () => {
  it("draws each record's first picture beside its name, where its row is the derived one, and nothing for a record with none", () => {
    const { html } = renderPlace(store(), app, "/houses", { files });
    expect(html).toContain('<span class="gv-pictured"><img class="gv-thumb" src="https://cdn.example/graview/files/porch.jpg" alt="The front porch" width="56" height="56"');
    expect(html).toContain('<li><a href="/houses/h2">Oak Lane</a>');
  });

  it("draws a declared row's image block as its picture, small", () => {
    const { html } = renderPlace(store(), app, "/plots", { files });
    expect(html).toContain('<p class="gv-thumbs"><img class="gv-thumb" src="https://cdn.example/graview/files/yard.png" alt="yard.png" width="72" height="72"');
  });
});
