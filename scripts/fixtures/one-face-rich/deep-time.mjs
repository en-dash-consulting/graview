/**
 * DEEP TIME, AT ITS SIZE: a rich app for the one face's City and Nearby
 * (Graview HQ feature:f-one-face-city-reads-clean).
 *
 * Shaped like the copy of Cloud's Deep Time demo the one face looked bad
 * on: eleven kinds, about three hundred records, and ten worker views —
 * four of them places over a kind's records, six of them a kind's record
 * page drawn in place of the framework's (`replaces: "page"`). Made here,
 * deterministically, so a screenshot taken before a change and one after
 * are of the same graph. Not an example app: `verify-one-face` bundles it
 * into a host page of its own.
 */

let state = 11;
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
const many = (to, description, inverse) => ({ to: [to], description, inverse });

export const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Deep Time",
  description: "The history of life on Earth: the eons, eras, periods and epochs, what lived in them and where it was dug up, and who dug it.",
  kinds: {
    eon: named("eon", "eons", "The longest span of the rock record."),
    era: named("era", "eras", "A span of an eon.", {}, { partOf: one("eon", "the eon it is part of", "its eras") }),
    period: named("period", "periods", "A span of an era.", { startsMa: { type: "number" } }, { partOf: one("era", "the era it is part of", "its periods") }, "{startsMa} million years ago"),
    epoch: named("epoch", "epochs", "A span of a period.", {}, { partOf: one("period", "the period it is part of", "its epochs") }),
    event: named("event", "events", "Something that happened to the whole Earth: an extinction, an ice age, a collision.", { severity: { type: "enum", options: ["minor", "major", "mass"], default: "minor", required: true } }, { during: one("epoch", "when it happened", "what happened then") }, "{severity}"),
    species: named("species", "species", "A kind of living thing known from its fossils.", { diet: { type: "enum", options: ["plants", "meat", "both", "filter"] } }, { livedIn: one("period", "when it lived", "what lived then"), foundAt: many("site", "where it was found", "what was found here") }, "{diet}"),
    site: named("site", "sites", "A place fossils come out of the ground.", { country: { type: "string" } }, { inFormation: one("formation", "the rock it is in", "where it is dug") }, "{country}"),
    formation: named("formation", "formations", "A body of rock laid down at one time.", { rock: { type: "enum", options: ["shale", "limestone", "sandstone", "mudstone", "chalk"] } }, { laidIn: one("period", "when it was laid down", "the rock laid down then") }, "{rock}"),
    researcher: named("researcher", "researchers", "Somebody who digs and describes fossils."),
    expedition: named("expedition", "expeditions", "A season's dig.", { year: { type: "number" } }, { ledBy: one("researcher", "who led it", "the digs they led"), visited: many("site", "where it dug", "the digs that came here") }, "{year}"),
    specimen: named("specimen", "specimens", "One fossil, catalogued.", { catalog: { type: "string" } }, { of: one("species", "what it is", "its specimens"), dugAt: one("site", "where it came out of the ground", "what came out of the ground here") }, "{catalog}"),
  },
  acts: {
    "add-species": { creates: "species", title: "Add a species", description: "Name a species known from its fossils." },
    "add-specimen": { creates: "specimen", title: "Catalogue a specimen", description: "Put a fossil in the catalogue." },
  },
};

const nodes = [];
const edges = [];
let edge = 0;
const link = (kind, from, to) => edges.push({ id: `e${++edge}`, kind, from, to });
const add = (kind, id, fields) => nodes.push({ id, kind, ...fields });

