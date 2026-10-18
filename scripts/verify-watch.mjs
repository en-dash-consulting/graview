#!/usr/bin/env node
/**
 * The watch, made to fire.
 *
 * A rule that never fires is indistinguishable from a rule that cannot.
 * This builds one page per rule that breaks it on purpose, and one that
 * keeps every rule, and asks the watch (lib/watch.mjs) what it saw: each
 * rule must name its page, and the clean page must name nothing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { takeViolations } from "./lib/watch.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engine = engineName();
const browser = await launchEngine(engine);
const page = await browser.newPage();
const settle = () => page.waitForTimeout(2800);
/* Served, not setContent: the watch is an init script, and only a navigation runs one. */
let served = "";
await page.route("http://watch.test/**", (route) => route.fulfill({ contentType: "text/html", body: served }));
let visit = 0;
const show = async (html) => {
  served = `<!doctype html><html><body>${html}</body></html>`;
  await page.goto(`http://watch.test/${++visit}`);
};

/* The store's half, played by the page: what @graview/core tells a watching harness. */
const learn = () =>
  page.evaluate(() =>
    window.__graviewWatch.learn({ ids: ["deal", "close-deal", "sales-manager", "closedAt", "user-priya"], words: ["Close the deal", "Deals"] }),
  );

const checks = {};

/* keyboard-lands-nowhere: Escape closes a popover by removing it, and nothing takes the keyboard. */
await show(`<main><button id="opener">Open</button><div id="pop"><button id="inside">Close</button></div></main>
<script>document.getElementById("inside").addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("pop").remove(); });</script>`);
await page.focus("#inside");
await page.keyboard.press("Escape");
await settle();
checks.theKeyboardLeftOnBodyIsCaught = takeViolations().some((v) => v.rule === "keyboard-lands-nowhere" && v.detail.startsWith("Escape"));

/* machine-words-shown: an act's name on a button, and a field key in a tooltip. */
await show(`<main><button>close-deal</button><span title="closedAt">09:00</span><p>Close the deal — a sales manager can.</p><code>close-deal</code></main>`);
await learn();
await settle();
const shown = takeViolations().filter((v) => v.rule === "machine-words-shown");
checks.anActsNameAsTextIsCaught = shown.some((v) => v.detail.includes('"close-deal" is shown as text'));
checks.aFieldKeyReadOutIsCaught = shown.some((v) => v.detail.includes('"closedAt" is read out in title'));
checks.codeIsNotPeopleText = shown.length === 2;

/* machine-words-shown, the key's own words: "Vin" over a field the kind calls "VIN", "suv" where the record says "SUV". */
await show(`<main><form><label><span>Vin *</span><input></label><label><span>Body style</span><select><option>suv</option><option>Saloon</option></select></label></form><p>The vin is on the windscreen.</p></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: ["vin"], words: ["VIN"], unsaid: ["Vin", "suv", "Suv"] }));
await settle();
const plain = takeViolations().filter((v) => v.rule === "machine-words-shown").map((v) => v.detail);
checks.aKeysOwnWordsAreCaught = plain.some((d) => d.startsWith('"Vin" is shown')) && plain.some((d) => d.startsWith('"suv" is shown'));
checks.aWordInASentenceIsNotAKey = plain.length === 2;

/* One store's key is another's declared word: the studio's "people" flag says "People", and the app it edits calls its people "People". */
await show(`<main><h2><span>People</span></h2></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: ["people"], words: ["stands for the people"], unsaid: ["People"] }));
await page.evaluate(() => window.__graviewWatch.learn({ ids: ["user"], words: ["People"], unsaid: [] }));
await settle();
checks.aWordAnotherStoreDeclaresIsNotAKey = takeViolations().filter((v) => v.rule === "machine-words-shown").length === 0;

/* Shown though not spoken: a kind's id on a card's tag that screen readers skip is still read by eye. */
await show(`<main><div role="group" aria-label="2024 Kia Sportage"><span aria-hidden="true">vehicle</span><span aria-hidden="true">close-deal</span></div></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: ["vehicle", "close-deal"], words: ["Car"], unsaid: ["vehicle"] }));
await settle();
const tagged = takeViolations().filter((v) => v.rule === "machine-words-shown").map((v) => v.detail);
checks.shownThoughNotSpokenIsCaught = tagged.some((d) => d.startsWith('"vehicle"')) && tagged.some((d) => d.startsWith('"close-deal"'));

/* machine-words-shown, a record's minted id (the twelfth walk): in a closed picker's options too; a kind said in a sentence is not one. */
await show(`<main><form><label><span>Film</span><select><option>—</option><option>Small Harbor · film:small-harbor</option></select></label></form><p>A film: something the festival keeps.</p></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [], kinds: ["film", "venue"] }));
await settle();
const minted = takeViolations().filter((v) => v.rule === "machine-words-shown").map((v) => v.detail);
checks.aRecordsIdInAPickerIsCaught = minted.length === 1 && minted[0].startsWith('"film:small-harbor" is shown');

