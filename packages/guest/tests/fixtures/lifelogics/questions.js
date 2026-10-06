// Open questions, as LifeLogics' declared lens draws them — written as a
// worker view: how many are open, then each open one as a card, by name,
// with why it matters.
//
// manifest: {
//   name: "questions", title: "Open questions", attach: "question", cardinality: "many"
// }

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n) => WORDS[n] ?? String(n);

graview.style(`
  .questions { display: grid; gap: 10px; padding: 12px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 10px; }
  .card { padding: 12px; border-radius: 12px; background: var(--graview-panel); border: 1px solid var(--graview-edge); }
  .card h4 { margin: 0 0 4px; }
`);

graview.onProps((props) => {
  const open = props.nodes
    .filter((node) => node.kind === "question" && node.status === "open")
    .sort((a, b) => a.name.localeCompare(b.name));
  graview.render(graview.html`
    <section class="questions">
      <p>${words(open.length)} things we do not know yet that the proposal depends on.</p>
      ${open.length === 0 ? graview.html`<p>Nothing is open.</p>` : graview.html`
        <div class="cards">
          ${open.map((question) => graview.html`
            <article class="card" data-key="${question.id}">
              <h4>${question.label}</h4>
              <p>${question.detail ?? ""}</p>
            </article>`)}
        </div>`}
    </section>`);
});
