/*
 * A worker view that owes what only a browser finds (`pnpm verify a11y`,
 * "graviewViewCheckBrowserRunsEveryRule"): words too faint for their ground,
 * which only contrast measured on a laid-out page sees, beside a <div> the
 * view hears a click on, which the keyboard cannot reach, and two buttons the
 * keyboard walks through and out of.
 */
graview.style(".faint { color: #dddddd; }");
graview.render(graview.html`<p class="faint">Faint words</p><button type="button" class="first">First</button><div class="more">More about it</div><button type="button" class="last">Last</button>`);
graview.on("click", ".more", () => {});
