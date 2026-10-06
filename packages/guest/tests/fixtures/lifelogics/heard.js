// What we heard, as LifeLogics' declared lens draws it — written as a
// worker view: what asks for a reply, counted, then every note under the
// kind of note it is.
//
// manifest: {
//   name: "heard", title: "What we heard", attach: "signal", cardinality: "many"
// }

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n) => WORDS[n] ?? String(n);
const KINDS = [["pain", "What hurts"], ["opportunity", "What they could do"], ["ask", "What they asked for"], ["fact", "What is simply true"]];

graview.style(`
  .heard { display: grid; gap: 8px; padding: 12px; }
  .heard h3 { margin: 8px 0 0; font: 600 1rem/1.2 var(--graview-font-body); }
  .heard ul { margin: 0; padding-left: 1.2em; }
  .heard a { color: var(--graview-ink); }
`);

graview.onProps((props) => {
  const notes = props.nodes.filter((node) => node.kind === "signal");
  const replying = notes.filter((note) => note.type !== "fact").length;
  graview.render(graview.html`
    <section class="heard">
      <p>${words(replying)} things that ask for a reply, and the facts around them.</p>
      ${notes.length === 0 ? graview.html`<p>Nothing heard yet.</p>` : KINDS.filter(([kind]) => notes.some((note) => note.type === kind)).map(([kind, heading]) => graview.html`
        <h3>${heading}</h3>
        <ul>${notes.filter((note) => note.type === kind).map((note) => graview.html`<li data-key="${note.id}"><a data-record="${note.id}">${note.label}</a></li>`)}</ul>`)}
    </section>`);
});
