// The offers, as LifeLogics' declared lens draws them from blocks — written
// as a worker view instead: a sentence of counts, then each offer as a card
// under the stage it belongs to, with its price after the client's discount.
//
// manifest: {
//   name: "offers", title: "The offers", attach: "offer", cardinality: "many",
//   reads: { kinds: ["party"] }
// }

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n) => WORDS[n] ?? String(n);
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const STAGES = [["start", "The way in"], ["later", "For afterwards"]];

graview.style(`
  .offers { display: grid; gap: 12px; padding: 12px; }
  .offers h3 { margin: 8px 0 0; font: 600 1rem/1.2 var(--graview-font-body); color: var(--graview-ink-muted); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 10px; }
  .card { display: grid; gap: 4px; padding: 12px; border-radius: 12px; background: var(--graview-panel); border: 1px solid var(--graview-edge); }
  .card a { color: var(--graview-ink); font-weight: 600; text-decoration: none; }
  .price { font-variant-numeric: tabular-nums; color: var(--graview-accent); }
`);

graview.onProps((props) => {
  const client = props.nodes.find((node) => node.kind === "party" && node.role === "client");
  const discount = client && typeof client.discount === "number" ? client.discount : 0;
  const offers = props.nodes.filter((node) => node.kind === "offer");
  const of = (stage) => offers.filter((offer) => offer.stage === stage);
  graview.render(graview.html`
    <section class="offers">
      <p>${words(of("start").length)} ways in and ${words(of("later").length)} for afterwards, each at list and after the discount.</p>
      ${offers.length === 0 ? graview.html`<p>No offers yet.</p>` : STAGES.filter(([stage]) => of(stage).length > 0).map(([stage, heading]) => graview.html`
        <h3>${heading}</h3>
        <div class="cards">
          ${of(stage).map((offer) => graview.html`
            <article class="card" data-key="${offer.id}">
              <h4><a data-record="${offer.id}">${offer.label}</a></h4>
              <p>${offer.summary ?? ""}</p>
              <p class="price">${money(offer.list * offer.units)} at list, ${money(offer.list * offer.units * (1 - discount / 100))} after the discount</p>
            </article>`)}
        </div>`)}
    </section>`);
});
