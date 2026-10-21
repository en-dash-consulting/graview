// An architecture map: every zone a circle, every dependency a line, in one
// SVG that a wheel zooms around the pointer, a pinch zooms (a trackpad's,
// or Safari's) and a drag pans, by moving its viewBox. A click on a zone
// that was not the end of a drag opens the zone.
//
// manifest: {
//   name: "map", title: "Architecture map", attach: "zone", cardinality: "many",
//   reads: { edges: ["dependsOn"] }, gestures: true
// }

const WIDTH = 800;
const HEIGHT = 500;
let box = { x: 0, y: 0, w: WIDTH, h: HEIGHT };
let shown;
let heard = "none";
let moved = 0;

graview.style(`
  .map { display: block; width: 100%; height: 420px; touch-action: none; user-select: none; cursor: grab;
         background: var(--graview-panel); border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); }
  .link { stroke: var(--graview-edge); stroke-width: 2; }
  .zone { cursor: pointer; }
  .zone circle { fill: var(--graview-ground); stroke: var(--graview-accent); stroke-width: 2; }
  .zone text { fill: var(--graview-ink); font: 14px var(--graview-font-body); text-anchor: middle; }
`);

/** Where each zone sits: around a ring, in the order the records came. */
function placed(zones) {
  return new Map(zones.map((zone, i) => {
    const turn = (i / Math.max(1, zones.length)) * 2 * Math.PI - Math.PI / 2;
    return [zone.id, { x: WIDTH / 2 + Math.cos(turn) * 180, y: HEIGHT / 2 + Math.sin(turn) * 150 }];
  }));
}

function draw() {
  if (!shown) return;
  const zones = shown.nodes.filter((node) => node.kind === "zone");
  const at = placed(zones);
  const links = shown.edges.filter((edge) => edge.kind === "dependsOn" && at.has(edge.from) && at.has(edge.to));
  const viewBox = [box.x, box.y, box.w, box.h].map((n) => Math.round(n * 100) / 100).join(" ");
  graview.render(graview.html`
    <svg class="map" viewBox="${viewBox}" data-heard="${heard}" role="img" aria-label="${zones.length} zones and what each depends on">
      ${links.map((edge) => graview.html`<line class="link" data-key="${edge.from + ">" + edge.to}"
        x1="${at.get(edge.from).x}" y1="${at.get(edge.from).y}" x2="${at.get(edge.to).x}" y2="${at.get(edge.to).y}"></line>`)}
      ${zones.map((zone) => graview.html`<g class="zone" data-key="${zone.id}" data-zone="${zone.id}">
        <circle cx="${at.get(zone.id).x}" cy="${at.get(zone.id).y}" r="34"></circle>
        <text x="${at.get(zone.id).x}" y="${at.get(zone.id).y + 5}">${zone.label}</text></g>`)}
    </svg>`);
}
graview.onProps((props) => {
  shown = props;
  draw();
});

/*
 * A gesture says where the pointer is in pixels of the element (e.x, e.y)
 * and that element's size (e.width, e.height). The SVG fits its viewBox in
 * whole, centered: this is how many pixels a unit of the map is, and where
 * the map begins.
 */
function fit(e) {
  const scale = Math.min(e.width / box.w, e.height / box.h) || 1;
  return { scale, left: (e.width - box.w * scale) / 2, top: (e.height - box.h * scale) / 2 };
}
/** Grow the map by `factor` around the pointer, from a quarter of its size to four times it. */
function zoom(e, factor) {
  const now = WIDTH / box.w;
  const k = Math.min(4, Math.max(0.25, now * factor)) / now;
  const { scale, left, top } = fit(e);
  const px = box.x + (e.x - left) / scale;
  const py = box.y + (e.y - top) / scale;
  box = { x: px - (px - box.x) / k, y: py - (py - box.y) / k, w: box.w / k, h: box.h / k };
  draw();
}

graview.on("wheel", ".map", (e) => {
  heard = "wheel";
  zoom(e, Math.exp(-(e.deltaY * (e.deltaMode === 1 ? 16 : 1)) / 500));
});
graview.on("pinch", ".map", (e) => {
  heard = "pinch";
  zoom(e, e.scale);
});
graview.on("drag", ".map", (e) => {
  if (e.phase === "start") return void (moved = 0);
  heard = "drag";
  moved += Math.abs(e.dx) + Math.abs(e.dy);
  const { scale } = fit(e);
  box = { ...box, x: box.x - e.dx / scale, y: box.y - e.dy / scale };
  draw();
});
graview.on("click", "[data-zone]", (e) => {
  if (moved < 4) graview.navigate(e.element.getAttribute("data-zone"));
});
