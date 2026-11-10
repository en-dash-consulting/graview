// @vitest-environment jsdom
import { createSchema, defineNode, imageField, Store, z, type AnySchema, type Principal } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkManifest, workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createGuestPictures, pictureRecordsOf, picturesChosen, PICTURES_SETTLE_MS, standInPictures, type GuestPictures } from "../../src/host/pictures.js";
import type { GuestFile, GuestProps } from "../../src/protocol.js";

/**
 * A VIEW CHOOSES ITS PICTURES BY RECORD (Roadmap f-view-pictures-by-record).
 * A view's pictures were chosen by kind or field, so a view of one champion
 * that reads every driver was handed 820 drivers' photos: past the 12 MB a
 * view's pictures may come to, and the one it drew left out. A manifest now
 * chooses by record too — `records: { subject: true }`, the record it is drawn over
 * and those an edge it reads links to it, or a list of record ids — and caps
 * them (`most`); only those are fetched, reckoned and handed an address,
 * the rest handed by their facts. `checkManifest` refuses a malformed choice
 * with its finding code (`view-pictures-records`, `view-pictures-most`).
 */
const driver = defineNode("driver", { fields: z.object({ label: z.string(), portrait: imageField().optional() }), plural: "Drivers", label: (node) => node.label });
const season = defineNode("season", {
  fields: z.object({ label: z.string() }),
  plural: "Seasons",
  label: (node) => node.label,
  edges: { champion: { to: ["driver"], cardinality: "one", description: "who won it", inverse: "the seasons they won" } },
});
const schema = createSchema([season, driver]);
const DRIVERS = 820;
/* Each photo as the record says it: 200 KB, 400 pixels across — 164 MB in all, fourteen times what a view is handed. */
const photo = (index: number) => ({ href: `/graview/files/driver-${index}.jpg`, name: `driver-${index}.jpg`, type: "image/jpeg", bytes: 200_000, width: 400, height: 500 });
const CHAMPION = 700;
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [{ id: "season:2008", kind: "season", label: "2008" }, ...Array.from({ length: DRIVERS }, (_, index) => ({ id: `driver:${index}`, kind: "driver", label: `Driver ${index}`, portrait: photo(index) }))],
      edges: [{ kind: "champion", from: "season:2008", to: `driver:${CHAMPION}` }],
    } as never,
  }) as unknown as Store<AnySchema>;
const viewer: Principal = { kind: "human", id: "person:nick", roles: [] };

/** A view of one season, reading every driver and who won it. */
const champion = (pictures: GuestPictures): WorkerViewManifest => ({ name: "champion", attach: "season", cardinality: "one", reads: { kinds: ["driver"], edges: ["champion"] }, pictures });
/** The home, reading every driver. */
const home = (pictures: GuestPictures): WorkerViewManifest => ({ name: "grid", attach: "home", cardinality: "many", reads: { kinds: ["driver"] }, pictures });
const propsOf = (manifest: WorkerViewManifest) => workerViewProps(store(), viewer, { manifest, input: manifest.attach === "home" ? {} : { node: { id: "season:2008" } } });

let fetched: string[] = [];
afterEach(() => vi.restoreAllMocks());
async function handed(manifest: WorkerViewManifest) {
  fetched = [];
  vi.spyOn(window, "fetch").mockImplementation(async (url) => {
    fetched.push(new URL(String(url)).pathname);
    return new Response(new Uint8Array(1_000), { status: 200, headers: { "content-type": "image/jpeg" } });
  });
  const told: string[] = [];
  const host = createGuestPictures(window, { as: "data", view: `"${manifest.name}"`, pictures: manifest.pictures!, moved: () => {}, onLeft: (said) => told.push(said), shrink: async (blob) => blob });
  const props = propsOf(manifest);
  host.hand(props);
  for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
  await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
  const out = host.hand(props);
  host.dispose();
  return { props: out, told };
}
const portrait = (props: GuestProps, id: string) => (props.nodes ?? []).find((node) => node.id === id)!["portrait"] as unknown as GuestFile;
const withSrc = (props: GuestProps) => (props.nodes ?? []).filter((node) => (node["portrait"] as GuestFile | undefined)?.src).map((node) => node.id);

