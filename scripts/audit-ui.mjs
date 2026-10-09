#!/usr/bin/env node
/**
 * What is actually WRONG on each screen, in numbers.
 *
 * `survey-ui.mjs` photographs every place a person can land; this asks the
 * questions a photograph makes you squint at — are two cards on top of each
 * other, is a control smaller than a fingertip, does a caption end in an
 * ellipsis mid-word, is the same string on screen twice. Every one of these
 * was found by eye first, which is exactly why they belong in a script.
 *
 *   node scripts/audit-ui.mjs [app]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { pressPlace } from "./lib/places.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

/*
 * THE KEEPER'S WAYS IN, AND THE READER'S OWN SETTINGS, LIVE BEHIND THE
 * PROFILE. "Show the installation" and "Studio" were pills on the bar
 * beside the places, where every reader met two controls only a keeper can
 * use; the scheme was there AND in the pane, which is two controls for one
 * setting. A harness opens the pane before reaching for any of them.
 */
const openProfile = async (page) => {
  const shown = await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="profile"]');
    return pane !== null && !pane.hasAttribute("hidden");
  });
  if (shown) return;
  const button = await page.$('[data-testid="profile-button"]');
  if (!button) return;
  await button.click();
  await page.waitForTimeout(350);
};

const APPS = {
  todo: { port: portFor("todo"), ready: "__todoReady", query: "&today=2026-09-01", states: {
    lists: async () => {},
    /*
     * AT THE READER'S LARGEST TEXT, which is 200% of the browser's own and
     * the size WCAG 1.4.4 asks an interface to survive. Every count in this
     * file ran at one text size only — so cards laid out in pixels around
     * text sized in rem were never once measured against each other, and
     * the city came apart at the setting its own profile pane offers.
     */
    largest: async (p) => {
      await openProfile(p);
      await p.click('[data-testid="setting-text-size-32px"]');
      await p.waitForTimeout(500);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(1200);
    },

    week: async (p) => { await pressPlace(p, "The week"); },
    selected: async (p) => { await p.click('[data-graview-pick="t-deposit"]'); },
    /*
     * THE INSTALLATION, SHOWN — and the same app for the seat that may not
     * see it. Who is here and who has been asked to are districts beside
     * the lists for the keeper and are not there at all for a member, so
     * this is a pair of screens rather than one screen and a refusal.
     */
    keeper: async (p) => {
      await openProfile(p);
      await p.click('[data-testid="show-installation"]');
      await p.waitForTimeout(700);
    },
    member: async (p) => {
      await p.goto(`${at("todo")}/?theme=light&today=2026-09-01&fresh=1&as=user-sam`, { waitUntil: "load" });
      await p.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(700);
    },
    /* What each role reaches, read from the policy the store refuses with. */
    reach: async (p) => {
      await openProfile(p);
      await p.click('[data-testid="show-installation"]');
      await p.waitForTimeout(500);
      await pressPlace(p, "Who may do what");
      await p.waitForTimeout(700);
    },
    /*
     * THE MONTH. A second picture of one pile of tasks, over real dates —
     * six weeks of cells, multi-day spans, and the overflow a busy day
     * needs. The week grid could never draw any of it.
     */
    calendar: async (p) => {
      await pressPlace(p, "The month");
      await p.waitForTimeout(900);
    },
    /* And the agenda: the same entries as a list, which is the range a
       phone actually wants and the one a grid cannot shrink into. */
    agenda: async (p) => {
      await pressPlace(p, "The month");
      await p.waitForTimeout(600);
      await p.click('[data-testid="calendar-range-agenda"]');
      await p.waitForTimeout(700);
    },
    // Every existing state left plane 1 empty, which is how minus-one-pixel
    // band arithmetic sat unseen: nothing ever measured a raised relation.
    raised: async (p) => { await p.click('[data-graview-view="kind:list"]'); },
    /*
     * A RULE'S NEIGHBORHOOD, and a CROWD in the band. A focused rule with
     * "Tasks" raised showed every task, twelve in slots 57 pixels wide under
     * chips 150 wide, while its card said nothing was connected. The first
     * state is what a rule judges; the second is a kind raised wholesale on
     * a node with no edge or judgment of it, twelve chips that must wrap.
     */
    judged: async (p) => {
      await p.goto(`${at("todo")}/?theme=light&today=2026-09-01#focus=rule-order&relation=task&zoom=1`, { waitUntil: "load" });
      await p.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(900);
    },
    crowd: async (p) => {
      await p.goto(`${at("todo")}/?theme=light&today=2026-09-01#focus=reason-deposit&relation=task&zoom=1`, { waitUntil: "load" });
      await p.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(900);
    },
    /*
     * THE POINTER MENU, opened on a task a rule implicates alongside four
     * others. Until the derivation knew which node the gesture landed on,
     * the first entry was whichever subject the rule happened to walk
     * first — so the obvious press fixed somebody else's problem. The date
     * is moved forward because one late task cannot show an order problem
     * between late tasks.
     */
    menu: async (p) => {
      await p.goto(`${at("todo")}/?theme=light&today=2026-09-04&fresh=1`, { waitUntil: "load" });
      await p.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(600);
      await p.click('[data-graview-pick="t-post"]', { button: "right" });
      await p.waitForSelector('[data-testid="context-menu"] [data-affordance]', { timeout: 20_000 });
      await p.evaluate(() => {
        window.__menuOpenedOn = "Redirect the post";
      });
    },
    traveled: async (p) => { await p.dblclick('[data-graview-pick="t-deposit"]'); },
    /*
     * THE CITY WITH ITS FIGURES, at altitude. Every kind is drawn the same
     * way without one — a colored dot, a plural, an iso block — and a
     * figure is what makes one of them a person and another a plot of
     * ground. Counted at both schemes, because the art is `currentColor`
     * and takes the scheme: a drawing that only reads in one is the fault
     * this state exists to catch.
     */
    figures: async (p) => {
      await p.goto(`${at("todo")}/?theme=light&today=2026-09-01&fresh=1#overview=1`, { waitUntil: "load" });
      await p.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(900);
    },
    figuresDark: async (p) => {
      await p.goto(`${at("todo")}/?theme=dark&today=2026-09-01&fresh=1#overview=1`, { waitUntil: "load" });
      await p.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(900);
    },

    graview: async (p) => { await p.click('[data-testid="overview"]'); },
    /*
     * THE ROBOT, DOCKED AND FOLLOWING. From altitude the seat's body stands
     * at its dock; pressed, it follows the pointer and the chat is its
     * bubble. Both are chrome the audit holds to the same rules as any.
     */
    /*
     * `following` WAS RETIRED, and this is why rather than a gap.
     *
     * It clicked `[data-graview-figure^="agent:tidy:"] .graview-figure-body`
     * to follow a robot. Nothing has ever drawn that id: a robot figure is
     * always somebody ELSE's agent, drawn as `theirs:<participant>` and
     * captioned "X's agent", and its body is a span with `cursor: default`
     * — robots are not followable, people are. So this waited thirty
     * seconds for an element the design does not produce and reported the
     * timeout as the app's failure.
     *
     * Following is a two-person picture and needs two pages to have any
     * presence at all, which is not the shape of this file — one page per
     * state. `scripts/verify-who.mjs` drives both sides and holds the
     * claims: a robot appears on the other person's screen captioned as
     * hers, and a person can be followed and stopped.
     */
    /*
     * A PHONE. The scene is a desk view and the routed face is the answer at
     * this width — but the scene is still reachable here, and a person who
     * lands on it must not be missing a fifth of the picture with nowhere to
     * scroll. Every count in this file runs at this width too now: the
     * district row (which sheds rather than squeezing a name to one letter
     * per line), the panel scrollers, and every control's designed size.
     */
    phone: { viewport: { width: 390, height: 844 }, go: async (p) => {
      await p.waitForTimeout(600);
    } },
    /*
     * THE RAIL, OPEN. Two states here opened it and pressed Escape on the
     * way past, so every count was taken with it shut — and the two
     * controls inside it, the only way to take a turn back and the only way
     * out of a remembered store, were measured by nothing.
     */
    activity: async (p) => {
      // Its acts are the menu a right-click opens on it.
      await p.click('[data-graview-pick="t-deposit"]', { button: "right" });
      await p.waitForTimeout(300);
      await p.locator('[data-testid="context-menu"] [data-testid="affordances"] button', { hasText: "Finish it" }).first().click();
      await p.waitForTimeout(400);
      await p.click('[data-testid="activity-button"]');
      await p.waitForTimeout(400);
    },
    /*
     * AN ACT THAT STILL WANTS SOMETHING, mid-ask. Every state here pressed
     * acts that need nothing, so the pane that opens under one that does —
     * a field, an Apply and a Skip laid out in a 236-wide rail — was a
     * screen no count had ever been taken of.
     */
    asked: async (p) => {
      await p.click('[data-graview-pick="t-deposit"]', { button: "right" });
      await p.waitForTimeout(400);
      // The DERIVED edit act specifically: its arguments are optional, so
      // its ask carries a Skip beside the Apply — the widest row the menu
      // is ever asked to hold.
      await p.locator('[data-testid="context-menu"] [data-testid="affordances"] button', { hasText: "Change the" }).first().click();
    },
  } },
  /*
   * ROTA, the product-grade one. Every screen here carries a brand with a
   * KIT, a policy with three roles and an installation — so the generic
   * battery is measuring a face that looks like something somebody shipped
   * rather than the framework's own defaults.
   */
  rota: { port: portFor("rota"), ready: "__rotaReady", query: "&today=2026-09-14", states: {
    week: async () => {},
    fortnight: async (p) => {
      await pressPlace(p, "The fortnight");
      await p.waitForTimeout(900);
    },
    /* THE QUARTER, which is how a rota is actually planned: a week per cell,
       thirteen of them, where the fortnight is one page of three. */
    quarter: async (p) => {
      await pressPlace(p, "The quarter");
      await p.waitForTimeout(900);
    },
    coverage: async (p) => {
      await pressPlace(p, "Who is covering what");
      await p.waitForTimeout(900);
    },
    /* A shift nobody has taken, selected: the repair asks WHO rather than
       choosing, which is the one thing an organizer would never forgive. */
    gap: async (p) => {
      await p.goto(`${at("rota")}/?theme=light&today=2026-09-14&fresh=1#focus=aggregate:shift&sel=s-fri-repair`, { waitUntil: "load" });
      await p.waitForFunction(() => "__rotaReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(900);
    },
    /* The seat that may do NOTHING: every act struck through with its own
       sentence, which is what "withheld, not hidden" looks like. */
    viewer: async (p) => {
      await p.goto(`${at("rota")}/?theme=light&today=2026-09-14&fresh=1&as=user-sam#focus=aggregate:shift&sel=s-fri-repair`, { waitUntil: "load" });
      await p.waitForFunction(() => "__rotaReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(900);
    },
    installation: async (p) => {
      await openProfile(p);
      await p.click('[data-testid="show-installation"]');
      await p.waitForTimeout(800);
    },
  } },
  /*
   * `empty=1`: these states are the empty garden's (the city of "none yet",
   * the starter seat, the first gardener), and the garden opens planted now.
   */
  seedbed: { port: portFor("seedbed"), ready: "__seedbedReady", query: "&empty=1", states: {
    /*
     * AT THE READER'S LARGEST TEXT, which is 200% of the browser's own and
     * the size WCAG 1.4.4 asks an interface to survive. Every count in this
     * file ran at one text size only — so cards laid out in pixels around
     * text sized in rem were never once measured against each other, and
     * the city came apart at the setting its own profile pane offers.
     */
    largest: async (p) => {
      await openProfile(p);
      await p.click('[data-testid="setting-text-size-32px"]');
      await p.waitForTimeout(500);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(1200);
    },

    /*
     * A PHONE, and a Graview in a column of an article, are the same shape.
     * Every count in this file ran at 1560 only — so a rail 236 wide sitting
     * on the card it was about, in a box 350 wide, was invisible to all of
     * them. One narrow screen puts every criterion here at that width.
     */
    narrow: { viewport: { width: 390, height: 620 }, go: async (p) => {
      await p.click('[data-testid="activity-button"]');
      await p.waitForTimeout(300);
      await p.click('[data-testid="agent-starter"]');
      await p.waitForTimeout(1600);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
      // Into a record: a focused card in a short, narrow box is where a rail
      // sized for a wide screen lands on the thing you came to act on.
      const opener = await p.$("[data-testid^='open-']");
      if (opener) { await opener.click(); await p.waitForTimeout(500); }
      const chip = await p.$("[data-graview-pick]");
      if (chip) { await chip.dblclick(); await p.waitForTimeout(900); }
    } },
    // The empty app's own first screen: a city of districts saying "none yet".
    empty: async () => {},
    /* THE SEASON: plantings drawn across the days they were in the ground. */
    season: async (p) => {
      await p.goto(`${at("seedbed")}/?chapter=4&theme=light#overview=1`, { waitUntil: "load" });
      await p.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(700);
      await pressPlace(p, "The season");
      await p.waitForTimeout(900);
    },
    /* THE YEAR: the same season, a month per cell, with each planting drawn
       across every month it was actually in the ground. */
    year: async (p) => {
      await p.goto(`${at("seedbed")}/?chapter=4&theme=light#overview=1`, { waitUntil: "load" });
      await p.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(700);
      await pressPlace(p, "The year");
      await p.waitForTimeout(900);
    },
    /*
     * THE ROTATION: four years of a bed turning through four families,
     * which is the densest picture the framework draws and the one a phone
     * has the least room for.
     */
    rotation: async (p) => {
      await p.goto(`${at("seedbed")}/?chapter=16&theme=light#focus=agg:rotation&in.view=the-rotation`, { waitUntil: "load" });
      await p.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
      await p.waitForTimeout(1100);
    },
    invited: async (p) => { await p.click('[data-graview-view="kind:gardener"]'); },
    planted: async (p) => {
      await p.click('[data-testid="activity-button"]');
      await p.waitForTimeout(300);
      await p.click('[data-testid="agent-starter"]');
      await p.waitForTimeout(1600);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
    },
    /*
     * AN ASK WITH A TEXT FIELD IN IT, at both widths. The two are different
     * failures of the same pane: in the 236-wide rail the row is laid out
     * wider than the pane and loses its buttons off the side; in the sheet a
     * phone gets, the ask opens below the fold and is not on the screen at
     * all. A number field is narrower and hides both, which is why todo's
     * ask alone was not enough.
     */
    asked: async (p) => {
      await p.click('[data-testid="activity-button"]');
      await p.waitForTimeout(300);
      await p.click('[data-testid="agent-starter"]');
      await p.waitForTimeout(1600);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
      const opener = await p.$("[data-testid^='open-']");
      if (opener) { await opener.click(); await p.waitForTimeout(500); }
      const chip = await p.$("[data-graview-pick]");
      if (chip) { await chip.click({ button: "right" }); await p.waitForTimeout(500); }
      await p.locator('[data-testid="context-menu"] [data-testid="affordances"] button', { hasText: "Change the" }).first().click();
    },
    /*
     * A LENS, AT ITS OWN PLACE. Every state here reached a picture by
     * focusing a group rather than by pressing its name, so a titled
     * registration — what `graview-lens` tells an app to write — had never
     * been on screen beside the pill that names it.
     */
    lens: async (p) => {
      await p.click('[data-testid="activity-button"]');
      await p.waitForTimeout(300);
      await p.click('[data-testid="agent-starter"]');
      await p.waitForTimeout(1600);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
      await pressPlace(p, "What grows where");
      await p.waitForTimeout(900);
    },
    askedNarrow: { viewport: { width: 390, height: 620 }, go: async (p) => {
      await p.click('[data-testid="activity-button"]');
      await p.waitForTimeout(300);
      await p.click('[data-testid="agent-starter"]');
      await p.waitForTimeout(1600);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
      const opener = await p.$("[data-testid^='open-']");
      if (opener) { await opener.click(); await p.waitForTimeout(500); }
      /*
       * PICK SOMETHING THAT HAS ACTS. This took whatever chip was first on
       * screen, which in this chapter is a plot — and a fresh plot declares
       * no mutation with itself as a subject, so the pane says so in a
       * sentence and renders no list at all. The gardener is the subject
       * with acts on it, and "Change the gardener …" is the derived edit
       * this state exists to open.
       */
      /* Its acts are the menu a right-click opens on it: the scene draws no strip beside a selection. */
      const chip = await p.$('[data-graview-pick^="gardener:"]');
      if (chip) { await chip.click({ force: true, button: "right" }); await p.waitForTimeout(500); }
      await p.locator('[data-testid="context-menu"] [data-testid="affordances"] button', { hasText: "Change the" }).first().click();
    } },
  } },
};

const audit = () => {
  const box = (el) => el.getBoundingClientRect();
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return false;
    const b = box(el);
    return b.width > 2 && b.height > 2;
  };
  const area = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  };

  /* Two cards drawn on top of one another. Views are siblings on a stage and
     the layout is supposed to keep them apart; where it does not, one card is
     literally hiding another's content. */
  // A lens drawn small as a picture (a gallery's thumbnail) is inert: what it holds is
  // inert, so nothing in it is a control, a mark or a board of this screen.
  const pictured = (el) => el.closest('[inert], [aria-hidden="true"]') !== null;
  const views = [...document.querySelectorAll("[data-graview-view]")].filter(visible).filter((el) => !pictured(el));
  const collisions = [];
  /*
   * A TUCK is not a collision. A card drawn deliberately behind the one it
   * hangs off says so in the tree, and counting that as a defect buries the
   * real ones — which is exactly what happened while a fan of six illegible
   * slivers sat on screen and every count said the same thing it says for a
   * clean strip.
   */
  const tucks = new Set();
  for (const el of views) {
    const parent = el.dataset.graviewNested;
    if (!parent) continue;
    tucks.add(`${el.dataset.graviewView}|${parent}`);
    tucks.add(`${parent}|${el.dataset.graviewView}`);
  }
  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      const a = box(views[i]), b = box(views[j]);
      const over = area(a, b);
      if (over < 200) continue;
      // Ignore a near-plane card deliberately drawn over a far one.
      const pa = Number(views[i].dataset.graviewPlane), pb = Number(views[j].dataset.graviewPlane);
      if (pa !== pb) continue;
      if (tucks.has(`${views[i].dataset.graviewView}|${views[j].dataset.graviewView}`)) continue;
      collisions.push({
        a: views[i].dataset.graviewView, b: views[j].dataset.graviewView,
        plane: pa, overlap: Math.round(over),
        share: Math.round((over / Math.min(a.width * a.height, b.width * b.height)) * 100),
      });
    }
  }

  /*
   * A CARD NAMED BY ITS ADDRESS.
   *
   * Every view host is a `role="group"`, so its aria-label is the whole name
   * a screen reader has for that card. Districts had their plural; records
   * had their node id, so a populated scene read "item:buy-milk" to anybody
   * not looking at the screen — the identifier-as-a-title smell, in the one
   * place where the screen cannot correct it.
   */
  const unnamed = views
    .filter((el) => {
      const name = el.getAttribute("aria-label");
      if (!name) return true;
      return name === el.dataset.graviewView || /^[a-z][a-z0-9]*:[a-z0-9._-]+$/i.test(name);
    })
    .slice(0, 8)
    .map((el) => `${el.dataset.graviewView} → ${el.getAttribute("aria-label") ?? "(no name)"}`);

  /*
   * A FIELD ASKED FOR BY ITS KEY. An editor opened in place named itself
   * `label` or `dependsOn` — the declaration's identifier — where the pages
   * face has always said "Label" and "Depends on".
   */
  const keyed = [...document.querySelectorAll("input[data-graview-field], select[data-graview-field]")]
    .filter((el) => el.getAttribute("aria-label") === el.dataset.graviewField)
    .slice(0, 6)
    .map((el) => el.dataset.graviewField);

  /*
   * HEADINGS THAT SKIP A LEVEL. The scene has one h1 — the app's name — and
   * a card's own sub-headings hang off it. A connections caption written as
   * an h4 jumped two levels, which is what a screen reader's heading list
   * reads as a missing section. axe calls this `heading-order`, and no
   * harness here ran axe on a scene with a relation drawn in it.
   */
  /*
   * Not `visible`: the shell's h1 is deliberately clipped to a pixel, and a
   * screen reader reads it all the same. Rendered-or-not is the question, so
   * only display:none and visibility:hidden take a heading out of the list —
   * measuring the box would have dropped the h1 and hidden the very jump
   * this looks for.
   */
  const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    })
    .map((el) => ({ level: Number(el.tagName[1]), text: (el.textContent ?? "").trim().slice(0, 30) }));
  const headings = [];
  let previous = 0;
  for (const heading of levels) {
    if (previous !== 0 && heading.level > previous + 1)
      headings.push(`h${previous} → h${heading.level} at "${heading.text}"`);
    previous = heading.level;
  }

  /*
   * EMPHASIS THAT IS ONLY A COLOR.
   *
   * A lens says what a selection lights with `data-graview-emphasis`, so the
   * claim is a fact rather than a shade. The coverage grid said it on its row
   * labels and merely painted it on its column heads and its filled cells —
   * half the marks in one picture making a claim nothing could check. Within
   * one view it is all of them or none.
   */
  const halfSaid = [];
  for (const host of views) {
    const marks = [...host.querySelectorAll("[data-graview-pick]")].filter(visible).filter((el) => !pictured(el));
    if (marks.length === 0) continue;
    const said = marks.filter((el) => el.dataset.graviewEmphasis !== undefined);
    if (said.length !== 0 && said.length !== marks.length) {
      halfSaid.push(`${host.dataset.graviewView}: ${said.length} of ${marks.length} marks`);
    }
  }

  /*
   * A PROBLEM THAT IS ONLY A COLOR.
   *
   * The same rule as `halfSaid`, for the other claim a view makes with a
   * shade. A record implicated in a broken rule is drawn with the warning
   * tone — and the focused record, the biggest drawing of it and the one you
   * traveled to, said nothing else: no words, no mark, nothing in the
   * accessibility tree. The district's chips carry a "⚠" in their own label
   * and the routed record page carries the rule's sentence, so the scene was
   * the one place the problem existed purely as a tint.
   *
   * Measured from the ground truth — the app's own count of what is broken —
   * rather than from the shade, because a shade is exactly what is not
   * trustworthy here.
   */
  const painted = [];
  if (document.querySelector('[data-testid="standing"]')?.textContent?.match(/\d+ problem/)) {
    for (const host of views) {
      if (!visible(host)) continue;
      const plane = Number(host.dataset.graviewPlane);
      if (!(plane === 0)) continue;
      const panel = host.querySelector('[data-graview-primitive="panel"]');
      if (!panel) continue;
      /*
       * The WARNING ground specifically. A panel may legitimately be drawn on
       * the muted ground — a summary is — so "not the default ground" catches
       * every quiet card in the app and says nothing about problems.
       */
      const ground = getComputedStyle(panel).backgroundColor;
      const swatch = document.createElement("div");
      swatch.style.background = "var(--graview-panel-warning)";
      document.body.append(swatch);
      const warning = getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      if (!/rgb/.test(warning) || ground !== warning) continue;
      const says =
        /⚠/.test(panel.textContent ?? "") ||
        panel.querySelector("[data-graview-broken]") !== null;
      if (!says) painted.push(host.dataset.graviewView);
    }
  }

  /* A control too small to hit. 24px is the WCAG 2.2 minimum. */
  /*
   * AN ASK YOU CANNOT ANSWER.
   *
   * Pressing an act that still needs something opens the ask for it inside
   * the same pane. The pane scrolls in one direction and clips in both, so
   * an ask laid out wider than the pane loses its buttons off the side, and
   * an ask opened below the pane's fold is simply not on the screen — in
   * both cases the person pressed a button and nothing they can see
   * happened. The ask says it is one (`data-graview-asking`), so this asks
   * the only question that matters about it: is every control of it inside
   * the box that clips it, right now, without scrolling anything.
   */
  const clipperOf = (el) => {
    for (let at = el.parentElement; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") return at;
    }
    return null;
  };
  const asking = [];
  for (const ask of document.querySelectorAll("[data-graview-asking]")) {
    const host = clipperOf(ask);
    if (!host) continue;
    const h = box(host);
    const scrolls = { y: host.scrollHeight > host.clientHeight + 2, x: host.scrollWidth > host.clientWidth + 2 };
    for (const el of ask.querySelectorAll("button, input, select, textarea")) {
      if (!visible(el)) continue;
      const b = box(el);
      /*
       * WHAT A SCROLLER CAN REACH IS NOT LOST. The rule is for an ask that
       * escaped the pane it belongs to — drawn at a position its own box
       * never covers. A pane that scrolls covers everything inside it; the
       * question there is whether the ask is within what the host can
       * scroll to, not whether it is on screen this instant.
       */
      const past = {
        top: scrolls.y ? b.top - h.top + host.scrollTop < -2 : b.top < h.top - 2,
        bottom: scrolls.y ? b.bottom - h.top + host.scrollTop > host.scrollHeight + 2 : b.bottom > h.bottom + 2,
        left: scrolls.x ? b.left - h.left + host.scrollLeft < -2 : b.left < h.left - 2,
        right: scrolls.x ? b.right - h.left + host.scrollLeft > host.scrollWidth + 2 : b.right > h.right + 2,
      };
      // Two pixels of tolerance for the host's own border.
      if (past.left || past.right || past.top || past.bottom) {
        asking.push(
          `${(el.getAttribute("aria-label") ?? el.textContent ?? el.getAttribute("placeholder") ?? "").trim().slice(0, 20)} at ${Math.round(b.left)}..${Math.round(b.right)}/${Math.round(b.top)}..${Math.round(b.bottom)} outside ${Math.round(h.left)}..${Math.round(h.right)}/${Math.round(h.top)}..${Math.round(h.bottom)}`,
        );
      }
    }
  }

  /*
   * A control's DESIGNED size, not its projected one.
   *
   * The scene draws a receded plane at 0.85 and the overview at less than
   * half, so a perfectly good 24-pixel control measures 20 back there — and
   * that is the depth model working, not a defect. Dividing by the host's own
   * scale asks the question that has an answer: was this built big enough?
   */
  const scaleOf = (el) => {
    const host = el.closest("[data-graview-view]");
    if (!host) return 1;
    const m = new DOMMatrixReadOnly(getComputedStyle(host).transform);
    const natural = el.closest("[data-graview-natural]");
    const inner = natural ? new DOMMatrixReadOnly(getComputedStyle(natural).transform).a : 1;
    return Math.max(0.05, (m.a || 1) * (inner || 1));
  };
  const small = [...document.querySelectorAll("button, [role=button], a[href], select, input")]
    .filter(visible)
    .filter((el) => !pictured(el))
    .map((el) => ({ el, b: box(el), scale: scaleOf(el) }))
    // Half a pixel of tolerance: a control designed at exactly 24 must not
    // fail on a sub-pixel transform.
    .filter(({ b, scale }) => b.width / scale < 23.5 || b.height / scale < 23.5)
    .slice(0, 10)
    .map(({ el, b, scale }) => ({
      what: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 28),
      size: `${Math.round(b.width / scale)}x${Math.round(b.height / scale)}`,
    }));

  /* A caption cut mid-word. An ellipsis is a decision; one on a label that had
     room beside it is a layout that gave up. */
  const cut = [...document.querySelectorAll("*")]
    .filter((el) => el.children.length === 0 && visible(el))
    .filter((el) => {
      const s = getComputedStyle(el);
      if (s.textOverflow !== "ellipsis") return false;
      if (el.scrollWidth <= el.clientWidth + 2) return false;
      // A capped label that carries the whole string in its tooltip has
      // TIDIED rather than lost it, which is the contract the chip and the
      // observation line both keep on purpose.
      return !el.closest("[title]");
    })
    .slice(0, 8)
    .map((el) => (el.textContent ?? "").trim().slice(0, 34));

  /*
   * "Add a item". An article written as a literal beside a word the AUTHOR
   * chose disagrees with it half the time, and the half where it does is on
   * the very first screen of a project whose kind begins with a vowel. It is
   * derived from the word now — so this reads what is on the glass and asks
   * whether each article agrees with what follows it.
   */
  const SOUNDS_LIKE_YOU = /^(u[nt]i|use|usu|uti|ubiq|eu|ewe|one|once)/i;
  const SILENT_H = /^(hour|honest|hono[ur]r?|heir)/i;
  const articles = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length > 0 || !visible(el)) continue;
    for (const [, art, word] of (el.textContent ?? "").matchAll(/\b(an?) ([A-Za-z]{2,})\b/g)) {
      const wants = SILENT_H.test(word) ? "an" : SOUNDS_LIKE_YOU.test(word) ? "a" : /^[aeiou]/i.test(word) ? "an" : "a";
      if (art.toLowerCase() !== wants) articles.push(`${art} ${word} (wants "${wants}")`);
    }
  }

  /* The same string twice: the smell the codebase already names. */
  const seen = new Map();
  for (const el of document.querySelectorAll("h1,h2,h3,strong,button,[data-testid=focused],nav *")) {
    if (el.children.length > 0) continue;
    // A string that is not on screen cannot repeat on it: altitude-only
    // controls exist in the tree at display none inside the stack.
    if (!visible(el)) continue;
    // A place tile's name is drawn aria-hidden beside the press that says it; a picture hidden from assistive tech repeats by construction.
    if (el.closest('[aria-hidden="true"]')) continue;
    /*
     * A RAISED card duplicating its origin's title is the design, not the
     * smell: keeping the origin legible while its members stand on plane 1
     * is an acceptance criterion, and the same node drawn in two places
     * carries the same name both times. Likewise the acts' menu and the
     * seat, which exist to name the selection the way a crumb names the focus.
     */
    if (el.closest('[data-graview-plane="1"], [data-testid="inspector-strip"], [data-testid="context-menu"], [data-testid="seat"], .graview-kind-open')) continue;
    const t = (el.textContent ?? "").trim();
    if (t.length < 6) continue;
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  /*
   * The crumb for the thing you are looking at is SUPPOSED to name it — that
   * pairing is a breadcrumb beside a heading, which is how every document
   * works. What is not supposed to happen is chrome naming a PLACE that the
   * picture below it also names, which is a different string in a different
   * element saying the same thing for no reason.
   */
  const crumb = (document.querySelector("[data-testid=focused]")?.textContent ?? "")
    .replace(/\s*×\s*$/, "")
    .trim();
  // The raised chip names the raised relation the way the crumb names the
  // focus — and the group it names deliberately stays visible below.
  const raisedChip = (document.querySelector("[data-testid=raised]")?.textContent ?? "")
    .replace(/\s*×\s*$/, "")
    .trim();
  /*
   * And the PLACE YOU ARE LOOKING AT is the crumb for a lens.
   *
   * A titled group view is a place: its name is a pill in the bar and the
   * picture carries the same name as its heading, because `label` on a view
   * IS the registered title. That is the pairing the crumb exemption above
   * is for — a breadcrumb beside a heading — and counting it made every
   * lens in the framework read as a repeat the moment a screen was taken at
   * one. Asked of the PICTURE rather than of the pill's pressed state: the
   * pill is deliberately unpressed from altitude (you are above the place,
   * not in it) while the scaled picture below still carries its name. A
   * place whose picture is NOT on the screen is still the smell this looks
   * for.
   */
  const atThisPlace = [...document.querySelectorAll("[data-place-kind]")]
    .filter((el) => {
      // The testid names the PICTURE now that a kind may have several, so
      // the kind is read off its own attribute rather than out of a slug.
      const kind = el.getAttribute("data-place-kind") ?? "";
      return (
        document.querySelector(`[data-graview-view="aggregate:${kind}"][data-graview-plane="0"]`) !==
        null
      );
    })
    .map((el) => (el.textContent ?? "").trim());
  // A drive-in's marquee is the Places list drawn where the pictures live:
  // the same titles twice is the design, not a repeat.
  const marquee = [...document.querySelectorAll('[data-testid^="drive-in-"] button, [data-testid^="drive-in-"] .graview-drive-in-thumb-title')].map((el) =>
    (el.textContent ?? "").trim(),
  );
  const repeats = [...seen.entries()]
    .filter(([t, n]) => n > 1 && t !== crumb && t !== raisedChip && !atThisPlace.includes(t) && !marquee.includes(t))
    .map(([t, n]) => `${t} x${n}`);

  /*
   * Chrome sitting on the CONTENT.
   *
   * The seat is an ask field at the picture's foot, in a strip the layout
   * keeps clear, and grows over the picture only when asked. What would be
   * wrong is it sitting on the thing you are actually working with — the
   * focus or a raised card — so that is what this counts. (The strip a
   * selection used to draw was the surface measured here; the scene draws
   * none now.)
   */
  const strip = document.querySelector('[data-testid="seat"]');
  const covered = [];
  if (strip && !document.querySelector('[role="dialog"]')) {
    const s = box(strip);
    for (const v of views) {
      if (Number(v.dataset.graviewPlane) >= 2) continue;
      // The PANEL someone can see, not the band slot the layout allotted:
      // a host is the full band with the view centered inside it, and the
      // strip sitting on a slot's empty margin covers nothing.
      const inner = v.querySelector('[data-graview-primitive="panel"], .graview-kind-card') ?? v;
      const b = box(inner);
      const o = area(b, s);
      // A transient surface may lap a panel's margin; sitting on a real
      // share of it is what covering means.
      if (o > 200 && o > b.width * b.height * 0.06)
        covered.push({ id: v.dataset.graviewView, overlap: Math.round(o) });
    }
  }

  /*
   * A CONTROL PAINTED OFF THE EDGE OF THE WINDOW.
   *
   * The command bar was one unwrapping row inside a wrapper that hides its
   * overflow: at 390 it wanted 649, so Ask, Activity and the scheme toggle
   * were painted past the right edge with nothing to scroll. A phone had no
   * undo, no chat and no way back to light, and every count here was looking
   * at the part of the page that fitted.
   *
   * Only counted where the page cannot be scrolled to reach it — a document
   * that scrolls sideways is a different argument, and not this one.
   */
  /*
   * "Nowhere to scroll" means no ANCESTOR scrolls, not just the document. A
   * pane that is its own scroll region can be scrolled to, which is a
   * different design and not a defect — the strip below the fold of a short
   * window is reached by scrolling the strip.
   */
  const scrollableAbove = (el, axis) => {
    for (let at = el; at && at !== document.documentElement.parentElement; at = at.parentElement) {
      const style = getComputedStyle(at);
      const way = axis === "x" ? style.overflowX : style.overflowY;
      const room =
        axis === "x" ? at.scrollWidth > at.clientWidth + 2 : at.scrollHeight > at.clientHeight + 2;
      if (room && (way === "auto" || way === "scroll" || at === document.documentElement)) return true;
    }
    return false;
  };
  /*
   * THE GROUND PANS. From altitude a city wider than the window is reached
   * by dragging the ground, and the ground says how far the camera reaches
   * (`data-graview-reach`, the scene's own camera limit). A control past
   * the edge but within that reach is pannable to, which is not lost.
   */
  const pannable = (el) => {
    const ground = el.closest("[data-graview-reach]");
    if (!ground) return null;
    const [x, y] = (ground.getAttribute("data-graview-reach") ?? "0 0").split(" ").map(Number);
    return { x: x || 0, y: y || 0 };
  };
  const offscreen = [...document.querySelectorAll("button, [role=button], a[href], select, input")]
    .filter((el) => {
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) return false;
      if (getComputedStyle(el).visibility === "hidden") return false;
      const reach = pannable(el) ?? { x: 0, y: 0 };
      const pastSide = b.right > window.innerWidth + reach.x + 1 || b.left < -reach.x - 1;
      const pastEnd = b.bottom > window.innerHeight + reach.y + 1 || b.top < -reach.y - 1;
      if (pastSide && !scrollableAbove(el, "x")) return true;
      return pastEnd && !scrollableAbove(el, "y");
    })
    .slice(0, 8)
    .map((el) => {
      const b = el.getBoundingClientRect();
      return `${el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 16)} at ${Math.round(b.left)}..${Math.round(b.right)}`;
    });

  /* The board's own arrangement: no slot on top of another, and no slot
     clipped by the pitch edge — the two ways a shrinking pitch failed, kept
     failing, and never showed up in a count. */
  const boardEl = [...document.querySelectorAll('[data-graview-primitive="board"]')].find((el) => !pictured(el)) ?? null;
  const board = [];
  if (boardEl) {
    const pitch = box(boardEl);
    const slots = [...boardEl.querySelectorAll("[data-graview-slot]")]
      .filter(visible)
      .map((el) => ({ id: el.dataset.graviewSlot, b: box(el) }));
    for (const { id, b } of slots) {
      if (b.left < pitch.left - 2 || b.right > pitch.right + 2 || b.top < pitch.top - 2 || b.bottom > pitch.bottom + 2)
        board.push(`${id} clipped by the pitch edge`);
    }
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++)
        if (area(slots[i].b, slots[j].b) > 40) board.push(`${slots[i].id} overlaps ${slots[j].id}`);
  }

  /* How much of the stage carries anything at all. */
  const stage = document.querySelector("[data-graview-stage]");
  let fill = null;
  if (stage) {
    const s = box(stage);
    const painted = views.reduce((sum, v) => { const b = box(v); return sum + b.width * b.height; }, 0);
    fill = Math.round((painted / (s.width * s.height)) * 100);
  }

  /* The acts' own shape, where the menu is open: how many it is showing against how many
     it has, since hiding most of them behind "+N more" defeats the point. */
  let inspector = null;
  const acts = document.querySelector('[data-testid="context-menu"]');
  if (acts) {
    const shown = acts.querySelectorAll('[data-testid="affordances"] > li').length;
    const more = acts.querySelector('[data-testid="affordances"] li:last-child button');
    const hidden = /^\+(\d+) more$/.exec((more?.textContent ?? "").trim());
    const b = box(acts);
    inspector = {
      shown: hidden ? shown - 1 : shown,
      hidden: hidden ? Number(hidden[1]) : 0,
      size: `${Math.round(b.width)}x${Math.round(b.height)}`,
      text: (acts.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
    };
  }

  /* A FIGURE THAT DID NOT DRAW is a blank where a drawing should be.
     The art is inline SVG with a viewBox and no size of its own, so it
     fills the box it is given — which means a figure with no box is a
     figure nobody sees, and it looks exactly like a kind that declared
     none. Counted rather than assumed. */
  const figures = [...document.querySelectorAll("[data-graview-figure-kind=figure]")]
    .map((el) => ({ kind: el.getAttribute("data-graview-figure"), b: box(el), svg: el.querySelector("svg") }))
    .filter(({ b, svg }) => svg === null || b.width < 8 || b.height < 8)
    .map(({ kind, b }) => `${kind} at ${Math.round(b.width)}x${Math.round(b.height)}`);

  /* A MENU OPENED AT A POINTER LEADS WITH THE THING IT WAS OPENED ON.
     The state that opens one leaves the thing's name on the window, because
     the menu itself is the thing under test and must not be asked to
     confirm its own claim. */
  const menu = document.querySelector('[data-testid="context-menu"]');
  let led = null;
  if (menu) {
    const first = (menu.querySelector("[data-affordance]")?.textContent ?? "").trim();
    const on = window.__menuOpenedOn ?? null;
    led = { first: first.slice(0, 60), on, names: on === null ? null : first.includes(on) };
  }

  return { collisions: collisions.slice(0, 8), small, cut, unnamed, keyed, headings, halfSaid, painted, repeats, articles: [...new Set(articles)].slice(0, 8), covered, offscreen, asking: asking.slice(0, 6), board, fill, inspector, led, figures };
};

