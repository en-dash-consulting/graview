// The dinner's front page: the day in order, and the dishes still to confirm.
graview.style(`ol { margin: 0; padding: 0 0 0 1.2em; } .dish { display: flex; gap: 8px; align-items: center; }`);
graview.onProps((props) => {
  const moments = props.nodes.filter((node) => node.kind === "moment").sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const dishes = props.nodes.filter((node) => node.kind === "dish" && node.status === "proposed");
  graview.render(graview.html`
    <h2>The day</h2>
    <ol>${moments.map((moment) => graview.html`<li data-key=${moment.id}>${moment.label}</li>`)}</ol>
    <h2>Still to confirm</h2>
    ${dishes.map((dish) => graview.html`<div class="dish" data-key=${dish.id}>${dish.label} <button data-act="confirm-dish" data-id=${dish.id}>Confirm</button></div>`)}
  `);
});