describe("a view of one champion among 820 drivers with photos", () => {
  it("chose by kind, is handed photos past its budget in the order the drivers come, and the one it needs is left out", () => {
    const { props, left } = standInPictures(propsOf(home(["driver"])), { view: '"grid"', pictures: ["driver"], standIn: "data:x" });
    expect(withSrc(props).length).toBeLessThan(DRIVERS);
    expect(portrait(props, `driver:${CHAMPION}`).src).toBeUndefined();
    expect(left.length).toBeGreaterThan(0);
  });

  it('chose by its subject, records: { subject: true }, is handed the champion\'s photo alone, under the limit, and nothing else is fetched', async () => {
    const { props, told } = await handed(champion({ records: { subject: true } }));
    expect(withSrc(props)).toEqual([`driver:${CHAMPION}`]);
    expect(portrait(props, `driver:${CHAMPION}`).src).toMatch(/^data:image\/jpeg;base64,/);
    expect(fetched).toEqual([`/graview/files/driver-${CHAMPION}.jpg`]);
    expect(told).toEqual([]);
    /* The others are handed by their facts: the view can still say there is a photo. */
    expect(portrait(props, "driver:3")).toEqual({ name: "driver-3.jpg", type: "image/jpeg", bytes: 200_000, width: 400, height: 500 });
  });

  it("chose by id, is handed that driver's photo alone, from the home that reads them all", async () => {
    const { props } = await handed(home({ records: { ids: [`driver:${CHAMPION}`] } }));
    expect(withSrc(props)).toEqual([`driver:${CHAMPION}`]);
    expect(fetched).toEqual([`/graview/files/driver-${CHAMPION}.jpg`]);
  });

  it("capped, most: 3, is handed the first three in the order its records are handed, and is told once why the rest come without one", async () => {
    const { props, told } = await handed(home({ driver: "portrait", most: 3 }));
    expect(withSrc(props)).toEqual(["driver:0", "driver:1", "driver:2"]);
    expect(fetched).toHaveLength(3);
    expect(told).toEqual(['The view "grid" is handed at most 3 pictures ("most"), so those after, in the order its records are handed, come without an address.']);
    expect(portrait(props, "driver:3").left).toBe(told[0]);
  });

  it("is handed the same in a headless run as on the page", () => {
    const manifest = champion({ records: { subject: true } });
    const { props, left } = standInPictures(propsOf(manifest), { view: '"champion"', pictures: manifest.pictures!, standIn: "data:x" });
    expect(withSrc(props)).toEqual([`driver:${CHAMPION}`]);
    expect(left).toEqual([]);
  });
});

describe("the check of a view's pictures by record", () => {
  const sound = (manifest: WorkerViewManifest) => checkManifest(manifest, store());
  it("passes records by subject on a view of one, by id anywhere, both, and a cap", () => {
    expect(sound(champion({ records: { subject: true } }))).toEqual([]);
    expect(sound(home({ records: { ids: ["driver:1", "driver:2"] }, most: 2 }))).toEqual([]);
    expect(sound(champion({ width: 400, driver: "portrait", records: { subject: true, ids: ["driver:3"] }, most: 1 }))).toEqual([]);
  });

  it("refuses a malformed choice of records, naming its finding (view-pictures-records)", () => {
    for (const records of [5, true, {}, { subject: false }, { ids: [] }, { ids: [3] }, { ids: "driver:1" }, { subject: true, also: 1 }, { ids: Array.from({ length: 201 }, (_, index) => `driver:${index}`) }]) {
      const said = sound(champion({ records } as never));
      expect(said, JSON.stringify(records).slice(0, 40)).toHaveLength(1);
      expect(said[0]).toMatch(/\(view-pictures-records\)\.$/);
    }
  });

  it("refuses records by subject on a view drawn over no one record", () => {
    const said = sound(home({ records: { subject: true } }));
    expect(said).toEqual(['The view\'s pictures records { "subject": true } is the record a view of one is drawn over and the records linked to it: a view of many, or the home, is drawn over no one record, so list the records by "ids", or cap its pictures with "most" (view-pictures-records).']);
  });

  it("refuses a cap that is not a whole number from 1 to 500 (view-pictures-most)", () => {
    for (const most of [0, 1.5, 501, true]) expect(sound(home({ most } as never))).toEqual(["The view's pictures most is a whole number from 1 to 500: the most pictures it is handed, in the order its records are handed (view-pictures-most)."]);
  });
});

