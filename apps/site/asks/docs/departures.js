// Asked: "Make the modules page look like an airport departures board."
//
// The modules as a split-flap board: each module a row, its gate the
// workspace folder it sits in, its crew who CODEOWNERS says reviews it,
// and its status read off the graph. A module whose doc was reviewed today
// (a doc just written) reads WRITTEN in the app's accent; one with no doc
// reads NO DOC, one with no owner DELAYED, and the rest ON TIME. The tiles
// flip in row by row, and not at all for a reader who asked for less motion.
//
// manifest: {
//   name: "departures", title: "Departures", attach: "module", cardinality: "many",
//   reads: { kinds: ["doc", "person"], edges: ["documentedIn", "ownedBy"] }
// }

const ROWS = 20;
const WIDTH = { module: 22, gate: 4, crew: 9, status: 7 };
const GATES = { service: "SVC", package: "PKG", tool: "TOOL" };

/* A column is as wide as its tiles: each 1.15em and a 0.12em gap. */
const cols = (...widths) => widths.map((n) => `${(n * 1.27).toFixed(2)}em`).join(" ");
const rowDelays = Array.from({ length: ROWS }, (_, i) => `.rows li:nth-child(${i + 1}) { --r: ${i}; }`).join("\n");
const tileDelays = Array.from({ length: 24 }, (_, i) => `.t:nth-child(${i + 1}) { --c: ${i}; }`).join("\n");

graview.style(`
  .board { container-type: inline-size; margin: 0; padding: 18px 16px 16px; background: #0b0d10; color: #f4c95d;
           border-radius: var(--graview-radius); font-family: var(--graview-font-mono); }
  .top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 12px; }
  .top h2 { margin: 0; font: 700 clamp(1rem, 4cqi, 1.6rem)/1 var(--graview-font-mono); letter-spacing: 0.18em; color: #f7f3e8; }
  .top p { margin: 0; color: #9aa3ad; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .head, .rows { font-size: clamp(6px, 1.72cqi, 15px); }
  .head, .row { display: grid; grid-template-columns: ${cols(WIDTH.module, WIDTH.gate, WIDTH.crew, WIDTH.status)}; gap: 0 0.9em; align-items: center; }
  .head { color: #9aa3ad; padding: 0 0 6px; border-bottom: 1px solid #262b31; }
  .head span { font-size: 0.66em; letter-spacing: 0.14em; }
  .rows { list-style: none; margin: 0; padding: 0; }
  .row { padding: 4px 0; border-bottom: 1px solid #171b20; text-decoration: none; color: inherit; }
  .row:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 2px; }
  .cell { display: flex; gap: 0.12em; min-width: 0; }
  .t { display: inline-block; flex: 0 0 auto; width: 1.15em; padding: 0.15em 0; text-align: center; background: #16191e;
       border-radius: 2px; line-height: 1.3; font-weight: 600;
       box-shadow: inset 0 -1px 0 #0b0d10, inset 0 1px 0 #20252b; }
  .written .status .t { color: var(--graview-accent); }
  .delayed .status .t { color: #ff9b7a; }
  .nodoc .status .t { color: #ff6b6b; }
  .crew .t { color: #d7dde4; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .foot { margin: 12px 0 0; color: #9aa3ad; font-size: 0.75rem; }
  .foot b { color: var(--graview-accent); font-weight: 700; }
  ${rowDelays}
  ${tileDelays}
  @keyframes flap { 0% { transform: rotateX(88deg); opacity: 0.25; } 55% { transform: rotateX(-18deg); opacity: 1; } 100% { transform: rotateX(0deg); opacity: 1; } }
  @media (prefers-reduced-motion: no-preference) {
    .t { animation: flap 420ms cubic-bezier(0.3, 0.7, 0.3, 1) both; animation-delay: calc(var(--r, 0) * 110ms + var(--c, 0) * 14ms); transform-origin: 50% 50%; }
  }
  @container (max-width: 520px) {
    .head, .row { grid-template-columns: ${cols(WIDTH.module, WIDTH.status)}; }
    .gate, .crew { display: none; }
    .head, .rows { font-size: clamp(6px, 2.55cqi, 14px); }
  }
`);

const fit = (text, width) => {
  const upper = String(text || "").toUpperCase();
  return (upper.length > width ? upper.slice(0, width - 1) + "…" : upper).padEnd(width, " ");
};
const tiles = (text, width) => graview.html`${[...fit(text, width)].map((ch) => graview.html`<span class="t">${ch === " " ? " " : ch}</span>`)}`;

function today(props) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: props.timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch (error) {
    return new Date().toISOString().slice(0, 10);
  }
}

function draw(props) {
  const nodes = props.nodes || [];
  const edges = props.edges || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const day = today(props);
  const modules = nodes.filter((node) => node.kind === "module").sort((a, b) => String(a.path).localeCompare(String(b.path))).slice(0, ROWS);
  const docsOf = (id) => edges.filter((edge) => edge.kind === "documentedIn" && edge.from === id).map((edge) => byId.get(edge.to)).filter(Boolean);
  const ownersOf = (id) => edges.filter((edge) => edge.kind === "ownedBy" && edge.from === id).map((edge) => byId.get(edge.to)).filter(Boolean);
  let written = 0;
  const rows = modules.map((module) => {
    const docs = docsOf(module.id);
    const owners = ownersOf(module.id);
    const fresh = docs.some((doc) => doc.lastReviewed === day);
    const status = docs.length === 0 ? "NO DOC" : fresh ? "WRITTEN" : owners.length === 0 ? "DELAYED" : "ON TIME";
    const tone = docs.length === 0 ? "nodoc" : fresh ? "written" : owners.length === 0 ? "delayed" : "ontime";
    if (fresh) written += 1;
    const crew = owners.length > 0 ? String(owners[0].handle || owners[0].label).replace(/^@/, "") : "—";
    const said = `${module.path}, ${module.area}, ${owners.length > 0 ? "owned by " + owners.map((o) => o.label).join(" and ") : "no owner"}, ${status.toLowerCase()}`;
    return graview.html`
      <li data-key="${module.id}">
        <a class="row ${tone}" data-record="${module.id}">
          <span class="sr">${said}</span>
          <span class="cell module" aria-hidden="true">${tiles(module.path, WIDTH.module)}</span>
          <span class="cell gate" aria-hidden="true">${tiles(GATES[module.area] || module.area, WIDTH.gate)}</span>
          <span class="cell crew" aria-hidden="true">${tiles(crew, WIDTH.crew)}</span>
          <span class="cell status" aria-hidden="true">${tiles(status, WIDTH.status)}</span>
        </a>
      </li>`;
  });
  graview.render(graview.html`
    <section class="board">
      <div class="top"><h2>DEPARTURES</h2><p>${modules.length} modules${props.theme && props.theme.name ? " · " + props.theme.name : ""}</p></div>
      <div class="head" aria-hidden="true"><span>MODULE</span><span class="gate">GATE</span><span class="crew">CREW</span><span>STATUS</span></div>
      <ul class="rows">${rows}</ul>
      <p class="foot">${written > 0 ? graview.html`<b>WRITTEN</b> ${written === 1 ? "one doc" : written + " docs"} written today. ` : ""}DELAYED: no owner in CODEOWNERS. NO DOC: nothing covers it yet.</p>
    </section>`);
}

graview.onProps(draw);
