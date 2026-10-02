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

/* Shown though not spoken: a kind's id on a card's tag that screen readers skip is still read by eye. */
await show(`<main><div role="group" aria-label="2024 Kia Sportage"><span aria-hidden="true">vehicle</span><span aria-hidden="true">close-deal</span></div></main>`);
await page.evaluate(() => window.__graviewWatch.learn({ ids: ["vehicle", "close-deal"], words: ["Car"], unsaid: ["vehicle"] }));
await settle();
const tagged = takeViolations().filter((v) => v.rule === "machine-words-shown").map((v) => v.detail);
checks.shownThoughNotSpokenIsCaught = tagged.some((d) => d.startsWith('"vehicle"')) && tagged.some((d) => d.startsWith('"close-deal"'));

/* shown-what-is-not-theirs: a customer the seat may not see, named on the page; a name it may see is not. */
await show(`<main><h1>Cars</h1><p>Shortlisted by Freya Davies</p><p>Signed in as Bethan Okonkwo</p></main>`);
await page.evaluate(() => window.__graviewWatch.unseen({ words: ["Freya Davies", "freya.davies1@mail.example"] }));
await settle();
const exposed = takeViolations().filter((v) => v.rule === "shown-what-is-not-theirs").map((v) => v.detail);
checks.aRecordTheSeatMayNotSeeIsCaught = exposed.length === 1 && exposed[0].startsWith('"Freya Davies"');

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
