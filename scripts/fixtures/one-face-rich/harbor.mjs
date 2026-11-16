/**
 * THE HARBOR: a second rich app for the one face's Nearby (Graview HQ
 * feature:f-one-face-home-nearby-reads-at-size).
 *
 * Deep Time's shape — eleven kinds and four views that are places over a
 * kind's records — laid out the other way: a shallower map, four columns of
 * districts rather than seven. Beside the page at Nearby the
 * home drew it at the camera's furthest, its plots three fifths of the
 * Map's, and on a short window (844×390) fitted it whole there, as the
 * city Graview Cloud's retests found was: at a size its plots and boards
 * could not be read at. Made
 * here, deterministically. Not an example app: `verify-one-face` serves it
 * from the same host page as Deep Time, at `?app=harbor`.
 */

let state = 29;
const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (list) => list[Math.floor(rand() * list.length)];

const named = (noun, plural, description, fields = {}, edges = {}, describe) => ({
  noun,
  plural,
  label: "{name}",
  description,
  fields: { name: { type: "string", required: true }, ...fields },
  ...(describe ? { describe } : {}),
  ...(Object.keys(edges).length > 0 ? { edges } : {}),
});
const one = (to, description, inverse) => ({ to: [to], cardinality: "one", description, inverse });

export const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Harbor",
  description: "A working harbor: its quays and berths, the lines and the ships that call, what they carry and where it waits, and who works the cranes.",
  kinds: {
    quay: named("quay", "quays", "A stretch of the harbor's edge."),
    line: named("line", "lines", "A shipping company whose ships call here."),
    commodity: named("commodity", "commodities", "A kind of goods the harbor handles.", { hazardous: { type: "boolean" } }),
    berth: named("berth", "berths", "A place along a quay a ship ties up.", { depthM: { type: "number" } }, { on: one("quay", "the quay it is on", "its berths") }, "{depthM} m deep"),
    shed: named("shed", "sheds", "A warehouse behind a quay.", {}, { behind: one("quay", "the quay it stands behind", "its sheds") }),
    ship: named("ship", "ships", "A ship that calls at the harbor.", { flag: { type: "string" } }, { of: one("line", "the line that runs it", "its ships") }, "{flag}"),
    call: named("call", "calls", "One ship's stay at a berth.", { status: { type: "enum", options: ["expected", "alongside", "sailed"], default: "expected", required: true } }, { by: one("ship", "the ship calling", "its calls"), at: one("berth", "where it ties up", "the calls here") }, "{status}"),
    crane: named("crane", "cranes", "A crane along a berth.", {}, { along: one("berth", "the berth it works", "its cranes") }),
    consignment: named("consignment", "consignments", "Goods landed together.", {}, { of: one("commodity", "what it is", "its consignments"), in: one("shed", "where it waits", "what waits here") }),
    docker: named("docker", "dockers", "Somebody who works the harbor.", {}, { crewOf: one("crane", "the crane they drive", "who drives it") }),
    inspection: named("inspection", "inspections", "A customs look at a ship.", {}, { aboard: one("ship", "the ship looked at", "its inspections") }),
  },
  acts: {
    "add-call": { creates: "call", title: "Expect a ship", description: "Say a ship is coming to a berth." },
  },
};

const nodes = [];
const edges = [];
let edge = 0;
const link = (kind, from, to) => edges.push({ id: `e${++edge}`, kind, from, to });
const add = (kind, id, fields) => nodes.push({ id, kind, ...fields });
const count = { quay: 5, line: 12, commodity: 14, berth: 24, shed: 16, ship: 40, call: 60, crane: 20, consignment: 40, docker: 30, inspection: 18 };

