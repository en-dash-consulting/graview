// The stations at a glance: each camera, and how many detections it took.
//
// manifest: {
//   name: "glance", title: "Stations at a glance", attach: "station", cardinality: "many",
//   reads: { kinds: ["detection"], edges: ["taken-by"] }
// }

graview.style(`
  .glance { display: grid; gap: 8px; padding: 12px; }
  .glance li { padding: 8px 12px; border-radius: 10px; background: var(--graview-panel); border: 1px solid var(--graview-edge); }
`);

graview.onProps((props) => {
  const stations = props.nodes.filter((node) => node.kind === "station");
  const taken = (id) => props.edges.filter((edge) => edge.kind === "taken-by" && edge.to === id).length;
  graview.render(graview.html`<section class="glance">
    <h2>Stations at a glance</h2>
    <ul>${stations.map((station) => graview.html`<li data-key="${station.id}">${station.label}: ${String(taken(station.id))} detections</li>`)}</ul>
  </section>`);
});
