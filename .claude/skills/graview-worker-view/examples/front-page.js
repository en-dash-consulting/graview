// A home: the front page leads with the recommended package and what it
// costs, then every package as a card that goes to the package lens.
//
// manifest: {
//   name: "front", title: "Offers", attach: "home", cardinality: "many",
//   reads: { kinds: ["package", "offer"], edges: ["includes"] }
// }

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const ORDER = ["recommended", "alternative", "later"];

graview.style(`
  .home { display: grid; gap: 20px; padding: 16px; }
  .lead { display: grid; gap: 6px; padding: 20px; border-radius: 14px; border: 1px solid var(--graview-accent);
          background: linear-gradient(135deg, var(--graview-panel), var(--graview-ground)); }
  .eyebrow { margin: 0; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--graview-accent); }
  .lead h1 { margin: 0; font: 400 clamp(1.6rem, 5vw, 2.4rem)/1.1 var(--graview-font-body); }
  .figure { font-size: 1.6rem; font-variant-numeric: tabular-nums; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 12px; }
  .card { display: grid; gap: 4px; padding: 12px; border-radius: 12px; background: var(--graview-panel); border: 1px solid var(--graview-edge); color: var(--graview-ink); text-decoration: none; }
  .card:hover { border-color: var(--graview-accent); }
  .muted { color: var(--graview-ink-muted); font-size: 0.85rem; }
  .ring { width: 48px; height: 48px; }
  .ring .value { stroke: var(--graview-accent); transition: stroke-dashoffset 400ms ease-out; }
  .ring .track { stroke: var(--graview-edge); }
`);

graview.onProps((props) => {
  const byId = new Map(props.nodes.map((node) => [node.id, node]));
  const offersOf = (id) => props.edges.filter((edge) => edge.kind === "includes" && edge.from === id).map((edge) => byId.get(edge.to)).filter(Boolean);
  const total = (pkg) => offersOf(pkg.id).reduce((sum, offer) => sum + offer.list * offer.units, 0);
  const packages = props.nodes.filter((node) => node.kind === "package").sort((a, b) => ORDER.indexOf(a.standing) - ORDER.indexOf(b.standing));
  const lead = packages[0];
  const most = Math.max(1, ...packages.map(total));
  const share = lead ? total(lead) / most : 0;
  graview.render(graview.html`
    <div class="home">
      ${lead ? graview.html`
        <section class="lead">
          <p class="eyebrow">The way in we recommend</p>
          <h1>${lead.label}</h1>
          <span class="figure">${money(total(lead))}</span>
          <svg class="ring" viewBox="0 0 36 36" role="img" aria-label="${Math.round(share * 100)}% of the largest package">
            <circle class="track" cx="18" cy="18" r="15" fill="none" stroke-width="4"/>
            <circle class="value" cx="18" cy="18" r="15" fill="none" stroke-width="4" stroke-dasharray="94.25" stroke-dashoffset="${(94.25 * (1 - share)).toFixed(2)}" transform="rotate(-90 18 18)"/>
          </svg>
        </section>` : graview.html`<p class="muted">No packages yet.</p>`}
      <div class="cards">
        ${packages.map((pkg) => graview.html`
          <a class="card" data-key="${pkg.id}" data-place="the-packages">
            <strong>${pkg.label}</strong>
            <span class="muted">${pkg.standing} · ${offersOf(pkg.id).length} offers · ${money(total(pkg))}</span>
          </a>`)}
      </div>
    </div>`);
});
