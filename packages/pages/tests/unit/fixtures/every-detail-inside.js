graview.style(`.bk{display:grid;gap:1.5rem}.hero{padding:1.5rem;border-radius:var(--graview-radius);border:1px solid var(--graview-edge)}.next{padding:1.25rem;border-radius:var(--graview-radius);border:2px solid var(--graview-accent)}.tag{font-size:.75rem;margin-right:.4rem}.list{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}.stats{display:flex;gap:1.5rem}`);
graview.onProps((props) => {
  const all = (props.nodes || []).filter(Boolean);
  const of = (k) => all.filter((n) => n.kind === k);
  const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/-/g, " ") : "");
  const p = of("purpose")[0] || {};
  const chapters = of("chapter").sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const next = chapters.find((c) => !c.draft);
  const raw = of("idea").filter((i) => i.status === "raw").slice(0, 3);
  const cands = of("story").filter((s) => s.status === "candidate").slice(0, 3);
  const goals = of("goal");
  const COUNTS = true;
  graview.render(graview.html`<div class="bk">
    <section class="hero">${p.coverLine ? graview.html`<span class="tag">${p.coverLine}</span>` : ""}<span class="tag">Your book</span><h3>${p.title}</h3><p>${p.thesis}</p></section>
    ${next ? graview.html`<section class="next"><strong>Your next step</strong><p>Open <a data-record="${next.id}">${next.title}</a> <span class="tag">${cap(next.status)}</span> and write a rough first page.</p></section>` : ""}
    <section><strong>Ideas to triage</strong><ul class="list">${raw.map((i) => graview.html`<li><a data-record="${i.id}">${i.title}</a> <span class="tag">${cap(i.status)}</span></li>`)}</ul></section>
    <section><strong>Stories to keep or cut</strong><ul class="list">${cands.map((s) => graview.html`<li><a data-record="${s.id}">${s.title}</a> <span class="tag">${cap(s.type)}</span><span class="tag">${cap(s.status)}</span><span class="tag">${cap(s.factCheck)}</span></li>`)}</ul></section>
    <section><strong>What readers walk away with</strong><ul class="list">${goals.map((g) => graview.html`<li><a data-record="${g.id}">${g.statement}</a> <span class="tag">${cap(g.priority)}</span><span>${COUNTS ? "1 chapters · 0 stories · 0 ideas" : "1 chapter · no stories or ideas yet"}</span>${COUNTS ? graview.html`<span class="tag">Draft</span>` : ""}</li>`)}</ul></section>
    <section><strong>The outline</strong><ul class="list">${chapters.filter((c) => c !== next).map((c) => graview.html`<li><a data-record="${c.id}">${c.title}</a> <span class="tag">${cap(c.status)}</span><span>${COUNTS ? "0 ideas · 0 stories" : "no ideas or stories yet"}</span></li>`)}</ul></section>
  </div>`);
});
