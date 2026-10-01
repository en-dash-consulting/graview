#!/usr/bin/env node
/**
 * THE PROGRAMME'S SEED: ten editions of a conference and the next one in
 * review, generated, deterministic, and committed as `src/data/seed.json`.
 *
 *   node apps/gauntlet/scripts/generate-seed.mjs           write it
 *   node apps/gauntlet/scripts/generate-seed.mjs --check   say whether the committed one is what this writes
 *
 * Deterministic on purpose — one seeded generator, no clock, no
 * `Math.random` — so the same script always writes the same bytes and a
 * harness can name a record by its id. The awkwardness is not random: each
 * shape the walks found by accident is written here deliberately (see the
 * AWKWARD lists), and the generated bulk around them is what makes them
 * real size rather than a fixture.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../src/data/seed.json");

/* ------------------------------------------------------------ the dice */

/** mulberry32: small, fast, and the same on every machine. */
function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = generator(20261001);
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
/** A skewed pick: the first of a list far more often than the last — a few speakers give many talks. */
const skewed = (list) => list[Math.floor(Math.pow(random(), 2.2) * list.length)];

/** The same slug `freshId` mints: accents folded, other scripts kept. */
const slug = (label) =>
  label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "item";

const nodes = [];
const edges = [];
const taken = new Set();
/** An id the way the app would mint it: the name folded, then -2, -3 for a name already taken. */
function mint(kind, name) {
  const base = `${kind}:${slug(name)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}
const node = (record) => {
  nodes.push(record);
  return record.id;
};
const tied = new Set();
/** One edge of a kind between a pair, however often the dice say so. */
const edge = (kind, from, to) => {
  const key = `${kind}|${from}|${to}`;
  if (tied.has(key)) return;
  tied.add(key);
  edges.push({ kind, from, to });
};

/* -------------------------------------------------------------- topics */

const TOPICS = [
  "Distributed systems", "Observability", "Type systems", "Compilers", "Databases", "Security",
  "Accessibility", "Developer experience", "Testing", "Performance", "Networking", "Operating systems",
  "Functional programming", "Formal methods", "Web platform", "Mobile", "Embedded", "Cloud infrastructure",
  "Data engineering", "Privacy", "Open source", "Ethics", "Education", "Design systems",
  // AWKWARD (W-141): case variants — the committee tagged with both for years.
  "Machine learning", "Machine Learning",
  // AWKWARD (W-141): one name the beginning of another.
  "WebAssembly", "WebAssembly Components", "Rust", "Rust in the Kernel",
  // AWKWARD (W-093): names outside ASCII, and outside Latin.
  "Développement durable", "Datenschutz und Privatsphäre", "セキュリティ", "Мониторинг", "التعلم الآلي",
  "Concurrency", "Garbage collection", "Build systems", "Package management", "Incident response",
  "Reliability engineering", "Static analysis", "Programming languages", "Human factors", "Sustainability",
  "Hardware", "Graphics", "Audio",
];
const topics = TOPICS.map((label) => node({ id: mint("topic", label), kind: "topic", label }));

/* --------------------------------------------------------------- rooms */

const ROOMS = [
  // AWKWARD (W-141): "Aula" is the beginning of "Aula Magna", and "Hall 1" of "Hall 10".
  ["Hauptgebäude", "Aula", 420],
  ["Hauptgebäude", "Aula Magna", 1200],
  ["Exhibition Centre", "Hall 1", 900],
  ["Exhibition Centre", "Hall 10", 160],
  ["Exhibition Centre", "Hall 11", 160],
  ["Exhibition Centre", "Hall 12", 140],
  // AWKWARD (W-137, W-146): a room whose name is a sentence.
  ["North Wing", "The Margaret Hamilton Lecture Theatre (North Wing, Level −1, step-free via Lift C)", 310],
  ["North Wing", "The Grace Hopper Seminar Room (North Wing, Level 2, opposite the cloakroom)", 48],
  ["Bâtiment Est", "Salle Émile-Durkheim", 90],
  ["Bâtiment Est", "Salle Marie-Skłodowska-Curie", 90],
  ["東館", "第一会議室", 60],
  ["Library", "Raum 0.001", 24],
  ["Library", "Raum 0.002", 24],
  ["Library", "Quiet Room", 12],
];
for (let i = 1; i <= 22; i++) ROOMS.push(["South Wing", `Seminar Room S${String(i).padStart(2, "0")}`, between(18, 60)]);
const rooms = ROOMS.map(([building, name, seats]) => ({ id: node({ id: mint("room", name), kind: "room", building, name, seats }), seats }));
const TRACK_ROOMS = [rooms[1], rooms[2], rooms[6], rooms[0]];

/* ------------------------------------------------------------ speakers */

const AWKWARD_SPEAKERS = [
  // W-093: accents, and names with no Latin form at all.
  ["Zoë", "Lamarré", "Université de Montréal", "Canada"],
  ["Søren", "Kierkegaard-Ødegård", "NTNU", "Norway"],
  ["Nguyễn Thị", "Minh Khai", "Đại học Bách khoa Hà Nội", "Vietnam"],
  ["Łukasz", "Żółtowski", "Politechnika Wrocławska", "Poland"],
  ["Сергей", "Плинов", "МГУ", "Russia"],
  ["王", "芳", "清华大学", "China"],
  ["ليلى", "حداد", "الجامعة الأمريكية في بيروت", "Lebanon"],
  ["Αλέξανδρος", "Παπαδόπουλος", "ΕΜΠ", "Greece"],
  ["Ngũgĩ", "wa Thiong'o", "Kenyatta University", "Kenya"],
  ["Björk", "", "Independent", "Iceland"],
  // W-112: three speakers called Wei Zhang, told apart only by where they work.
  ["Wei", "Zhang", "Tsinghua University", "China"],
  ["Wei", "Zhang", "Shopify", "Canada"],
  ["Wei", "Zhang", "Independent", "Singapore"],
  // W-112 and W-093 together: two names that fold to one id.
  ["María", "García", "Universidad de Sevilla", "Spain"],
  ["Maria", "Garcia", "Red Hat", "United States"],
  // W-130: very long names that share a long beginning.
  ["Maximiliane Franziska Wilhelmina", "von Hohenzollern-Sigmaringen-Ostbrandenburg", "Technische Universität München", "Germany"],
  ["Maximiliane Franziska Wilhelmina", "von Hohenzollern-Sigmaringen-Westbrandenburg", "Fraunhofer", "Germany"],
  ["Oluwaseun Adebayo-Okonkwo", "Chukwuemekaobi-Nwachukwu", "University of Lagos", "Nigeria"],
  // W-141: a name that is the beginning of another.
  ["Ann", "Lee", "Atlassian", "Australia"],
  ["Ann", "Leeson", "Monzo", "United Kingdom"],
];
const GIVEN = [
  "Amara", "Aiko", "Anders", "André", "Ana", "Aoife", "Arjun", "Astrid", "Beatriz", "Bongani", "Camille", "Chiara",
  "Chidi", "Dagny", "Darius", "Dmitri", "Élodie", "Emeka", "Emil", "Esperanza", "Fatima", "Femi", "François",
  "Gaël", "Hamid", "Hana", "Hiroshi", "Ilse", "Imani", "Ingrid", "Iñaki", "Jakub", "Jana", "Javier", "Joaquín",
  "Jörg", "Kalani", "Kemal", "Kenji", "Kirsi", "Lars", "Leilani", "Lin", "Lucía", "Magnús", "Malik", "Mariam",
  "Mateus", "Mei", "Mikael", "Nadia", "Naveen", "Noémie", "Nour", "Olusegun", "Ömer", "Pál", "Pilar", "Priya",
  "Rafał", "Ravi", "Renée", "Rhiannon", "Rui", "Sakura", "Santiago", "Sebastián", "Siobhán", "Søren", "Sunita",
  "Tamás", "Thandiwe", "Thi Ha", "Tiago", "Tomás", "Uriel", "Valentina", "Wei", "Xochitl", "Yasmin", "Yusuf",
  "Zainab", "Zoltán", "Zuzana",
];
const FAMILY = [
  "Abara", "Adeyemi", "Alvarez", "Andersen", "Bakker", "Banerjee", "Bianchi", "Brennan", "Castro", "Chen",
  "Costa", "Da Silva", "Dąbrowski", "De Luca", "Dubois", "Eriksson", "Fernández", "Fischer", "García",
  "Gómez", "Gonçalves", "Haddad", "Hansen", "Hernández", "Horváth", "Ibrahim", "Ivanova", "Jansen", "Jiménez",
  "Kang", "Kaur", "Kim", "Kowalczyk", "Kuznetsov", "Laurent", "Lefèvre", "Li", "Lindqvist", "López", "Mäkinen",
  "Martínez", "Mbeki", "Mendoza", "Moreau", "Müller", "Nakamura", "Nguyen", "Novák", "Ó Briain", "O'Connor",
  "Okafor", "Olsen", "Park", "Patel", "Pereira", "Petrović", "Quispe", "Rahman", "Ramírez", "Rossi", "Sato",
  "Schäfer", "Silva", "Singh", "Sørensen", "Suzuki", "Tanaka", "Torres", "Tran", "Van der Berg", "Virtanen",
  "Wang", "Weiß", "Wójcik", "Yamamoto", "Yılmaz", "Zhang", "Zhou",
];
const AFFILIATIONS = [
  "ETH Zürich", "Universität Wien", "KTH", "Aalto-yliopisto", "Universidade de São Paulo", "IIT Bombay",
  "University of Cape Town", "Mozilla", "Cloudflare", "Fastly", "GitHub", "Datadog", "Spotify", "Zalando",
  "Ableton", "Mercado Libre", "Nubank", "Rakuten", "LINE", "Grab", "Atlassian", "Canonical", "SUSE",
  "Independent", "Freelance", "Government Digital Service", "Bundesamt für Sicherheit in der Informationstechnik",
  "Institut national de recherche en sciences et technologies du numérique",
];
const speakers = [];
for (const [given, family, affiliation, country] of AWKWARD_SPEAKERS) {
  const name = family ? `${given} ${family}` : given;
  speakers.push(node({ id: mint("speaker", name), kind: "speaker", given, family, affiliation, country }));
}
while (speakers.length < 1100) {
  const given = pick(GIVEN);
  const family = pick(FAMILY);
  speakers.push(
    node({
      id: mint("speaker", `${given} ${family}`),
      kind: "speaker",
      given,
      family,
      ...(chance(0.85) ? { affiliation: pick(AFFILIATIONS) } : {}),
    }),
  );
}
// The awkward ones speak often enough to be met: they go first in the skewed draw.
const speakerDraw = [...speakers.slice(0, AWKWARD_SPEAKERS.length), ...speakers.slice(AWKWARD_SPEAKERS.length)];

/* --------------------------------------------------------------- staff */

const STAFF = [
  "Aiyana Whitehorse", "Bram de Vries", "Chloé Martin", "Dev Raman", "Efua Mensah", "Fionn Gallagher",
  "Gülşen Arslan", "Hyun-woo Choi", "Isla McKenzie", "Jonas Berg", "Keira Nakamura-Jones", "Luca Ferraro",
  "Mia Schmidt", "Nils Åberg", "Olga Sokolova", "Pita Taufa", "Qiu Ying", "Rosa Delgado", "Sanna Laine",
  "Teodor Popescu", "Uma Krishnan", "Viktor Horvat", "Wiremu Ngata", "Ximena Rojas", "Yara Haddad",
  "Zeynep Kaya", "Ama Owusu", "Bea Lindgren", "Cai Wen", "Dilnoza Karimova",
  // W-112: two staff members of one name.
  "Sam Taylor", "Sam Taylor",
  // W-141: and one whose name begins another's.
  "Jo", "Jo Ellis",
];
const DUTIES = ["registration", "av", "stewarding", "catering", "accessibility"];
for (const name of STAFF) {
  const id = node({ id: mint("staff", name), kind: "staff", name, duty: pick(DUTIES) });
  for (let i = between(1, 3); i > 0; i--) edge("looks-after", id, pick(rooms).id);
}

/* ------------------------------------------------------- talk titles */

/*
 * AWKWARD (W-130, W-137): long titles that share their first forty
 * characters, so anything cut at a fixed width reads the same twice.
 */
const OPENINGS = [
  "Towards Reproducible Builds in Large Monorepos: Lessons from",
  "Towards Reproducible Builds in Large Monorepos: What We Got Wrong About",
  "A Practical Guide to Incremental Type Checking at Scale, as Learned from",
  "What Nobody Tells You About Running Distributed Consensus in Production:",
  "Observability for Event-Driven Architectures Without Drowning in",
  "Designing Accessible Interfaces for People Who Navigate by Keyboard Alone:",
  "From Prototype to Production: Migrating a Decade-Old Payments Platform to",
  "Über die Zuverlässigkeit verteilter Systeme: Erfahrungen aus",
  "Retour d'expérience : dix ans de développement durable du logiciel chez",
  "Memory Safety Without Garbage Collection: A Field Report on",
  "How We Cut Our Continuous Integration Bill in Half by Rethinking",
  "Lessons Learned from Teaching Formal Methods to Working Engineers at",
];
const ENDINGS = [
  "Three Failed Migrations", "Ten Thousand Services", "a Payments Platform", "Zürich's Transit Network",
  "São Paulo's Open Data Portal", "the First Five Years", "an Airline's Booking Engine", "a Public Broadcaster",
  "Seventeen Million Lines of Legacy Code", "the Norwegian Tax Administration", "a Hospital's Records System",
  "Our On-Call Rotation", "a Small Team with a Large Pager", "Rust and WebAssembly", "the Edge",
  "a Municipal Water Utility", "Cache Invalidation", "the Kubernetes Upgrade We Kept Postponing",
  "Kraków's Tram Timetables", "a Startup That Grew Faster Than Its Database",
];
const PLAIN = [
  "Property-Based Testing for the Rest of Us", "Your Database Is a Distributed System Whether You Like It or Not",
  "Error Messages Are a User Interface", "The Long Tail of Unicode Bugs", "Shipping Small Changes Often",
  "Why Is the Build Slow?", "Profiling Without Guesswork", "A Gentle Introduction to Effect Handlers",
  "Designing for Screen Readers First", "Postmortems Without Blame", "Static Types for Dynamic Teams",
  "Building a Search Index from Scratch", "Time Zones Will Hurt You", "Rewriting It in Rust, Carefully",
  "The Case for Boring Technology", "Security Is a Team Sport",
  // W-093: titles outside Latin.
  "分散システムにおける一貫性の実践的な考え方：十年間の運用から学んだこと",
  "التصميم من أجل الوصول: واجهات تعمل لكل المستخدمين",
  "Типобезопасные миграции баз данных на практике",
];
function longTitle() {
  for (;;) {
    const title = `${pick(OPENINGS)} ${pick(ENDINGS)}`;
    if (title.length >= 60 && title.length <= 120) return title;
  }
}
const FORMAT_MINUTES = { talk: 25, lightning: 5, keynote: 45, panel: 50 };

/* ------------------------------------------------------------ editions */

/** The fourth Monday of September: when the conference is held. */
function opening(year) {
  const first = new Date(Date.UTC(year, 8, 1));
  const toMonday = (8 - first.getUTCDay()) % 7;
  return new Date(Date.UTC(year, 8, 1 + toMonday + 21));
}
const day = (date, plus) => new Date(date.getTime() + plus * 86_400_000).toISOString().slice(0, 10);
const at = (isoDay, minutes) => `${isoDay}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const TRACKS = [
  ["A", "Distributed Systems and the Long Tail of Reliability Engineering"],
  ["B", "Languages, Types and the Tools That Read Them"],
  ["C", "People, Practice and the Interfaces They Use"],
  ["D", "Security, Privacy and the Infrastructure Underneath"],
];
const HALVES = [["Morning", 9 * 60], ["Afternoon", 14 * 60]];
// AWKWARD (W-141): one title, three spellings, one a year.
const LIGHTNING = ["Lightning Talks", "Lightning talks", "LIGHTNING TALKS"];

function talk({ title, format, status, startsAt, presenters, proposer, session, about }) {
  const id = node({
    id: mint("talk", title),
    kind: "talk",
    title,
    format,
    status,
    ...(startsAt ? { startsAt } : {}),
    minutes: FORMAT_MINUTES[format],
  });
  for (const speaker of presenters) edge("presented-by", id, speaker);
  edge("proposed-by", id, proposer);
  if (session) edge("in-session", id, session);
  for (const topic of about) edge("about", id, topic);
  return id;
}

function people() {
  const presenters = [skewed(speakerDraw)];
  if (chance(0.25)) presenters.push(skewed(speakerDraw));
  const unique = [...new Set(presenters)];
  // Two relations between one pair: nine in ten talks are proposed by a presenter.
  return { presenters: unique, proposer: chance(0.9) ? unique[0] : pick(speakers) };
}
const subjects = () => [...new Set(Array.from({ length: between(1, 2) }, () => skewed(topics)))];

const given = [];
for (let year = 2017; year <= 2026; year++) {
  const first = opening(year);
  const days = [day(first, 0), day(first, 1), day(first, 2)];
  const sessions = [];
  days.forEach((date, d) => {
    for (const [half, startMinutes] of HALVES) {
      for (const [letter, theme] of TRACKS) {
        // AWKWARD (W-130): every session's name begins "2024 · Day 2 · Morning · Track".
        const label = `${year} · Day ${d + 1} · ${half} · Track ${letter} — ${theme}`;
        const id = node({ id: mint("session", label), kind: "session", label, day: date });
        edge("held-in", id, TRACK_ROOMS[TRACKS.findIndex(([l]) => l === letter)].id);
        edge("chaired-by", id, skewed(speakerDraw));
        sessions.push({ id, date, startMinutes, letter, d, half });
      }
    }
  });

  // AWKWARD (W-112): "Opening Remarks" every year — ten records of one name.
  const openingSession = sessions[0];
  talk({ title: "Opening Remarks", format: "keynote", status: "given", startsAt: at(openingSession.date, 9 * 60), presenters: [speakers[0]], proposer: speakers[0], session: openingSession.id, about: [] });

  for (const session of sessions) {
    let minutes = session.startMinutes + (session === openingSession ? 45 : 0);
    const count = session === openingSession ? 6 : between(6, 9);
    for (let i = 0; i < count; i++) {
      const format = chance(0.08) ? "lightning" : chance(0.05) ? "panel" : "talk";
      const title = chance(0.12) ? pick(PLAIN) : chance(0.04) && given.length > 0 ? pick(given) : longTitle();
      const { presenters, proposer } = people();
      given.push(title);
      talk({ title, format, status: "given", startsAt: at(session.date, minutes), presenters, proposer, session: session.id, about: subjects() });
      minutes += FORMAT_MINUTES[format] + 5;
    }
  }
  const lightningSession = sessions[sessions.length - 1];
  talk({ title: LIGHTNING[year % 3], format: "panel", status: "given", startsAt: at(lightningSession.date, 17 * 60), presenters: [skewed(speakerDraw)], proposer: speakers[0], session: lightningSession.id, about: [] });

  // AWKWARD (W-105): a lifecycle with retired members — turned down and withdrawn talks every year.
  for (let i = 0; i < 40; i++) {
    const { presenters, proposer } = people();
    talk({ title: longTitle(), format: chance(0.1) ? "lightning" : "talk", status: "rejected", presenters, proposer, about: subjects() });
  }
  for (let i = 0; i < 6; i++) {
    const { presenters, proposer } = people();
    talk({ title: longTitle(), format: "talk", status: "withdrawn", presenters, proposer, about: subjects() });
  }

  // Workshops the day before, two of them cancelled: the calendar's second kind.
  const eve = day(first, -1);
  for (let i = 0; i < 12; i++) {
    const label = `Hands-on: ${pick(OPENINGS).replace(/[:,]? [^ ]+$/, "")}`.slice(0, 118);
    const room = rooms[4 + (i % (rooms.length - 4))];
    const capacity = Math.min(room.seats, between(12, 40));
    const id = node({
      id: mint("workshop", label),
      kind: "workshop",
      label,
      startsAt: at(eve, i % 2 === 0 ? 9 * 60 : 14 * 60),
      capacity,
      status: i < 2 ? "cancelled" : capacity === room.seats ? "full" : "planned",
    });
    edge("held-in", id, room.id);
    for (const speaker of new Set([skewed(speakerDraw), ...(chance(0.4) ? [skewed(speakerDraw)] : [])])) edge("led-by", id, speaker);
    for (const topic of subjects()) edge("about", id, topic);
  }
}

/* --------------------------------------- next year's, still in review */

const next = opening(2027);
for (let i = 0; i < 150; i++) {
  const { presenters, proposer } = people();
  talk({ title: chance(0.1) ? pick(PLAIN) : longTitle(), format: chance(0.1) ? "lightning" : "talk", status: i < 20 ? "accepted" : "submitted", presenters, proposer, about: subjects() });
}
/*
 * TWO OPEN VIOLATIONS, on purpose: talks the committee pencilled in for
 * 2027 before a session existed for them. A graph of real size with
 * nothing wrong in it is as tame as one with five records.
 */
for (const [title, minutes] of [["Keynote: The Next Ten Years of the Programme", 9 * 60], ["Keynote: The Next Ten Years of the Programme, Revisited", 16 * 60]]) {
  talk({ title, format: "keynote", status: "scheduled", startsAt: at(day(next, 0), minutes), presenters: [speakers[0]], proposer: speakers[0], about: [] });
}
// And one workshop that sells more places than its room has seats.
{
  const label = "Hands-on: Fifty People, Twenty-Four Chairs and One Projector";
  const id = node({ id: mint("workshop", label), kind: "workshop", label, startsAt: at(day(next, -1), 9 * 60), capacity: 50, status: "planned" });
  edge("held-in", id, rooms.find((room) => room.seats === 24).id);
  edge("led-by", id, speakers[1]);
}

/* ------------------------------------------------------------ written */

// One record a line: diffable, and a third of the size of indented JSON.
const text = `{\n"nodes": [\n${nodes.map((n) => JSON.stringify(n)).join(",\n")}\n],\n"edges": [\n${edges.map((e) => JSON.stringify(e)).join(",\n")}\n]\n}\n`;
if (process.argv.includes("--check")) {
  const same = readFileSync(out, "utf8") === text;
  process.stdout.write(same ? "the committed seed is the one this script writes\n" : "the committed seed is NOT the one this script writes — run it\n");
  process.exit(same ? 0 : 1);
}
writeFileSync(out, text, "utf8");
const counts = nodes.reduce((all, n) => ({ ...all, [n.kind]: (all[n.kind] ?? 0) + 1 }), {});
process.stdout.write(`wrote apps/gauntlet/src/data/seed.json\n${nodes.length} nodes, ${edges.length} edges, ${(text.length / 1024 / 1024).toFixed(2)} MB\n${JSON.stringify(counts)}\n`);
