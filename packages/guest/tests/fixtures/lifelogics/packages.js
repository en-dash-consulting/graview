// The packages, as LifeLogics' declared lens draws them — written as a
// worker view: the recommended one first, each a row with what it includes
// and what it comes to at list, and a bar of its price against the largest.
//
// manifest: {
//   name: "packages", title: "The packages", attach: "package", cardinality: "many",
//   reads: { kinds: ["offer"], edges: ["includes"] }
// }

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n) => WORDS[n] ?? String(n);
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const ORDER = ["recommended", "alternative", "later"];

graview.style(`
  .packages { display: grid; gap: 10px; padding: 12px; }
  .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .row { display: grid; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--graview-panel); border: 1px solid var(--graview-edge); }
  .row.recommended { border-color: var(--graview-accent); }
  .bar { height: 6px; border-radius: 3px; background: var(--graview-edge); }
  .bar span { display: block; height: 100%; border-radius: 3px; background: var(--graview-accent); }
  .in { margin: 0; padding-left: 1.2em; color: var(--graview-ink-muted); }
`);

graview.onProps((props) => {
  const byId = new Map(props.nodes.map((node) => [node.id, node]));
  const offersOf = (id) => props.edges.filter((edge) => edge.kind === "includes" && edge.from === id).map((edge) => byId.get(edge.to)).filter(Boolean);
  const total = (pkg) => offersOf(pkg.id).reduce((sum, offer) => sum + offer.list * offer.units, 0);
  const packages = props.nodes.filter((node) => node.kind === "package").sort((a, b) => ORDER.indexOf(a.standing) - ORDER.indexOf(b.standing));
  const most = Math.max(1, ...packages.map(total));
  graview.render(graview.html`
    <section class="packages">
      <p>The same offers in ${words(packages.length)} sets, compared on price.</p>
      ${packages.length === 0 ? graview.html`<p>No packages yet.</p>` : graview.html`
        <ul class="rows">
          ${packages.map((pkg) => graview.html`
            <li class="row ${pkg.standing}" data-key="${pkg.id}">
              <strong>${pkg.label}</strong>
              ${pkg.standing === "recommended" ? graview.html`<mark>Recommended</mark>` : ""}
              <p>${pkg.summary ?? ""}</p>
              <ul class="in">${offersOf(pkg.id).map((offer) => graview.html`<li data-key="${offer.id}">${offer.label}</li>`)}</ul>
              <div class="bar" role="img" aria-label="${money(total(pkg))} at list"><span style="width: ${Math.round((total(pkg) / most) * 100)}%"></span></div>
            </li>`)}
        </ul>`}
    </section>`);
});
