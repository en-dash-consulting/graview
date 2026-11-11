import { describe, expect, it } from "vitest";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { runWorkerViewForEachSeat, seatsOfPolicy } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { club, clubPolicy, member } from "./club.js";

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
    expect(by.parent!.unseen!.withheld).toEqual({ player: 0, memo: 1 });
    expect(by.visitor!.reads).toEqual({ kinds: ["memo"], fields: { player: ["phone"] } });
    expect(by.parent!.says).toContain("it reads phone of player, which this seat is not handed");
    expect(by.parent!.says).toContain("1 memo record is withheld from it");
    expect(checked.ok).toBe(true);
  });

  it("says a seat that sees nothing the view reads falls back, and is drawn the way in", async () => {
    const checked = await runWorkerViewForEachSeat({ store: club(), manifest: vendors, source: vendorsSource, run, owner: member });
    const outcomes = checked.seats.map((seat) => [seat.seat, seat.outcome, seat.reason ?? null]);
    expect(outcomes).toEqual([["owner", "drew", null], ["member", "drew", null], ["parent", "fell-back", "unseen"], ["visitor", "fell-back", "unseen"]]);
    expect(checked.text).toContain("visitor: falls back — vendor is kept from this seat");
  });

  it("runs as the seats the host hands, and says one that is stopped", async () => {
    const checked = await runWorkerViewForEachSeat({ store: club(), manifest: vendors, source: "throw new Error('no vendors');", run, seats: [{ name: "member", principal: member }] });
    expect(checked.seats.map((seat) => [seat.seat, seat.outcome, seat.reason])).toEqual([["member", "stopped", "error"]]);
    expect(checked.ok).toBe(false);
  });
});
