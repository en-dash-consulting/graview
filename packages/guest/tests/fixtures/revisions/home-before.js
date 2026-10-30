// Homeflow's home, as it stood: a greeting, "This week" laid out as a strip of days, and "Dinner".
graview.style(`
  .hf-home { display: grid; gap: 24px; }
  .hf-hello { font-size: 28px; color: var(--graview-ink); }
  .hf-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
  .hf-wk-day { border-radius: var(--graview-radius); padding: 8px; background: var(--graview-panel); }
  .hf-wk-day h3 { font-size: 13px; margin: 0; }
  .hf-dinner { padding: 16px; }
`);
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
graview.onProps(() => {
  graview.render(graview.html`<div class="hf-home">
    <h1 class="hf-hello">Good evening</h1>
    <section class="hf-week" aria-labelledby="wk"><h2 id="wk">This week</h2>
      ${days.map((day) => graview.html`<div class="hf-wk-day js-pick" data-key="${day}"><h3>${day}</h3></div>`)}
    </section>
    <section class="hf-dinner" aria-labelledby="dn"><h2 id="dn">Dinner</h2><p>Soup</p></section>
  </div>`);
});
