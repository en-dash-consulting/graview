import { describe, expect, it } from "vitest";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { runWorkerViewForEachSeat, seatsOfPolicy } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { club, clubPolicy, member, parent } from "./club.js";

/*
 * A VIEW'S CHECK DRAWS IT AS EACH SEAT (Roadmap
 * f-view-check-draws-for-each-seat). The headless run that checks a
 * proposed view ran as its author, so a view that drew well for its owner
 * and fell back for a visitor passed. It now runs as each seat the app's
 * policy names — the owner, each role, a visitor where the app has one —
 * or the seats the host hands, and says for each whether it drew, fell
 * back or was stopped, and what it reads that the seat is not handed.
 */
const run = nodeIsolate();
const players: WorkerViewManifest = { name: "the-players", title: "The players", attach: "player", cardinality: "many", reads: { kinds: ["memo"] } };
const playersSource = `graview.onProps((props) => graview.render(graview.html\`<ul>\${(props.nodes || []).filter((n) => n.kind === "player").map((n) => graview.html\`<li>\${n.label} \${n.phone || ""}</li>\`)}</ul>\`));`;
const vendors: WorkerViewManifest = { name: "the-vendors", title: "The vendors", attach: "vendor", cardinality: "many" };
const vendorsSource = `graview.onProps((props) => graview.render(graview.html\`<ul>\${(props.nodes || []).map((n) => graview.html\`<li>\${n.label}</li>\`)}</ul>\`));`;

describe("a view's check, as each seat", () => {
  it("names the owner, each role and the visitor the app's policy has", () => {
    expect(seatsOfPolicy(clubPolicy, member).map((seat) => seat.name)).toEqual(["owner", "member", "parent", "visitor"]);
    expect(seatsOfPolicy(clubPolicy, member).find((seat) => seat.name === "parent")!.principal).toEqual({ kind: "human", id: "view-as:parent", roles: ["parent"] });
    expect(seatsOfPolicy(undefined, member).map((seat) => seat.name)).toEqual(["owner"]);
  });

  it("says for each seat whether it drew, and what it reads that the seat is not handed", async () => {
    const checked = await runWorkerViewForEachSeat({ store: club(), manifest: players, source: playersSource, run, owner: member });
    const by = Object.fromEntries(checked.seats.map((seat) => [seat.seat, seat]));
    expect(checked.seats.map((seat) => [seat.seat, seat.outcome])).toEqual([["owner", "drew"], ["member", "drew"], ["parent", "drew"], ["visitor", "drew"]]);
    expect(by.owner!.reads).toEqual({ kinds: [], fields: {} });
    expect(by.parent!.reads).toEqual({ kinds: [], fields: { player: ["phone"] } });
    // What the seat is kept from, and nothing of any record: no count of what it is handed none of.
    expect(by.parent!.unseen).toEqual({ kinds: [], fields: { player: ["phone"], memo: ["code"] } });
    expect(by.visitor!.reads).toEqual({ kinds: ["memo"], fields: { player: ["phone"] } });
    expect(by.parent!.says).toContain("it reads phone of player, which this seat is not handed");
    expect(by.parent!.says).not.toMatch(/withheld|\d+ memo/);
    expect(checked.ok).toBe(true);
  });

  it("says a seat that sees nothing the view reads falls back, and is drawn the way in", async () => {
    const checked = await runWorkerViewForEachSeat({ store: club(), manifest: vendors, source: vendorsSource, run, owner: member });
    const outcomes = checked.seats.map((seat) => [seat.seat, seat.outcome, seat.reason ?? null]);
    expect(outcomes).toEqual([["owner", "drew", null], ["member", "drew", null], ["parent", "fell-back", "unseen"], ["visitor", "fell-back", "unseen"]]);
    expect(checked.text).toContain("visitor: falls back — vendor is kept from this seat");
  });

  it("lets go of what it kept for each seat it made up once the run is done, and keeps the owner's", async () => {
    const store = club();
    const seats = seatsOfPolicy(clubPolicy, member);
    const before = new Map(seats.map((seat) => [seat.name, store.seenBy(seat.principal)]));
    await runWorkerViewForEachSeat({ store, manifest: players, source: playersSource, run, owner: member });
    expect(store.seenBy(member)).toBe(before.get("owner"));
    for (const name of ["parent", "visitor"]) expect(store.seenBy(seats.find((seat) => seat.name === name)!.principal), name).not.toBe(before.get(name));
  });

  it("keeps what is kept for a seat the host hands", async () => {
    const store = club();
    const before = store.seenBy(parent);
    await runWorkerViewForEachSeat({ store, manifest: players, source: playersSource, run, seats: [{ name: "parent", principal: parent }] });
    expect(store.seenBy(parent)).toBe(before);
  });

  it("runs as the seats the host hands, and says one that is stopped", async () => {
    const checked = await runWorkerViewForEachSeat({ store: club(), manifest: vendors, source: "throw new Error('no vendors');", run, seats: [{ name: "member", principal: member }] });
    expect(checked.seats.map((seat) => [seat.seat, seat.outcome, seat.reason])).toEqual([["member", "stopped", "error"]]);
    expect(checked.ok).toBe(false);
  });
});