describe("a manifest written before records and most", () => {
  /* An app with kinds called `records` and `most`: what their pictures meant, they still mean. */
  const records = defineNode("records", { fields: z.object({ label: z.string(), photo: imageField().optional() }), plural: "Records" });
  const most = defineNode("most", { fields: z.object({ label: z.string(), portrait: imageField().optional() }), plural: "Mosts" });
  const archive = createSchema([records, most]);
  const archiveStore = () => new Store({ schema: archive, mutations: [] }) as unknown as Store<AnySchema>;
  const shelf = (pictures: GuestPictures): WorkerViewManifest => ({ name: "shelf", attach: "home", cardinality: "many", reads: { kinds: ["records", "most"] }, pictures });

  it("still chooses a kind called records by a field, and a kind called most by its fields, and the check passes them", () => {
    expect(checkManifest(shelf({ records: "photo" }), archiveStore())).toEqual([]);
    expect(checkManifest(shelf({ records: ["photo"], most: ["portrait"] }), archiveStore())).toEqual([]);
    const chosen = picturesChosen({ records: "photo", most: ["portrait"] });
    expect([chosen("records", "photo"), chosen("most", "portrait"), chosen("records", "other")]).toEqual([true, true, false]);
  });

  it("never reads a field list under records as record ids, nor chooses records by them", () => {
    const props = { view: "shelf", edges: [], acts: [], nodes: [] } as unknown as GuestProps;
    const any = pictureRecordsOf({ records: ["portrait"] }, props);
    expect([any("records:1"), any("portrait")]).toEqual([true, true]);
    expect(pictureRecordsOf({ records: "photo" }, props)("records:1")).toBe(true);
  });

  it("says what it said before of a kind called records that the app does not have", () => {
    expect(checkManifest(home({ records: "photo" }), store())).toEqual(['The view\'s pictures chooses "records", which is no kind of this app.']);
  });
});
describe("the page and a headless run", () => {
  it("leave out the same pictures, taking too heavy to fetch, then most, then the 12 MB weight, in the order the records are handed", async () => {
    /* A picture's place in line: 41 MB is more than the host fetches, so it takes no place; then three fit the cap, and the budget cuts before the cap would. */
    const weights = [300_000, 41_000_000, 400_000, 900_000, 200_000, 100_000, 50_000];
    const nodes = weights.map((bytes, index) => ({ id: `driver:${index}`, kind: "driver", label: `Driver ${index}`, portrait: { ...photo(index), bytes } }));
    const props = { view: "grid", edges: [], acts: [], nodes } as unknown as GuestProps;
    const limits = { picturesBytes: 1_000_000 };
    for (const pictures of [{ most: 3 }, { most: 2 }, { driver: "portrait" }] as GuestPictures[]) {
      const headless = standInPictures(props, { view: '"grid"', pictures, limits, standIn: "data:x" });
      vi.spyOn(window, "fetch").mockImplementation(async () => new Response(new Uint8Array(1_000), { status: 200, headers: { "content-type": "image/jpeg" } }));
      const left: string[] = [];
      const host = createGuestPictures(window, { as: "data", view: '"grid"', pictures, limits, moved: () => {}, onLeft: (said) => left.push(said), shrink: async (blob) => blob });
      host.hand(props);
      for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
      await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
      const page = host.hand(props);
      host.dispose();
      vi.restoreAllMocks();
      expect(withSrc(page), JSON.stringify(pictures)).toEqual(withSrc(headless.props));
      expect(nodes.map((node) => portrait(page, node.id).left ?? null), JSON.stringify(pictures)).toEqual(nodes.map((node) => portrait(headless.props, node.id).left ?? null));
      expect([...new Set(left)].sort()).toEqual([...headless.left].sort());
    }
  });
});
