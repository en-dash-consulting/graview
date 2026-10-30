// The same home, rewritten whole: the greeting restyled, "This week" kept as markup, its rules dropped, and "Dinner" gone.
graview.style(`
  .hf-home { display: grid; gap: 32px; }
  .hf-hello { font-size: 32px; color: var(--graview-accent); }
`);
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
graview.onProps(() => {
  graview.render(graview.html`<div class="hf-home">
    <h1 class="hf-hello">Good evening</h1>
    <section class="hf-week" aria-labelledby="wk"><h2 id="wk">This week</h2>
      ${days.map((day) => graview.html`<div class="hf-wk-day js-pick" data-key="${day}"><h3>${day}</h3></div>`)}
    </section>
  </div>`);
});
