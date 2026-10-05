// A list lens: the offers, cheapest first, each with the packages it is in,
// and a way to note something down.
//
// manifest: {
//   name: "offers", title: "The offers", attach: "offer", cardinality: "many",
//   reads: { kinds: ["package"], edges: ["includes"] },
//   acts: ["add-note"]
// }

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

graview.style(`
  .offers { display: grid; gap: 8px; padding: 12px; }
  .offers h2 { margin: 0 0 4px; font: 600 1.15rem/1.2 var(--graview-font-body); }
  .row { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 8px 12px;
         background: var(--graview-panel); border: 1px solid var(--graview-edge); border-radius: 10px; }
  .row a { color: var(--graview-ink); font-weight: 600; text-decoration: none; }
  .row a:hover, .row a:focus-visible { text-decoration: underline; }
  .price { font-variant-numeric: tabular-nums; }
  .in { grid-column: 1 / -1; color: var(--graview-ink-muted); font-size: 0.85rem; }
  fieldset { border: 0; padding: 0; display: flex; gap: 8px; }
  input { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--graview-edge); background: var(--graview-ground); color: var(--graview-ink); }
  button { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--graview-accent); background: transparent; color: var(--graview-accent); cursor: pointer; }
  @media (max-width: 420px) { .row { grid-template-columns: 1fr; } }
`);

let said = "";

graview.on("click", "button", (event) => {
  said = event.pressed && event.pressed.ok ? "Noted." : event.pressed ? event.pressed.message : "";
  draw(graview.props);
});

function draw(props) {
  const offers = props.nodes.filter((node) => node.kind === "offer").sort((a, b) => a.list * a.units - b.list * b.units);
  const packagesOf = (id) => props.edges.filter((edge) => edge.kind === "includes" && edge.to === id).map((edge) => props.nodes.find((node) => node.id === edge.from)).filter(Boolean);
  graview.render(graview.html`
    <section class="offers">
      <h2>${props.label}</h2>
      ${offers.map((offer) => graview.html`
        <div class="row" data-key="${offer.id}">
          <a data-record="${offer.id}">${offer.label}</a>
          <span class="price">${money(offer.list * offer.units)}</span>
          <span class="in">${packagesOf(offer.id).map((pkg) => pkg.label).join(", ") || "In no package yet"}</span>
        </div>`)}
      <fieldset>
        <input name="label" placeholder="Something we heard" aria-label="A note">
        <button data-act="add-note">Note it</button>
      </fieldset>
      <p role="note">${said}</p>
    </section>`);
}

graview.onProps(draw);