/* offered-then-refused by the act's own input (the twelfth walk): a press on an offer is caught; a form a person filled wrongly is not. */
await show(`<main><button id="offer">Schedule Under Weather</button><form><input id="typed"><button id="send">Schedule</button></form></main>
<script>document.querySelector("form").addEventListener("submit", (e) => e.preventDefault());</script>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await page.click("#offer");
await page.evaluate(() => window.__graviewWatch.refusedInput({ mutation: "schedule", message: "venueId: expected string", author: "staff:tomas" }));
await page.click("#send");
await page.evaluate(() => window.__graviewWatch.refusedInput({ mutation: "schedule", message: "startsAt: expected string", author: "staff:tomas" }));
await settle();
const refusedByInput = takeViolations().filter((v) => v.rule === "offered-then-refused").map((v) => v.detail);
checks.anOfferItsInputRefusesIsCaught = refusedByInput.length === 1 && refusedByInput[0].includes("its own input refused it: venueId");

/* shown-what-is-not-theirs: a customer the seat may not see, named on the page; a name it may see is not. */
await show(`<main><h1>Cars</h1><p>Shortlisted by Freya Davies</p><p>Signed in as Bethan Okonkwo</p></main>`);
await page.evaluate(() => window.__graviewWatch.unseen({ words: ["Freya Davies", "freya.davies1@mail.example"] }));
await settle();
const exposed = takeViolations().filter((v) => v.rule === "shown-what-is-not-theirs").map((v) => v.detail);
checks.aRecordTheSeatMayNotSeeIsCaught = exposed.length === 1 && exposed[0].startsWith('"Freya Davies"');

/* Two surfaces, two seats: a name one of them may see is not caught on the page they share. */
await show(`<main><section aria-label="As the store"><p>Shortlisted by Freya Davies</p></section><section aria-label="As Bethan"><p>Signed in as Bethan Okonkwo</p></section></main>`);
await page.evaluate(() => {
  window.__graviewWatch.unseen({ words: ["Freya Davies"], from: "bethan" });
  window.__graviewWatch.unseen({ words: [], from: "store" });
});
await settle();
checks.whatOneSeatMaySeeIsNotCaughtBesideAnother = takeViolations().filter((v) => v.rule === "shown-what-is-not-theirs").length === 0;

/* A seat switcher names the people one may sit as; that is not showing their record. */
await show(`<main><div role="group" aria-label="Seat"><button type="button">Aiyana Whitehorse, volunteer</button></div><p>Shortlisted by Freya Davies</p></main>`);
await page.evaluate(() => window.__graviewWatch.unseen({ words: ["Aiyana Whitehorse", "Freya Davies"] }));
await settle();
const seated = takeViolations().filter((v) => v.rule === "shown-what-is-not-theirs").map((v) => v.detail);
checks.aSeatToTakeIsNotARecordShown = seated.length === 1 && seated[0].startsWith('"Freya Davies"');

/* breaks-at-width: a page wider than its window. */
await page.setViewportSize({ width: 390, height: 800 });
await show(`<main><p style="white-space:nowrap">ravi.robertson63@mail.example-and-a-long-unbroken-word-past-the-edge-of-a-phone</p></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
checks.aPageThatScrollsSidewaysIsCaught = takeViolations().some((v) => v.rule === "breaks-at-width");
await page.setViewportSize({ width: 1280, height: 800 });

/*
 * target-too-small: two 22-pixel controls side by side — the districts'
 * "open" at a phone's width, the eighth walk — and none where the same small
 * control stands alone, or is a link in a sentence.
 */
await show(`<main><span><button style="all:unset;width:22px;height:22px;display:inline-block">open</button><button style="all:unset;width:22px;height:22px;display:inline-block">open</button></span></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
const crowded = takeViolations().filter((v) => v.rule === "target-too-small");
await show(`<main><button style="all:unset;width:22px;height:22px;display:inline-block">open</button><p style="margin-top:40px">Read <a href="#more">more</a> about it.</p></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
const alone = takeViolations().filter((v) => v.rule === "target-too-small");
checks.aTargetTooSmallIsCaught = crowded.length > 0 && alone.length === 0;

/*
 * control-covered: a raised chip standing over the arranging line's "Sort"
 * (the rota, the tenth walk) — and nothing where a menu was opened over the
 * same control on purpose, or where the chip stands clear of it.
 */
const chipOver = (top) =>
  `<main style="position:relative;padding:40px"><div style="padding-top:20px"><button style="width:80px;height:28px">Sort</button><button style="width:80px;height:28px">Filter</button></div>
<div style="position:absolute;left:30px;top:${top}px;background:#fff;padding:4px"><button style="width:90px;height:26px">Shifts ×</button></div></main>`;
await show(chipOver(52));
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
const standsOver = takeViolations().filter((v) => v.rule === "control-covered");
await show(chipOver(0));
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
const standsClear = takeViolations().filter((v) => v.rule === "control-covered");
await show(`<main style="position:relative;padding:40px"><button style="width:80px;height:28px">Sort</button>
<div role="menu" style="position:absolute;left:30px;top:30px;background:#fff;padding:4px"><button role="menuitem" style="width:120px;height:40px">Sort by name</button></div></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
const openedOver = takeViolations().filter((v) => v.rule === "control-covered");
/*
 * And nothing under a bar stuck to the top of the page, at the page's foot:
 * graview.dev's long version at 900 wide, scrolled to its end, with
 * "Chapter fourteen" under the lower half of the sticky rail. Scrolling
 * back up brings it out; it was said to be covered because the link in
 * the rail had its middle lower than the chapter's.
 */
await show(`<div style="position:sticky;top:0;height:150px;background:#fff;z-index:1"><a href="#a" style="position:absolute;left:20px;top:110px;display:block;width:200px;height:30px">The garden, grown</a></div>
<main style="margin:0"><div style="height:2400px"></div><p style="margin:0;padding-left:20px"><a href="#b" style="display:inline-block;height:24px;width:140px">Chapter fourteen</a></p><div style="height:676px"></div></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
// Scrolled to its end, and then the page changes there, as a chapter mounting at the foot does.
await page.evaluate(() => {
  window.scrollTo({ top: 1e6, behavior: "instant" });
  document.querySelector("main").setAttribute("title", "The long version");
});
await settle();
const stuckAtTheTop = takeViolations().filter((v) => v.rule === "control-covered");
checks.aControlCoveredByAnotherIsCaught = standsOver.length > 0 && standsOver[0].detail.includes("Sort") && standsClear.length === 0 && openedOver.length === 0 && stuckAtTheTop.length === 0;

/*
 * card-wider-than-screen: seedbed's plot card on a phone, two columns of 200
 * and 220 pixels in a card 293 wide, its relationships cut off past the
 * screen (the tenth walk) — and nothing where the wide part is a scroller.
 */
await page.setViewportSize({ width: 390, height: 800 });
const plotCard = (scrolls) =>
  `<main><div data-graview-primitive="panel" data-graview-variant="card" style="width:293px;margin-left:24px;overflow:hidden"><h2>Plot 1</h2>
<div style="${scrolls ? "overflow-x:auto" : ""}"><div style="display:grid;grid-template-columns:200px 220px;gap:34px"><div>Beds 4</div><div>Who looks after it: June</div></div></div></div></main>`;
await show(plotCard(false));
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
const cutOff = takeViolations().filter((v) => v.rule === "card-wider-than-screen");
await show(plotCard(true));
await page.evaluate(() => window.__graviewWatch.learn({ ids: [], words: [] }));
await settle();
const scrolled = takeViolations().filter((v) => v.rule === "card-wider-than-screen");
checks.aCardWiderThanItsScreenIsCaught = cutOff.length > 0 && scrolled.length === 0;
await page.setViewportSize({ width: 1280, height: 800 });

/* offered-then-refused: the store refused a press. */
await show(`<main><button>Close the deal</button></main>`);
await page.evaluate(() => window.__graviewWatch.refused({ mutation: "close-deal", kind: "deal", message: "Not permitted", author: "user-priya" }));
await settle();
checks.aRefusedPressIsCaught = takeViolations().some((v) => v.rule === "offered-then-refused" && v.detail.includes("close-deal"));

/* The clean page: focus moves back to the opener, every name is in words. */
await show(`<main><button id="opener">Open</button><div id="pop"><button id="inside">Close the deal</button></div><p>Deals</p></main>
<script>document.getElementById("inside").addEventListener("keydown", (e) => { if (e.key === "Escape") { document.getElementById("pop").remove(); document.getElementById("opener").focus(); } });</script>`);
await learn();
await page.focus("#inside");
await page.keyboard.press("Escape");
await settle();
const clean = takeViolations();
checks.aCleanPageNamesNothing = clean.length === 0;

await browser.close();
const passed = Object.values(checks).every(Boolean);
const report = { at: new Date().toISOString(), engine, checks, ...(clean.length ? { cleanPageSaw: clean } : {}), passed };
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/watch-check.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, ok] of Object.entries(checks)) process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}\n`);
process.stdout.write(passed ? "the watch fires on every rule and nowhere else\n" : "the watch does not hold\n");
process.exit(passed ? 0 : 1);
