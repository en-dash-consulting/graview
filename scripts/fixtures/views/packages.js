// The packages: LifeLogics' package lens, as a worker view. Each package,
// its standing, what it costs and the offers in it — read from the offers
// and the `includes` edges its manifest asks for, and nothing else.
//
// manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many",
//             reads: { kinds: ["offer"], edges: ["includes"] } }

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const ORDER = ["recommended", "alternative", "later"];

graview.style(`
  .lens { display: grid; gap: 12px; padding: 12px; }
  .lens h2 { margin: 0; font: 600 1.25rem/1.2 var(--graview-font-body); color: var(--graview-ink); }
  .package { background: var(--graview-panel); color: var(--graview-ink); border: 1px solid var(--graview-edge); border-radius: 12px; padding: 12px 16px; display: grid; gap: 6px; }
  .package.recommended { border-color: var(--graview-accent); }
  .package header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .package h3 { margin: 0; font-size: 1.05rem; }
  .tag { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--graview-accent); }
  .price { font-variant-numeric: tabular-nums; font-weight: 600; }
  .offers { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; color: var(--graview-ink-muted); }
  .offers li { display: flex; justify-content: space-between; gap: 12px; }
  .offers a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  @media (max-width: 420px) { .package header { display: grid; } }
`);

graview.onProps((props) => {
  const byId = new Map(props.nodes.map((node) => [node.id, node]));
  const offersOf = (id) => props.edges.filter((edge) => edge.kind === "includes" && edge.from === id).map((edge) => byId.get(edge.to)).filter(Boolean);
  const packages = props.nodes.filter((node) => node.kind === "package").sort((a, b) => ORDER.indexOf(a.standing) - ORDER.indexOf(b.standing));
  const kinds = [...new Set(props.nodes.map((node) => node.kind))].sort().join(" ");
  graview.render(graview.html`
    <div class="lens" data-scheme="${props.theme ? props.theme.scheme : ""}" data-kinds="${kinds}">
      <h2>${props.label || "The packages"}</h2>
      ${packages.map((pkg) => {
        const offers = offersOf(pkg.id);
        const total = offers.reduce((sum, offer) => sum + offer.list * offer.units, 0);
        return graview.html`
          <article class="package ${pkg.standing}" data-key="${pkg.id}">
            <header><span class="tag">${pkg.standing}</span><h3>${pkg.label}</h3><span class="price">${money(total)}</span></header>
            <ul class="offers">${offers.map((offer) => graview.html`<li data-key="${offer.id}"><a data-record="${offer.id}">${offer.label}</a><span>${money(offer.list * offer.units)}</span></li>`)}</ul>
          </article>`;
      })}
    </div>`);
});