for (let i = 0; i < count.quay; i++) add("quay", `quay-${i}`, { name: `${["North", "South", "East", "Long", "Coal"][i]} Quay` });
for (let i = 0; i < count.line; i++) add("line", `line-${i}`, { name: `${pick(["Blue", "Gull", "Anchor", "Tidewater", "Polar", "Amber"])} ${pick(["Line", "Shipping", "Lines", "Freight"])} ${i + 1}` });
const GOODS = ["Grain", "Timber", "Coal", "Steel coil", "Coffee", "Cocoa", "Fertilizer", "Cement", "Paper", "Wool", "Fruit", "Fish meal", "Salt", "Machinery"];
GOODS.forEach((name, i) => add("commodity", `commodity-${i}`, { name, hazardous: i % 5 === 2 }));
for (let i = 0; i < count.berth; i++) {
  add("berth", `berth-${i}`, { name: `Berth ${i + 1}`, depthM: 8 + (i % 7) });
  link("on", `berth-${i}`, `quay-${i % count.quay}`);
}
for (let i = 0; i < count.shed; i++) {
  add("shed", `shed-${i}`, { name: `Shed ${String.fromCharCode(65 + i)}` });
  link("behind", `shed-${i}`, `quay-${i % count.quay}`);
}
const SHIPS = ["Albatross", "Bittern", "Cormorant", "Dunlin", "Eider", "Fulmar", "Gannet", "Heron", "Ibis", "Jaeger", "Kittiwake", "Lapwing", "Merlin", "Nightjar", "Osprey", "Petrel", "Quail", "Redshank", "Shearwater", "Tern"];
for (let i = 0; i < count.ship; i++) {
  add("ship", `ship-${i}`, { name: `${SHIPS[i % SHIPS.length]}${i >= SHIPS.length ? " II" : ""}`, flag: pick(["Norway", "Panama", "Liberia", "Malta", "Denmark", "Greece"]) });
  link("of", `ship-${i}`, `line-${Math.floor(rand() * count.line)}`);
}
for (let i = 0; i < count.call; i++) {
  add("call", `call-${i}`, { name: `Call ${200 + i}`, status: pick(["expected", "alongside", "sailed"]) });
  link("by", `call-${i}`, `ship-${Math.floor(rand() * count.ship)}`);
  link("at", `call-${i}`, `berth-${Math.floor(rand() * count.berth)}`);
}
for (let i = 0; i < count.crane; i++) {
  add("crane", `crane-${i}`, { name: `Crane ${i + 1}` });
  link("along", `crane-${i}`, `berth-${Math.floor(rand() * count.berth)}`);
}
for (let i = 0; i < count.consignment; i++) {
  add("consignment", `consignment-${i}`, { name: `Lot ${7000 + i * 3}` });
  link("of", `consignment-${i}`, `commodity-${Math.floor(rand() * count.commodity)}`);
  link("in", `consignment-${i}`, `shed-${Math.floor(rand() * count.shed)}`);
}
const PEOPLE = ["Ada", "Bram", "Cora", "Dev", "Esme", "Finn", "Gus", "Hana", "Ivo", "Jun", "Kit", "Lior", "Maud", "Nils", "Oona"];
for (let i = 0; i < count.docker; i++) {
  add("docker", `docker-${i}`, { name: `${PEOPLE[i % PEOPLE.length]} ${pick(["Hale", "Moss", "Reed", "Stone", "Wade", "Frost"])}` });
  link("crewOf", `docker-${i}`, `crane-${Math.floor(rand() * count.crane)}`);
}
for (let i = 0; i < count.inspection; i++) {
  add("inspection", `inspection-${i}`, { name: `Inspection ${i + 1}` });
  link("aboard", `inspection-${i}`, `ship-${Math.floor(rand() * count.ship)}`);
}

export const seed = { nodes, edges };

/* THE FOUR VIEWS: each a place over one kind's records, as Deep Time's four are. */
const listView = (heading, kind) => `graview.onProps((props) => {
  const rows = props.nodes.filter((node) => node.kind === ${JSON.stringify(kind)});
  graview.render(graview.html\`<section aria-labelledby="h"><h2 id="h">${heading}</h2><ul>\${rows.slice(0, 40).map((row) => graview.html\`<li data-key="\${row.id}"><a data-record="\${row.id}">\${row.label}</a></li>\`)}</ul></section>\`);
});
`;
const place = (name, title, attach, heading) => ({ manifest: { name, title, attach, cardinality: "many" }, worker: { source: listView(heading, attach) } });

export const workerViews = [
  place("arrivals", "Arrivals", "call", "Who is coming in, and where they tie up"),
  place("fleet", "Fleet", "ship", "Every ship that calls here"),
  place("yard", "Yard", "consignment", "What waits in the sheds"),
  place("cranes", "Crane board", "crane", "Which crane works which berth"),
];