const EONS = ["Hadean", "Archean", "Proterozoic", "Phanerozoic"];
EONS.forEach((name, i) => add("eon", `eon-${i}`, { name }));
const ERAS = ["Eoarchean", "Paleoarchean", "Mesoarchean", "Neoarchean", "Paleoproterozoic", "Mesoproterozoic", "Neoproterozoic", "Paleozoic", "Mesozoic", "Cenozoic"];
ERAS.forEach((name, i) => {
  add("era", `era-${i}`, { name });
  link("partOf", `era-${i}`, `eon-${i < 4 ? 1 : i < 7 ? 2 : 3}`);
});
const PERIODS = ["Siderian", "Rhyacian", "Orosirian", "Statherian", "Calymmian", "Ectasian", "Stenian", "Tonian", "Cryogenian", "Ediacaran", "Cambrian", "Ordovician", "Silurian", "Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"];
const STARTS = [2500, 2300, 2050, 1800, 1600, 1400, 1200, 1000, 720, 635, 539, 485, 444, 419, 359, 299, 252, 201, 145, 66, 23, 2.6];
PERIODS.forEach((name, i) => {
  add("period", `period-${i}`, { name, startsMa: STARTS[i] });
  link("partOf", `period-${i}`, `era-${i < 4 ? 4 : i < 7 ? 5 : i < 10 ? 6 : i < 16 ? 7 : i < 19 ? 8 : 9}`);
});
const EPOCHS = ["Terreneuvian", "Furongian", "Early Ordovician", "Late Ordovician", "Llandovery", "Wenlock", "Ludlow", "Pridoli", "Early Devonian", "Middle Devonian", "Late Devonian", "Mississippian", "Pennsylvanian", "Cisuralian", "Guadalupian", "Lopingian", "Early Triassic", "Middle Triassic", "Late Triassic", "Early Jurassic", "Middle Jurassic", "Late Jurassic", "Early Cretaceous", "Late Cretaceous", "Paleocene", "Eocene", "Oligocene", "Miocene", "Pliocene", "Pleistocene", "Holocene", "Lower Cambrian", "Middle Cambrian", "Upper Cambrian"];
EPOCHS.forEach((name, i) => {
  add("epoch", `epoch-${i}`, { name });
  link("partOf", `epoch-${i}`, `period-${10 + Math.min(11, Math.floor((i * 12) / EPOCHS.length))}`);
});
const EVENTS = ["Cambrian explosion", "End-Ordovician extinction", "Late Devonian extinction", "Great Dying", "End-Triassic extinction", "Chicxulub impact", "Paleocene–Eocene Thermal Maximum", "Great Oxidation", "Snowball Earth", "Carboniferous rainforest collapse", "Grande Coupure", "Messinian salinity crisis", "Great American Interchange", "Last Glacial Maximum", "Siberian Traps", "Deccan Traps", "Toarcian anoxic event", "Hirnantian glaciation", "Lau event", "Capitanian extinction"];
EVENTS.forEach((name, i) => {
  add("event", `event-${i}`, { name, severity: i < 6 ? "mass" : i < 13 ? "major" : "minor" });
  link("during", `event-${i}`, `epoch-${Math.floor(rand() * EPOCHS.length)}`);
});
const FIRST = ["Tyranno", "Stego", "Tricera", "Brachio", "Allo", "Ankylo", "Diplo", "Spino", "Velociraptor", "Archaeo", "Ptero", "Plesio", "Ichthyo", "Mosa", "Dimetro", "Trilo", "Anomalo", "Hallucigen", "Opabin", "Dunkleo", "Megalo", "Smilo", "Mammu", "Glypto", "Megathe", "Titano", "Basilo", "Andrewsar", "Indricothe", "Paraceratherium"];
const SECOND = ["saurus", "don", "therium", "ceras", "pteryx", "raptor", "cephalus", "stega", "nychus", "suchus"];
const ROCKS = ["shale", "limestone", "sandstone", "mudstone", "chalk"];
const FORMATIONS = ["Burgess Shale", "Morrison", "Hell Creek", "Solnhofen", "Yixian", "Green River", "Messel", "Karoo", "Santana", "Dinosaur Park", "Two Medicine", "Kem Kem", "Chengjiang", "Ediacara", "Rhynie Chert", "Mazon Creek", "Holzmaden", "Lance", "Nemegt", "Djadochta", "Bahariya", "Ischigualasto", "Tendaguru", "Wessex", "Oxford Clay", "La Brea", "Jehol", "Posidonia"];
FORMATIONS.forEach((name, i) => {
  add("formation", `formation-${i}`, { name, rock: ROCKS[i % ROCKS.length] });
  link("laidIn", `formation-${i}`, `period-${10 + Math.floor(rand() * 12)}`);
});
const COUNTRIES = ["Canada", "USA", "Germany", "China", "Mongolia", "Argentina", "Morocco", "Tanzania", "England", "Australia", "Brazil", "South Africa", "Egypt"];
for (let i = 0; i < 30; i++) {
  add("site", `site-${i}`, { name: `${pick(["North", "South", "East", "West", "Upper", "Lower", "Old", "Red"])} ${pick(["Quarry", "Ridge", "Butte", "Gulch", "Bluff", "Pit", "Wash", "Cliffs"])} ${i + 1}`, country: pick(COUNTRIES) });
  link("inFormation", `site-${i}`, `formation-${i % FORMATIONS.length}`);
}
for (let i = 0; i < 90; i++) {
  add("species", `species-${i}`, { name: `${FIRST[i % FIRST.length]}${SECOND[Math.floor(i / FIRST.length) % SECOND.length]} ${pick(["rex", "major", "minor", "gracilis", "robustus", "longus", "magnus", "ferox"])}`, diet: pick(["plants", "meat", "both", "filter"]) });
  link("livedIn", `species-${i}`, `period-${10 + Math.floor(rand() * 12)}`);
  for (let s = 0; s < 1 + Math.floor(rand() * 2); s++) link("foundAt", `species-${i}`, `site-${Math.floor(rand() * 30)}`);
}
const PEOPLE = ["Mary Anning", "Othniel Marsh", "Edward Cope", "Barnum Brown", "Roy Chapman Andrews", "Charles Walcott", "Sue Hendrickson", "Jack Horner", "Paul Sereno", "Xu Xing", "Zhe-Xi Luo", "Ernst Stromer", "Louis Dollo", "Gideon Mantell", "William Buckland", "Richard Owen", "Halszka Osmólska", "Zofia Kielan-Jaworowska", "Robert Bakker", "John Ostrom", "Philip Currie", "Luis Chiappe", "Rodolfo Coria", "Mary Leakey"];
PEOPLE.forEach((name, i) => add("researcher", `researcher-${i}`, { name }));
for (let i = 0; i < 16; i++) {
  add("expedition", `expedition-${i}`, { name: `${pick(["Spring", "Summer", "Autumn", "Field"])} dig ${1900 + i * 7}`, year: 1900 + i * 7 });
  link("ledBy", `expedition-${i}`, `researcher-${Math.floor(rand() * PEOPLE.length)}`);
  for (let s = 0; s < 2; s++) link("visited", `expedition-${i}`, `site-${Math.floor(rand() * 30)}`);
}
for (let i = 0; i < 16; i++) {
  add("specimen", `specimen-${i}`, { name: `Specimen ${String.fromCharCode(65 + (i % 26))}-${100 + i}`, catalog: `DT-${1000 + i * 13}` });
  link("of", `specimen-${i}`, `species-${Math.floor(rand() * 90)}`);
  link("dugAt", `specimen-${i}`, `site-${Math.floor(rand() * 30)}`);
}