const only = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const report = { at: new Date().toISOString(), engine: ENGINE, screens: [] };
let browser;

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  for (const [name, app] of Object.entries(APPS)) {
    if (only && only !== name) continue;
    const served = await serving(name, app.port, repoRoot);
    try {
      for (const [state, entry] of Object.entries(app.states)) {
        // A state may ask for its own window; the rest get the surveyed one.
        const go = typeof entry === "function" ? entry : entry.go;
        const viewport = typeof entry === "function" ? { width: 1560, height: 940 } : entry.viewport;
        const page = await browser.newPage({ viewport });
        try {
          await page.goto(`http://localhost:${app.port}/?theme=light${app.query ?? ""}`, { waitUntil: "load" });
          await page.waitForFunction((f) => f in window, app.ready, { timeout: 120_000 });
          await page.waitForTimeout(900);
          await go(page);
          await page.waitForTimeout(1200);
          report.screens.push({ app: name, state, ...(await page.evaluate(audit)) });
        } catch (error) {
          report.screens.push({ app: name, state, error: String(error).slice(0, 160) });
        } finally {
          await page.close();
        }
      }
    } finally {
      served.stop();
    }
  }
} finally {
  await browser?.close();
}

writeFileSync(resolve(repoRoot, "docs/audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

let bad = 0;
for (const s of report.screens) {
  const where = `${s.app}/${s.state}`.padEnd(20);
  if (s.error) { process.stdout.write(`FAIL ${where} ${s.error}\n`); bad++; continue; }
  const notes = [
    s.collisions.length ? `${s.collisions.length} card collisions (worst ${s.collisions[0].share}%)` : "",
    s.covered.length ? `strip covers ${s.covered.length}` : "",
    s.board?.length ? `board: ${s.board[0]}${s.board.length > 1 ? ` +${s.board.length - 1}` : ""}` : "",
    s.cut.length ? `${s.cut.length} cut: ${s.cut[0]}` : "",
    s.repeats.length ? `repeats: ${s.repeats.join(", ")}` : "",
    s.articles?.length ? `article disagrees: ${s.articles.join(", ")}` : "",
    s.unnamed?.length ? `${s.unnamed.length} cards named by their address: ${s.unnamed[0]}` : "",
    s.keyed?.length ? `fields asked for by their key: ${s.keyed.join(", ")}` : "",
    s.headings?.length ? `headings skip a level: ${s.headings.join(", ")}` : "",
    s.halfSaid?.length ? `emphasis painted but not said: ${s.halfSaid.join("; ")}` : "",
    s.painted?.length ? `a problem painted but not said: ${s.painted.join(", ")}` : "",
    s.small.length ? `${s.small.length} controls under 24px` : "",
    s.asking?.length ? `an ask drawn outside its pane: ${s.asking.join("; ")}` : "",
    s.offscreen?.length ? `${s.offscreen.length} off the edge with nowhere to scroll: ${s.offscreen[0]}` : "",
    s.inspector?.hidden ? `strip hides ${s.inspector.hidden} of ${s.inspector.hidden + s.inspector.shown} actions` : "",
    s.led?.names === false ? `the menu leads with "${s.led.first}", not the ${s.led.on} it was opened on` : "",
    s.figures?.length ? `${s.figures.length} figures drew nothing: ${s.figures[0]}` : "",
  ].filter(Boolean);
  if (notes.length) bad++;
  process.stdout.write(`${notes.length ? "??" : "ok"} ${where} ${notes.join("; ")}\n`);
}
process.stdout.write(`\n${report.screens.length - bad} of ${report.screens.length} screens clean\n`);
