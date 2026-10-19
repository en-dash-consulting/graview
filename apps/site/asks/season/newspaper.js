// Asked: "Make this app look more like a physical newspaper."
//
// The season as a weekly paper, on the app's front page: a masthead, the
// next game as the lead story, the results as box scores, the snack duty
// as a column, and the classifieds, where a game still to play that
// nobody brings snacks to is a WANTED ad that links to the game.
//
// manifest: {
//   name: "courier", attach: "home", cardinality: "many",
//   reads: { kinds: ["game", "family"], edges: ["snacksBy"] }
// }

graview.style(`
  .paper { max-width: 60rem; margin: 0 auto; padding: 22px clamp(14px, 3vw, 30px) 26px; background: #f5f0e4; color: #1d1a16;
           font-family: Georgia, "Times New Roman", serif; box-shadow: 0 1px 0 #d8cfbb, 0 10px 28px rgba(40, 30, 10, 0.12); }
  .mast { text-align: center; border-bottom: 3px double #1d1a16; padding-bottom: 8px; }
  .mast h2 { margin: 0; font: 900 clamp(1.9rem, 6vw, 3.4rem)/0.95 "Times New Roman", Georgia, serif; letter-spacing: 0.01em; }
  .line { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 8px; padding-top: 5px; border-top: 1px solid #1d1a16;
          font: 600 0.72rem/1.2 Georgia, serif; letter-spacing: 0.12em; text-transform: uppercase; }
  .lead { padding: 16px 0 14px; border-bottom: 1px solid #1d1a16; }
  .kicker { margin: 0; font: 700 0.72rem/1 Georgia, serif; letter-spacing: 0.16em; text-transform: uppercase; color: #8a2b1d; }
  .lead h3 { margin: 6px 0 8px; font: 800 clamp(1.4rem, 4vw, 2.3rem)/1.05 "Times New Roman", Georgia, serif; }
  .lead p { margin: 0; font-size: 1rem; line-height: 1.5; max-width: 44rem; }
  .lead a, .cols a { color: inherit; }
  .cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; padding-top: 12px; }
  .col { padding: 0 14px; border-left: 1px solid #1d1a16; }
  .col:first-child { padding-left: 0; border-left: 0; }
  .col h4 { margin: 0 0 8px; font: 800 0.95rem/1.1 Georgia, serif; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid #1d1a16; padding-bottom: 4px; }
  .col ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 0.9rem; line-height: 1.35; }
  .score { font-variant-numeric: tabular-nums; font-weight: 700; }
  .ad { border: 2px solid #1d1a16; padding: 8px 10px; margin-bottom: 8px; text-align: center; }
  .ad b { display: block; font: 900 1.5rem/1 "Times New Roman", Georgia, serif; letter-spacing: 0.12em; }
  .ad p { margin: 6px 0 0; font-size: 0.86rem; line-height: 1.35; }
  .quiet { font-style: italic; font-size: 0.88rem; }
  @media (max-width: 640px) {
    .cols { grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .col { padding: 0; border-left: 0; }
  }
`);

const date = (iso, options) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(new Date(iso + "T12:00:00Z"));
const short = (iso) => date(iso, { weekday: "short", month: "short", day: "numeric" });

function draw(props) {
  const nodes = props.nodes || [];
  const edges = props.edges || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const games = nodes.filter((node) => node.kind === "game").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const played = games.filter((game) => game.status === "played");
  const upcoming = games.filter((game) => game.status === "upcoming");
  const bringing = (id) => {
    const edge = edges.find((one) => one.kind === "snacksBy" && one.from === id);
    return edge ? byId.get(edge.to) : undefined;
  };
  const wanted = upcoming.filter((game) => !bringing(game.id));
  const next = upcoming[0];
  const wins = played.filter((game) => {
    const [us, them] = String(game.score || "").split(/[–-]/).map(Number);
    return us > them;
  }).length;
  const name = (props.theme && props.theme.name) || "The Comets";
  graview.render(graview.html`
    <article class="paper">
      <header class="mast">
        <h2>The Comets Courier</h2>
        <div class="line"><span>${name}</span><span>${played.length} played · ${upcoming.length} to go</span><span>Price: one orange slice</span></div>
      </header>
      ${next
        ? graview.html`
          <section class="lead">
            <p class="kicker">This Saturday</p>
            <h3><a data-record="${next.id}">Comets ${next.where === "away" ? "travel to" : "host"} ${next.opponent}</a></h3>
            <p>Kickoff is ${next.kickoff || "in the morning"} on ${date(next.date, { weekday: "long", month: "long", day: "numeric" })} at ${next.field || "the usual field"}. The Comets come in with ${wins} ${wins === 1 ? "win" : "wins"} from ${played.length} games. ${bringing(next.id) ? bringing(next.id).name + " bring the halftime snacks." : "Nobody has signed up to bring the halftime snacks."}</p>
          </section>`
        : graview.html`<section class="lead"><p class="kicker">Season's end</p><h3>Every game is played</h3></section>`}
      <div class="cols">
        <section class="col">
          <h4>Results</h4>
          <ul>${played.map((game) => graview.html`<li data-key="${game.id}"><span class="score">${game.score || "–"}</span> ${game.where === "away" ? "at" : "vs"} <a data-record="${game.id}">${game.opponent}</a>, ${short(game.date)}</li>`)}</ul>
        </section>
        <section class="col">
          <h4>Snack duty</h4>
          <ul>${upcoming.map((game) => graview.html`<li data-key="${game.id}">${short(game.date)}: ${bringing(game.id) ? bringing(game.id).name : graview.html`<b>open</b>`}</li>`)}</ul>
        </section>
        <section class="col">
          <h4>Classifieds</h4>
          ${wanted.length > 0
            ? wanted.map((game) => graview.html`<div class="ad" data-key="${game.id}"><b>WANTED</b><p>Halftime snacks for the <a data-record="${game.id}">${game.opponent} game</a>, ${short(game.date)}. Orange slices and water welcome. Inquire on the game's page.</p></div>`)
            : graview.html`<p class="quiet">No want ads this week: every game has its snacks.</p>`}
        </section>
      </div>
    </article>`);
}

graview.onProps(draw);
