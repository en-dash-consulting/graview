// What we heard: the notes, as a worker view, with a way to the packages.
//
// manifest: { name: "notes", title: "What we heard", attach: "signal", cardinality: "many" }

graview.style(`
  .notes { display: grid; gap: 8px; padding: 12px; }
  .notes h2 { margin: 0; font-size: 1.1rem; }
  .notes ul { margin: 0; padding-left: 1.2em; }
  .notes a { color: var(--graview-accent); text-decoration: underline; }
`);

// A delegated handler reads the data-* of the element its selector matched: event.element.
// A bare string is a record's id first, then a place's slug; one that is neither says why in the console.
graview.on("click", "button[data-go]", (event) => graview.navigate(event.element.getAttribute("data-go")));

graview.onProps((props) => {
  graview.render(graview.html`
    <div class="notes">
      <h2>${props.label || "What we heard"}</h2>
      <ul>${props.nodes.map((note) => graview.html`<li data-key="${note.id}">${note.label}</li>`)}</ul>
      <p><a id="to-packages" data-place="the-packages">See the packages</a> · <a id="out" href="https://example.com/elsewhere">Somewhere else</a></p>
      <p><button type="button" id="go-packages" data-go="the-packages">Go to the packages</button> <button type="button" id="go-nowhere" data-go="projections">Projections</button></p>
    </div>`);
});
