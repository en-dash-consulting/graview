// Asked: "Give me a list view of remaining games and who's bringing snacks."
//
// The games still to play, soonest first: when and where, and the family
// bringing the halftime snacks. A game nobody has signed up for says so in
// its row, with the families to pick from and Sign up beside it.
//
// manifest: {
//   name: "remaining-games", title: "Remaining games", attach: "game", cardinality: "many",
//   reads: { kinds: ["family"], edges: ["snacksBy"] },
//   acts: ["bring-snacks"]
// }

graview.style(`
  .games { display: grid; gap: 10px; padding: 4px 0 12px; font-family: var(--graview-font-body); color: var(--graview-ink); }
  .lede { margin: 0 0 4px; color: var(--graview-ink-muted); font-size: 0.92rem; }
  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .game { display: grid; grid-template-columns: 5.2rem minmax(0, 1fr) minmax(0, 14rem); gap: 4px 16px; align-items: center;
          padding: 12px 14px; background: var(--graview-panel); border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); }
  .game.open { border-color: var(--graview-accent); box-shadow: inset 4px 0 0 var(--graview-accent); }
  .when { display: grid; line-height: 1.15; }
  .when b { font: 700 1.05rem/1.1 var(--graview-font-display); }
  .when span { color: var(--graview-ink-muted); font-size: 0.8rem; }
  .who a { color: var(--graview-ink); font-weight: 650; text-decoration: none; }
  .who a:hover, .who a:focus-visible { text-decoration: underline; }
  .who p { margin: 2px 0 0; color: var(--graview-ink-muted); font-size: 0.82rem; }
  .snacks { font-size: 0.9rem; }
  .snacks .by { display: grid; line-height: 1.2; }
  .snacks .by span { color: var(--graview-ink-muted); font-size: 0.78rem; }
  .snacks .none { margin: 0 0 6px; font-weight: 650; color: var(--graview-accent); }
  fieldset { border: 0; margin: 0; padding: 0; display: flex; gap: 6px; min-width: 0; }
  select { flex: 1; min-width: 0; min-height: 34px; padding: 4px 6px; border-radius: 8px; border: 1px solid var(--graview-edge);
           background: var(--graview-ground); color: var(--graview-ink); font: inherit; }
  button { min-height: 34px; padding: 0 14px; border-radius: 8px; border: 0; background: var(--graview-accent); color: var(--graview-panel);
           font: 650 0.88rem/1 var(--graview-font-body); cursor: pointer; }
  .said { margin: 0; min-height: 1.2em; color: var(--graview-ink-muted); font-size: 0.85rem; }
  @container (max-width: 560px) {
    .game { grid-template-columns: 4.4rem minmax(0, 1fr); }
    .snacks { grid-column: 1 / -1; }
  }
  @media (max-width: 560px) {
    .game { grid-template-columns: 4.4rem minmax(0, 1fr); }
    .snacks { grid-column: 1 / -1; }
  }
`);

let said = "";
graview.on("click", "button", (event) => {
  said = event.pressed && event.pressed.ok ? "Signed up. Thank you!" : event.pressed ? event.pressed.message : "";
  draw(graview.props);
});

const day = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(iso + "T12:00:00Z"));
const weekday = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(iso + "T12:00:00Z"));

function draw(props) {
  const nodes = props.nodes || [];
  const edges = props.edges || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const families = nodes.filter((node) => node.kind === "family").sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const games = nodes.filter((node) => node.kind === "game" && node.status === "upcoming").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const bringing = (id) => {
    const edge = edges.find((one) => one.kind === "snacksBy" && one.from === id);
    return edge ? byId.get(edge.to) : undefined;
  };
  const open = games.filter((game) => !bringing(game.id)).length;
  graview.render(graview.html`
    <section class="games">
      <p class="lede">${games.length === 1 ? "One game" : games.length + " games"} left this season. ${open === 0 ? "Every one has its snacks." : open === 1 ? "One still needs snacks." : open + " still need snacks."}</p>
      <ol>
        ${games.map((game) => {
          const family = bringing(game.id);
          return graview.html`
            <li class="game ${family ? "" : "open"}" data-key="${game.id}">
              <span class="when"><b>${day(game.date)}</b><span>${weekday(game.date)} · ${game.kickoff || ""}</span></span>
              <span class="who"><a data-record="${game.id}">${game.where === "away" ? "at" : "vs"} ${game.opponent}</a><p>${game.field || ""}</p></span>
              <span class="snacks">${family
                ? graview.html`<span class="by"><b>${family.name}</b><span>${family.player ? family.player + "'s family brings snacks" : "Bringing snacks"}</span></span>`
                : graview.html`
                  <p class="none">Nobody on snacks yet</p>
                  <fieldset data-record="${game.id}">
                    <select name="to" aria-label="${"Who brings snacks to the " + game.opponent + " game"}">
                      ${families.map((one) => graview.html`<option value="${one.id}">${one.name}</option>`)}
                    </select>
                    <button data-act="bring-snacks">Sign up</button>
                  </fieldset>`}
              </span>
            </li>`;
        })}
      </ol>
      <p class="said" aria-live="polite">${said}</p>
    </section>`);
}

graview.onProps(draw);
