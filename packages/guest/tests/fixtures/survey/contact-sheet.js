// A station's contact sheet: each detection its camera took, with its photograph.
//
// manifest: {
//   name: "contact-sheet", title: "Contact sheet", attach: "station", cardinality: "one",
//   reads: { kinds: ["detection"], edges: ["taken-by"] }, pictures: true
// }

graview.onProps((props) => {
  if (!props.node) {
    graview.render(graview.html`<p>No station.</p>`);
    return;
  }
  const taken = props.edges.filter((edge) => edge.kind === "taken-by" && edge.to === props.node.id).map((edge) => edge.from);
  const shots = props.nodes.filter((node) => taken.includes(node.id));
  graview.render(graview.html`<section>
    <h2>${props.node.label}</h2>
    <ul>${shots.map((shot) => graview.html`<li data-key="${shot.id}" data-record="${shot.id}">${shot.photo && shot.photo.src ? graview.html`<img src="${shot.photo.src}" alt="${shot.label}">` : ""}${shot.label}</li>`)}</ul>
  </section>`);
});