export const seed = { nodes, edges };

/*
 * THE TEN WORKER VIEWS. Each draws its own thing, so a board that only
 * listed a view's first records would draw four of them alike — the
 * failure this fixture is for.
 */
const listView = (heading, kind, extra = "") => `graview.onProps((props) => {
  const rows = props.nodes.filter((node) => node.kind === ${JSON.stringify(kind)});
  graview.render(graview.html\`<section aria-labelledby="h"><h2 id="h">${heading}</h2>${extra}<ul>\${rows.slice(0, 40).map((row) => graview.html\`<li data-key="\${row.id}"><a data-record="\${row.id}">\${row.label}</a></li>\`)}</ul></section>\`);
});
`;
const pageView = (heading) => `graview.onProps((props) => {
  const node = props.node ?? props.nodes?.[0];
  graview.render(graview.html\`<article aria-labelledby="h"><h1 id="h">\${node ? node.label : ""}</h1><p>${heading}</p></article>\`);
});
`;
const place = (name, title, attach, heading) => ({ manifest: { name, title, attach, cardinality: "many" }, worker: { source: listView(heading, attach) } });
const page = (name, title, attach, heading) => ({ manifest: { name, title, attach, cardinality: "one", replaces: "page" }, worker: { source: pageView(heading) } });

export const workerViews = [
  place("timeline", "Timeline", "period", "The periods, oldest first"),
  place("tree-of-life", "Tree of life", "species", "Every species, by what it ate"),
  place("dig-map", "Dig map", "site", "Where the fossils come from"),
  place("extinctions", "Extinctions", "event", "When most of life ended"),
  page("species-page", "Species sheet", "species", "A species and its specimens"),
  page("site-page", "Site sheet", "site", "A site and what came out of it"),
  page("period-page", "Period sheet", "period", "A period and what lived in it"),
  page("researcher-page", "Researcher sheet", "researcher", "A researcher and their digs"),
  page("expedition-page", "Expedition sheet", "expedition", "A season's dig"),
  page("specimen-page", "Specimen sheet", "specimen", "One fossil, catalogued"),
];
