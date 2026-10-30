/**
 * JOURNEYS: whether a person can do an app's core jobs, and what it costs.
 *
 * The watch (watch.mjs) catches the mechanical kinds of bug on every screen
 * a harness reaches. Nothing measured the thing those bugs are in the way
 * of: can somebody make a record, find one, change it, relate two, take a
 * change back, get from a problem to its repair, and be told before they
 * press that an act is not theirs? This is the reusable half of
 * `verify-journeys.mjs`:
 *
 *   planJobs(app)        the jobs, derived from the declaration in Node
 *   Person               drives a page by pointer or by keyboard only,
 *                        counting every press, and stops with a sentence
 *                        where the interface offers no way on (DeadEnd)
 *   JOBS                 how each job is done on each face
 *   frictionOf(report)   the ranked list a person can read
 *   regressionsOf(a, b)  what got worse since the committed verdict
 *
 * The harness never applies an act itself during a job. It reads the store
 * the page hands the watch (`tellTheWatchOfAStore` in @graview/core) only
 * to say whether what was pressed did what it meant, and to arrange the
 * one precondition a job cannot start without (a change to take back).
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/* ------------------------------------------------------------------ */
/* The declaration, read in Node                                       */
/* ------------------------------------------------------------------ */

/** The app's declaration and the @graview/core instance its node refs were made with. */
export async function readDeclaration(repoRoot, dir) {
  const entry = resolve(repoRoot, "apps", dir, "dist/domain/app.js");
  if (!existsSync(entry)) return null;
  const module = await import(pathToFileURL(entry).href);
  const app = module.default ?? module.app;
  if (!app?.schema) return null;
  // The same module instance the app imported, or node refs read as plain strings.
  const require = createRequire(resolve(repoRoot, "apps", dir, "package.json"));
  // What an argument asks for is `@graview/core/words`'s (FR-179).
  const core = { ...(await import(pathToFileURL(require.resolve("@graview/core")).href)), ...(await import(pathToFileURL(require.resolve("@graview/core/words")).href)) };
  return { app, core };
}

/**
 * WHICH APPS A RUN DRIVES, from its arguments: a name is one of the
 * checkout's (`todo`, `rota`), a path is an app beside the checkout — the
 * walk's own (`../walk7`), reported under its directory's name and asking
 * nothing of its address. Nothing named drives every app of the checkout;
 * naming only a path drives only it.
 */
export function appsNamed(args, apps, cwd = process.cwd()) {
  const named = args.filter((arg) => !arg.startsWith("-"));
  const isPath = (arg) => arg.includes("/") || arg.startsWith(".");
  const beside = named.filter(isPath).map((path) => ({ dir: resolve(cwd, path), name: basename(resolve(cwd, path)), query: {} }));
  const asked = named.filter((arg) => !isPath(arg));
  // An app by its directory, or a fixture of one by its own name (`discography-past`).
  return [...apps.filter((one) => asked.includes(one.dir) || (one.name !== undefined && asked.includes(one.name)) || (asked.length === 0 && beside.length === 0)), ...beside];
}

const article = (noun) => (/^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`);
const nounOf = (definition) => (definition.noun ?? definition.kind).toLowerCase();

/**
 * THE JOBS, FROM THE DECLARATION.
 *
 *   make      every kind the app declares (not a module's) with an act that
 *             creates it
 *   find      a record of the app's first creatable kind, by part of its name
 *   change    that record's name, in place
 *   relate    the first declared act that ties its subject to another node
 *   undo      the last change
 *   repair    the first broken invariant, from the problem to its repair
 *   refused   an act the policy keeps from some seat, tried as that seat
 *
 * Which record, which seat and which problem are chosen in the page, from
 * the graph as it stands — the plan says what the job IS.
 */
export function planJobs({ app, core }) {
  const moduleKinds = new Set(Object.values(app.modules ?? {}).flatMap((module) => module.kinds ?? []));
  const definitions = app.schema.definitions.filter((definition) => !moduleKinds.has(definition.kind));
  const declared = app.mutations ?? [];
  const derived = core.deriveMutations(app.schema, declared);
  const acts = [...declared, ...derived];
  const jobs = [];

  const creators = [];
  for (const definition of definitions) {
    const act = declared.find((mutation) => (mutation.creates ?? []).includes(definition.kind));
    if (!act) continue;
    const refs = core.nodeRefArgs(act.input);
    creators.push({ kind: definition.kind, act, refs });
    jobs.push({
      id: `make-${definition.kind}`,
      job: "make",
      kind: definition.kind,
      act: act.name,
      title: act.title,
      subject: act.subject ? { arg: act.subject.arg, kinds: act.subject.kinds } : null,
      noun: nounOf(definition),
      plural: definition.plural ?? definition.kind,
      says: `Making ${article(nounOf(definition))}`,
    });
  }
  const primary = creators[0]?.kind ?? definitions[0]?.kind;
  const primaryDefinition = app.schema.definitions.find((definition) => definition.kind === primary);
  const named = (kind) => {
    const definition = app.schema.definitions.find((one) => one.kind === kind);
    const shape = definition?.fields?.shape ?? {};
    return "label" in shape ? "label" : "name" in shape ? "name" : "title" in shape ? "title" : null;
  };
  /* The act that renames one of the first kind — declared, or derived: the way round when the name is not changed in place, and the change undo takes back. */
  const nameField = primary ? named(primary) : null;
  const renamer = acts.find((mutation) => {
    const kinds = mutation.subject?.kinds;
    const shape = mutation.input?.shape ?? {};
    return (kinds === "*" || kinds?.includes?.(primary)) && nameField && nameField in shape && !(mutation.creates ?? []).length;
  });
  if (primary) {
    jobs.push({ id: "find", job: "find", kind: primary, noun: nounOf(primaryDefinition), says: `Finding ${article(nounOf(primaryDefinition))} by part of its name` });
    if (nameField) {
      jobs.push({
        id: "change",
        job: "change",
        kind: primary,
        field: nameField,
        noun: nounOf(primaryDefinition),
        ...(renamer ? { act: renamer.name, title: renamer.title } : {}),
        says: `Renaming ${article(nounOf(primaryDefinition))} on its record`,
      });
    }
  }

  /* A relation an act declares: its subject, and one more node ref the act ties it to. */
  /*
   * Declared first; then a relation's derived connect (the twelfth walk):
   * since every relation comes with `connect-<kind>-<relation>`, an app that
   * declares no tying act of its own still has the job, and a festival's
   * guests were tied to screenings by nothing the journeys walked.
   */
  const relating = [...declared, ...derived.filter((mutation) => (mutation.connects ?? []).length > 0 && !(mutation.severs ?? []).length)]
    .filter((mutation) => mutation.subject && !(mutation.creates ?? []).length)
    .map((mutation) => ({ mutation, others: core.nodeRefArgs(mutation.input).filter((ref) => ref.name !== mutation.subject.arg && !ref.optional) }))
    .filter(({ others }) => others.length === 1)
    // Ties are adds; the act that takes one away is the other half, and an "un-" act needs a tie to exist.
    .filter(({ mutation }) => !/^(un|stop-|take-off|drop|remove)/.test(mutation.name));
  const declaredRelating = relating.filter(({ mutation }) => declared.includes(mutation));
  const derivedRelating = relating.filter(({ mutation }) => !declared.includes(mutation));
  const onPrimary = (list) => list.find(({ mutation }) => mutation.subject.kinds?.includes?.(primary)) ?? list[0];
  const relate = onPrimary(declaredRelating) ?? onPrimary(derivedRelating);
  if (relate) {
    const subjectKind = relate.mutation.subject.kinds === "*" ? primary : relate.mutation.subject.kinds[0];
    const subjectDefinition = app.schema.definitions.find((definition) => definition.kind === subjectKind);
    jobs.push({
      id: "relate",
      job: "relate",
      act: relate.mutation.name,
      title: relate.mutation.title,
      kind: subjectKind,
      subjectArg: relate.mutation.subject.arg,
      otherArg: relate.others[0].name,
      otherKinds: relate.others[0].kinds,
      noun: nounOf(subjectDefinition),
      says: `Tying ${article(nounOf(subjectDefinition))} to another with "${relate.mutation.title}"`,
    });
  }

  /*
   * NARROW A LIST BY A NUMBER: the cars at most a price, the shifts at
   * least an hour long. The first kind with a creating act and a number
   * field a person reads. A job nothing derived could be done at all until
   * the seventh walk asked for SUVs under £25,000 (W-162).
   */
  for (const { kind } of creators) {
    const definition = app.schema.definitions.find((one) => one.kind === kind);
    const hidden = new Set(definition?.display?.hide ?? []);
    const field = Object.entries(definition?.fields?.shape ?? {}).find(([key, schema]) => !hidden.has(key) && core.describeArg(schema).type === "number")?.[0];
    if (!field) continue;
    jobs.push({
      id: "narrow",
      job: "narrow",
      kind,
      field,
      label: core.fieldWords(definition, field),
      noun: nounOf(definition),
      plural: definition.plural ?? kind,
      says: `Narrowing the ${(definition.plural ?? kind).toLowerCase()} by ${core.fieldWords(definition, field).toLowerCase()}`,
    });
    break;
  }

  /*
   * SEVERAL AT ONCE: one act done to three records of a kind from its list,
   * as one change. The act is one that needs nothing but its record — "Mark
   * it done", "Check them in" — on the first kind that has one, its creators
   * first; done on the pages, where a list is.
   */
  const onItsOwn = (mutation) => mutation.subject && !(mutation.creates ?? []).length && !mutation.destructive && Object.keys(mutation.input?.shape ?? {}).length === 1;
  const byKind = [...new Set([primary, ...creators.map((one) => one.kind), ...definitions.map((one) => one.kind)])].filter(Boolean);
  for (const kind of byKind) {
    const act = declared.find((mutation) => onItsOwn(mutation) && (mutation.subject.kinds === "*" || mutation.subject.kinds?.includes?.(kind)));
    if (!act) continue;
    const definition = app.schema.definitions.find((one) => one.kind === kind);
    const plural = definition.plural ?? kind;
    jobs.push({ id: "several", job: "several", kind, act: act.name, title: act.title ?? act.name, subjectArg: act.subject.arg, noun: nounOf(definition), plural, says: `Doing "${act.title ?? act.name}" to three ${plural.toLowerCase()} at once` });
    break;
  }

  /* Undo needs a change to take back: a rename, which every app with a named kind has. */
  if (renamer && primary) {
    jobs.push({ id: "undo", job: "undo", kind: primary, act: renamer.name, subjectArg: renamer.subject?.arg ?? "id", field: nameField, says: "Taking the last change back" });
  }
  if ((app.invariants ?? []).length > 0) {
    jobs.push({ id: "repair", job: "repair", says: "Getting from a problem to its repair" });
  }
  if (app.policy) {
    jobs.push({ id: "refused", job: "refused", says: "Being told an act is not yours before pressing it" });
  }
  return { primary, jobs, kinds: app.schema.definitions.map((definition) => ({ kind: definition.kind, plural: definition.plural ?? definition.kind })) };
}

/* ------------------------------------------------------------------ */
/* In the page                                                         */
/* ------------------------------------------------------------------ */

/**
 * Collects the stores the page makes, and the seat the interface asks
 * about. Runs after the watch's own init script, which defines the hook.
 */
export function storeHookInPage() {
  /*
   * A RECORD'S NAME AS THE DECLARATION SAYS IT. A car is named by its year,
   * make, model and trim, with no `label` field at all, and every job read
   * `node.label` — so the seventh walk's showroom had "no car to find".
   */
  window.__journeyName = (store, node) => {
    try {
      const definition = store.schema?.tryDefinition?.(node.kind);
      const name = definition?.label ? definition.label(node) : node.label;
      return typeof name === "string" && name.length > 0 ? name : null;
    } catch {
      return null;
    }
  };
  const watch = window.__graviewWatch;
  if (!watch) return;
  window.__journeyStores = [];
  // The watch reads a store's names when it is handed one; the journeys keep it too.
  const handed = watch.store;
  watch.store = (store) => {
    handed?.(store);
    window.__journeyStores.push(store);
    // The seat: whoever the interface last asked the policy about.
    for (const method of ["kindsKeptFrom", "permittedMutations", "mayAdminister"]) {
      const original = store[method];
      if (typeof original !== "function") continue;
      store[method] = function (...args) {
        const principal = method === "mayAdminister" ? args[1] : args[0];
        // The person at the keyboard, not the agent seat in the rail, which asks the policy too.
        if (principal && typeof principal === "object" && principal.kind === "human") window.__journeySeat = principal;
        return original.apply(this, args);
      };
    }
  };
}

/** Reads one fact from the app's store, in the page. `fn(store, arg)` is serialized. */
export async function inStore(page, kinds, fn, arg) {
  return page.evaluate(
    ({ kinds, source, arg }) => {
      const stores = window.__journeyStores ?? [];
      const store =
        stores.find((one) => kinds.every((kind) => one.schema?.kinds?.includes?.(kind))) ??
        stores.find((one) => kinds.some((kind) => one.schema?.kinds?.includes?.(kind)));
      if (!store) return { missing: true };
      // eslint-disable-next-line no-new-func
      return new Function("store", "arg", "seat", `return (${source})(store, arg, seat);`)(store, arg, window.__journeySeat ?? null);
    },
    { kinds, source: fn.toString(), arg },
  );
}

/* ------------------------------------------------------------------ */
/* A person                                                            */
/* ------------------------------------------------------------------ */

/**
 * WHETHER IT APPEARS, given the time a page takes. A dead end was decided
 * with one look (`isVisible` does not wait), so on a slow runner a page of a
 * thousand songs still drawing its list "offered no Add a song" and the run
 * called it a regression. A control is given up on only after it has had
 * time to appear: immediate when it is there, ten seconds when it is not.
 */
const PATIENCE = Number(process.env["GRAVIEW_JOURNEYS_PATIENCE"] ?? 10_000);
const appears = (locator, ms = PATIENCE) =>
  locator
    .waitFor({ state: "visible", timeout: ms })
    .then(() => true)
    .catch(() => false);

export class DeadEnd extends Error {}

/**
 * A PRESS IS JUDGED BY WHAT IT DID, NOT BY THE PAGE ANSWERING QUICKLY.
 * Playwright's click lands, then waits for any navigation the press
 * scheduled — a wait on the page's main thread. On the nightly's GPU leg a
 * press that changed three talks of two thousand kept that thread busy past
 * the click's four seconds: the call log said "click action done", and the
 * run was called a dead end for a press that had worked. A click that timed
 * out after it was done has landed; every step after it waits for what it
 * wanted, which is where a press that did nothing is found out.
 */
const click = (target, options = {}) =>
  target.click({ timeout: 4_000, ...options }).catch((error) => {
    if (/click action done/.test(String(error?.message ?? ""))) return;
    throw error;
  });

/** Why a press could not land, in Playwright's last word on it: what covered it, or what it was still waiting for. */
const whyNotPressed = (error) => {
  const said = String(error?.message ?? error)
    .split("\n")
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trim().replace(/^- /, ""))
    .filter(Boolean);
  const covered = said.findLast((line) => line.includes("intercepts pointer events"));
  const last = said.findLast((line) => !line.startsWith("Call log") && !line.startsWith("locator") && !line.startsWith("waiting for locator"));
  return `${said[0].slice(0, 90)}${covered ?? last ? ` — ${(covered ?? last).slice(0, 140)}` : ""}`;
};

const onMarked = (page) =>
  page.evaluate(() => {
    const target = document.querySelector("[data-journey-target]");
    const active = document.activeElement;
    // The control itself: a district holds controls of its own, and landing on one of those is somewhere else.
    if (!!target && active === target) return true;
    // Or, in the right-click menu, the row lit from its field: Enter there runs it, as Enter on the row does.
    return !!target && active?.getAttribute("data-testid") === "menu-type" && target.hasAttribute("data-menu-lit") && target.closest('[data-testid="context-menu"]')?.contains(active) === true;
  });

/**
 * INSIDE A GROUP THAT IS ONE TAB STOP (`data-graview-roving`) and holds the
 * target, the keys from where the keyboard is: the arrows, Home or End and
 * the arrows, or — where the group takes letters — the letter the target's
 * words begin with, as many times as it takes. The fewest; null when the
 * keyboard is not in the target's group.
 */
const groupKeys = (page) =>
  page.evaluate(() => {
    const target = document.querySelector("[data-journey-target]");
    const at = document.activeElement;
    const group = target?.closest("[data-graview-roving]");
    if (!group || !at || at === target || !group.contains(at)) return null;
    const items = [...group.querySelectorAll("[data-graview-roving-item]")].filter((item) => item.closest("[data-graview-roving]") === group && !item.disabled && item.getAttribute("aria-hidden") !== "true");
    const from = items.indexOf(at);
    const to = items.indexOf(target);
    if (from < 0 || to < 0) return null;
    const ways = [
      Array(Math.abs(to - from)).fill(to > from ? "ArrowDown" : "ArrowUp"),
      ["Home", ...Array(to).fill("ArrowDown")],
      ["End", ...Array(items.length - 1 - to).fill("ArrowUp")],
    ];
    if (group.getAttribute("data-graview-roving") === "letters") {
      const words = (el) => (el.textContent?.trim() || el.getAttribute("aria-label") || "").toLowerCase();
      const letter = words(target)[0];
      if (letter && /^[a-z0-9]$/.test(letter)) {
        let times = 0;
        for (let step = 1; step <= items.length; step++) {
          const item = items[(from + step) % items.length];
          if (!words(item).startsWith(letter)) continue;
          times += 1;
          if (item === target) break;
        }
        ways.push(Array(times).fill(letter));
      }
    }
    /*
     * IN THE RIGHT-CLICK MENU, A WORD TYPED (Roadmap f-menu-type-anything):
     * a letter goes into the menu's field and narrows the rows to those it
     * begins, the first lit, and Enter in the field runs the one lit — so
     * the fewest letters of the target's words that light it.
     */
    const menu = group.closest('[data-testid="context-menu"]');
    if (menu?.querySelector('[data-testid="menu-type"]')) {
      const fold = (text) => text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const rows = [...menu.querySelectorAll("[data-affordance]:not([disabled]), [data-menu-item]")].filter((row) => !row.closest("[data-graview-asking], [hidden]") && !row.hasAttribute("data-graview-destructive"));
      const label = (row) => (row.textContent ?? "").replace(/[…↵]/g, "").trim();
      const first = fold(label(target))[0] ?? "";
      for (let n = 1; n <= first.length; n++) {
        const typed = first.slice(0, n);
        if (!/^[a-z0-9]+$/.test(typed)) break;
        const lit = rows.find((row) => fold(label(row)).some((word) => word.startsWith(typed)));
        if (lit === target) {
          ways.push([...typed]);
          break;
        }
      }
    }
    return ways.sort((a, b) => a.length - b.length)[0];
  });

/**
 * THE CHEAPEST WAY BY TAB from where `restore` puts the keyboard to where
 * `isOn` says it is: forward, then back, each a probe, with the keys inside
 * the target's group where a Tab lands in it (`groups`). A route — Tabs,
 * which way, then the keys — or null within `limit`.
 */
async function walkTo(page, isOn, restore, limit, { groups = true } = {}) {
  let best = null;
  for (const back of [false, true]) {
    await restore();
    const ceiling = best ? best.cost - 1 : limit;
    for (let tabs = back ? 1 : 0; tabs <= ceiling; tabs++) {
      if (tabs > 0) await page.keyboard.press(back ? "Shift+Tab" : "Tab");
      if (await isOn()) {
        best = { cost: tabs, tabs, back, keys: [] };
        break;
      }
      const keys = groups ? await groupKeys(page) : null;
      if (keys) {
        if (tabs + keys.length <= ceiling) best = { cost: tabs + keys.length, tabs, back, keys };
        break;
      }
    }
  }
  return best;
}

/** A route taken, key by key, from where the keyboard is; whether it arrived. */
async function follow(page, route, isOn) {
  for (let at = 0; at < route.tabs; at++) await page.keyboard.press(route.back ? "Shift+Tab" : "Tab");
  for (const key of route.keys) await page.keyboard.press(key);
  return isOn();
}

export class Person {
  constructor(page, input) {
    this.page = page;
    this.input = input;
    this.presses = 0;
    this.log = [];
  }

  async settle(ms = 140) {
    await this.page.waitForTimeout(ms);
  }

  async key(key) {
    await this.page.keyboard.press(key);
    this.presses += 1;
  }

  /**
   * A typed entry counts once, whichever hand: the words cost the same
   * either way. At a fast typist's pace rather than a machine's — a field
   * that keeps up with forty keys a second is the claim, not a thousand.
   */
  async type(text) {
    await this.page.keyboard.type(text, { delay: 25 });
    this.presses += 1;
  }

  /**
   * The keyboard to this control, the cheapest way a person who knows the
   * page would take: Tab or Shift+Tab; the arrows (or a letter) inside a
   * group that is one Tab stop (`data-graview-roving`); and a skip
   * (`data-graview-skip`) that takes the keyboard past what stands between.
   */
  async reach(locator, what, { skips = true } = {}) {
    /*
     * THE CONTROL AS IT IS NOW, asked again at every press. Marked once, a
     * control a page redrew while the walk went on was a node no longer in
     * the page, and the keyboard walked past the one that replaced it and
     * was told it could not get there. The locator is the control; the mark
     * is where it is this moment.
     */
    const mark = () =>
      locator
        .evaluate(
          (el) => {
            if (!el.hasAttribute("data-journey-target")) {
              for (const old of document.querySelectorAll("[data-journey-target]")) old.removeAttribute("data-journey-target");
              el.setAttribute("data-journey-target", "");
            }
            return true;
          },
          null,
          { timeout: 2_000 },
        )
        .catch(() => false);
    const onTarget = async () => (await mark()) && onMarked(this.page);
    if (!(await mark())) throw new DeadEnd(`${what} is not on the screen`);
    if (await onTarget()) return;
    /*
     * HOW FAR IT REALLY IS, found by pressing rather than computed: the
     * browser's Tab order is not the document's (a scroller takes focus, a
     * lens's inert copy does not), and a guess that walked the wrong way
     * counted presses nobody would make. Every way is a probe from where the
     * keyboard started; the person is charged the cheapest, and then takes
     * it, key by key, so a way that only seemed to work is found out.
     */
    const page = this.page;
    const LIMIT = 220;
    const started = await page.evaluate(() => {
      for (const old of document.querySelectorAll("[data-journey-start]")) old.removeAttribute("data-journey-start");
      const at = document.activeElement;
      if (!at || at === document.body || at === document.documentElement) return false;
      at.setAttribute("data-journey-start", "");
      return true;
    });
    const restore = () =>
      page.evaluate((started) => {
        if (started) {
          document.querySelector("[data-journey-start]")?.focus();
          return;
        }
        // Back to where nothing has focus yet: a Shift+Tab from there starts at the end of the page.
        const anchor = document.createElement("span");
        anchor.tabIndex = -1;
        document.body.prepend(anchor);
        anchor.focus();
        anchor.remove();
      }, started);
    /*
     * PAST WHAT STANDS BETWEEN. A skip that only moves the keyboard is
     * pressed as a person reading "Skip to the 12 tasks" presses it: the
     * walk to the skip, Enter, and the walk on from where it landed — which
     * may be another skip ("Skip to the content", then the record's own).
     */
    const onSkip = (name) => () => page.evaluate((name) => document.activeElement?.getAttribute?.("data-graview-skip") === name, name);
    const search = async (from, budget, depth, used) => {
      if (budget < 0) return null;
      const direct = await walkTo(page, onTarget, from, budget);
      let found = direct ? { cost: direct.cost, legs: [{ route: direct }] } : null;
      if (depth === 0 || (found && found.cost <= 3)) return found;
      const names = (await page.evaluate(() => [...document.querySelectorAll("[data-graview-skip]:not([data-graview-skip-opens])")].map((el) => el.getAttribute("data-graview-skip")))).filter((name) => !used.includes(name));
      for (const name of names) {
        const ceiling = Math.min(budget, found ? found.cost - 1 : budget);
        const to = await walkTo(page, onSkip(name), from, ceiling - 1, { groups: false });
        if (!to) continue;
        await from();
        if (!(await follow(page, to, onSkip(name)))) continue;
        await page.keyboard.press("Enter");
        await page.waitForTimeout(60);
        const landed = await page.evaluate((depth) => {
          for (const old of document.querySelectorAll(`[data-journey-landed="${depth}"]`)) old.removeAttribute("data-journey-landed");
          const at = document.activeElement;
          if (!at || at === document.body) return false;
          at.setAttribute("data-journey-landed", String(depth));
          return true;
        }, depth);
        if (!landed) continue;
        const fromLanding = () => page.evaluate((depth) => document.querySelector(`[data-journey-landed="${depth}"]`)?.focus(), depth);
        const rest = (await onTarget())
          ? { cost: 0, legs: [{ route: { cost: 0, tabs: 0, back: false, keys: [] } }] }
          : await search(fromLanding, ceiling - to.cost - 1, depth - 1, [...used, name]);
        if (rest && (found === null || to.cost + 1 + rest.cost < found.cost)) found = { cost: to.cost + 1 + rest.cost, legs: [{ route: to, skip: name }, ...rest.legs] };
      }
      return found;
    };
    const best = await search(restore, LIMIT, skips ? 2 : 0, []);
    if (best === null) throw new DeadEnd(`the keyboard cannot reach ${what} in ${LIMIT} presses of Tab`);
    /* Taken, key by key, from where the keyboard started. */
    await restore();
    let there = true;
    for (const leg of best.legs) {
      if (!there) break;
      there = await follow(page, leg.route, leg.skip ? onSkip(leg.skip) : onTarget);
      if (there && leg.skip) {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(60);
      }
    }
    // A way that held as a probe and not when taken: the keyboard is put there, and the person charged what the probe found.
    if (!there) await page.evaluate(() => document.querySelector("[data-journey-target]")?.focus());
    this.presses += best.cost;
    const skipped = best.legs.flatMap((leg) => (leg.skip ? [leg.skip] : []));
    if (skipped.length > 0) this.skipped = [...(this.skipped ?? []), ...skipped];
  }

  /** Activate a control the way this person does. */
  async press(locator, what) {
    const before = this.presses;
    const target = locator.first();
    if (!(await appears(target))) throw new DeadEnd(`${what} is not on the screen`);
    if (this.input === "pointer") {
      await click(target).catch((error) => {
        throw new DeadEnd(`${what} cannot be pressed (${whyNotPressed(error)})`);
      });
      this.presses += 1;
    } else {
      await this.reach(target, what);
      await this.key("Enter");
    }
    this.note(what, before);
    await this.settle();
  }

  /**
   * A SKIP THAT OPENS what it names ("Skip to the 2 rules that are broken"),
   * pressed from the keyboard where the page offers one: the walk to it and
   * Enter. False where there is none, or the hand is the pointer's.
   */
  async pressSkip(name, what) {
    if (this.input !== "keyboard") return false;
    const skip = this.page.locator(`[data-graview-skip="${name}"]`).first();
    if ((await skip.count()) === 0) return false;
    const before = this.presses;
    await this.reach(skip, what, { skips: false });
    await this.key("Enter");
    this.note(what, before);
    await this.settle(250);
    return true;
  }

  /** Where the presses went, so a costly run says which step cost it. */
  note(what, before) {
    this.log.push(`${what} (${this.presses - before})`);
  }

  /** Put words in a field: point at it, or Tab to it, then type. */
  async fill(locator, text, what, { clear = false } = {}) {
    const before = this.presses;
    const target = locator.first();
    if (this.input === "pointer") {
      await click(target);
      this.presses += 1;
    } else {
      await this.reach(target, what);
    }
    if (clear) await this.key(process.platform === "darwin" ? "Meta+A" : "Control+A");
    if (clear && text === "") await this.key("Backspace");
    else await this.type(text);
    this.note(what, before);
  }

  /** Take an entry of an open list (the arranging line's): pointer presses it, keyboard arrows to it and presses Enter. */
  async pick(entry, what) {
    const before = this.presses;
    if (this.input === "pointer") {
      await click(entry);
      this.presses += 1;
    } else {
      const on = () => entry.evaluate((el) => el === document.activeElement).catch(() => false);
      for (let i = 0; i < 120 && !(await on()); i++) await this.key("ArrowDown");
      if (!(await on())) throw new DeadEnd(`the arrow keys do not reach ${what}`);
      await this.key("Enter");
    }
    this.note(what, before);
  }

  /** Choose an option of a native select: pointer picks it, keyboard arrows to it. */
  async choose(select, label, what) {
    const options = await select.evaluate((el) => ({ at: el.selectedIndex, all: [...el.options].map((o) => ({ text: o.textContent.trim(), value: o.value })) }));
    let index = label ? options.all.findIndex((o) => o.text === label) : -1;
    if (index < 0) index = options.all.findIndex((o) => o.value !== "");
    if (index < 0) throw new DeadEnd(`${what} offers nothing to choose`);
    const before = this.presses;
    if (this.input === "pointer") {
      await click(select);
      await select.selectOption({ index });
      this.presses += 2;
    } else {
      await this.reach(select, what);
      /*
       * TYPED, the way a closed select takes a choice from the keyboard on
       * every platform: arrows open the menu on a Mac rather than moving
       * through it, and a native menu is not something a page can drive.
       * The first word only — a space typed into a closed select opens it.
       */
      await this.type(options.all[index].text.split(/\s+/)[0]);
      const landed = await select.evaluate((el) => el.selectedIndex);
      if (landed !== index) {
        // Type-ahead found another option first: arrow on from where it landed, a press each.
        await select.selectOption({ index });
        this.presses += Math.abs(index - landed);
      }
    }
    this.note(what, before);
    return options.all[index].text;
  }
}

/* ------------------------------------------------------------------ */
/* Shared moves                                                        */
/* ------------------------------------------------------------------ */

const escapeAttr = (value) => value.replace(/["\\]/g, "\\$&");

/**
 * A CHOSEN THING'S ACTS ARE THE MENU AT IT. The scene drew them in a rail
 * (a sheet on a phone) beside whatever was chosen; it draws no strip now —
 * the seat offers at most three, and every act is in the menu a right-click
 * opens, or, from the keyboard, the acts key its card names
 * (`aria-keyshortcuts`). A person reaching for an act does one of those.
 */
async function openActs(person) {
  const page = person.page;
  if (await page.locator('[data-testid="context-menu"]').first().isVisible().catch(() => false)) return;
  const before = person.presses;
  const chosen = page.locator("[data-graview-view][data-graview-selected]").first();
  if (person.input === "keyboard") {
    let key = await page.evaluate(() => document.activeElement?.closest?.("[data-graview-view][aria-keyshortcuts]")?.getAttribute("aria-keyshortcuts") ?? null);
    if (!key && (await chosen.isVisible().catch(() => false))) {
      await person.reach(chosen, "the chosen card");
      key = await chosen.getAttribute("aria-keyshortcuts");
    }
    if (!key) return;
    await person.key(key.toLowerCase());
  } else {
    /*
     * A phone's panel is a sheet standing over what is chosen, and a finger
     * has no right button: its head says "Acts…", and a person presses that
     * (W-195).
     */
    const sheet = page.locator('[data-graview-map-panel="sheet"] [data-testid="map-panel-acts"]').locator("visible=true").first();
    // On the ground, a record chosen in a narrow scene says "Acts…" (the tenth walk), as the map's sheet does.
    const says = page.locator('[data-testid="chosen-acts"]').locator("visible=true").first();
    /*
     * ON A PHONE, THE SHEET IS WHAT A PERSON WAITS FOR. It rises a moment
     * after the press that chose the district — 700 ms on a throttled
     * laptop, longer on the nightly's runner — and a look taken before it
     * rose found no "Acts…", so the walk right-clicked the district's name
     * as a laptop would, under the sheet as it came up, and no menu opened:
     * "Submit a talk is not on the screen" (the nightly's GPU leg, and two walks in three on a throttled laptop). A
     * finger has no right button; on a phone the walk waits for the door a
     * finger has.
     */
    if ((page.viewportSize()?.width ?? 1440) < 600) await appears(sheet.or(says).first());
    if (await sheet.isVisible().catch(() => false)) {
      await click(sheet).catch(() => {});
      person.presses += 1;
      await person.settle(250);
      person.note("its acts", before);
      return;
    }
    if (await says.isVisible().catch(() => false)) {
      await click(says).catch(() => {});
      person.presses += 1;
      await person.settle(250);
      person.note("its acts", before);
      return;
    }
    if (!(await chosen.isVisible().catch(() => false))) {
      /*
       * A record chosen inside a picture — "Today" among the lists — is no
       * card of its own: a person right-clicks it where it is drawn.
       */
      const id = await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get("sel")?.split(",").pop() ?? null);
      const pick = id ? page.locator(`[data-graview-pick="${escapeAttr(id)}"]:not([inert] *):not([aria-hidden="true"] *)`).locator("visible=true").first() : null;
      if (!pick || !(await pick.isVisible().catch(() => false))) return;
      // At its head, where its name is: its middle may be one of the records it holds.
      await pick.click({ button: "right", position: { x: 14, y: 10 }, timeout: 4_000 }).catch(() => {});
      person.presses += 1;
      await person.settle(250);
      person.note("its acts", before);
      return;
    }
    /*
     * On its name, as a person aims at the card itself. The host is the
     * layout's box, larger than the card drawn in it, so its middle was
     * whatever the card draws there — on a member, the chips of what they
     * borrowed, whose right-click is that record's menu — and its corner
     * was empty floor, which takes no press at all.
     */
    const said = await chosen.getAttribute("aria-label").catch(() => null);
    const named = said ? chosen.getByText(said, { exact: true }).locator("visible=true").first() : null;
    await ((named && (await named.isVisible().catch(() => false))) ? named : chosen).click({ button: "right", timeout: 4_000 }).catch(() => {});
    person.presses += 1;
  }
  await person.settle(250);
  person.note("its acts", before);
}

/** A chosen thing's acts are the menu at it: open it when what is wanted is inside. */
async function revealActs(person, wanted) {
  // What a press just asked for may take a frame or two to be drawn.
  await wanted.first().waitFor({ state: "visible", timeout: 700 }).catch(() => {});
  if (await wanted.first().isVisible().catch(() => false)) return;
  await openActs(person);
}

/** An act's control, by the id the derivation gave it or else by its title. */
function actControl(page, act, title) {
  return page.locator(
    `[data-affordance="schema:${escapeAttr(act)}"], [data-affordance="schema:add:${escapeAttr(act)}"], [data-affordance$=":${escapeAttr(act)}"]`,
  ).or(page.getByRole("button", { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( …)?$`) }));
}

/** Press the act, opening its menu, or "Show N more" on a page, first if that is where it is. */
async function pressAct(person, act, title) {
  const page = person.page;
  let control = actControl(page, act, title).first();
  await revealActs(person, control);
  if (!(await control.isVisible().catch(() => false))) {
    const more = page.getByRole("button", { name: /^Show \d+ more$/ }).first();
    if (await more.isVisible().catch(() => false)) {
      await person.press(more, "Show more");
      control = actControl(page, act, title).first();
    }
  }
  await person.press(control, `"${title}"`);
}

/**
 * Answer what an act asks, one question at a time on the scene: words in a
 * field, or one of the choices offered. `answers` maps a question to a wanted
 * choice's label; a name goes in the first text field.
 */
async function answerAsks(person, { name, choose = [], values = {} }) {
  const page = person.page;
  let named = false;
  // As many questions as an act has: a car for sale asks sixteen.
  for (let round = 0; round < 40; round++) {
    const ask = page.locator("[data-graview-asking]").last();
    if (!(await ask.isVisible().catch(() => false))) return;
    // A date's editor arrives a beat after its question (fetched when first asked for).
    await ask.locator("[data-graview-when-arriving]").first().waitFor({ state: "detached", timeout: 5_000 }).catch(() => undefined);
    const field = ask.locator("form input").first();
    if (await field.isVisible().catch(() => false)) {
      // A date's editor is a text box that reads what people say (Roadmap f-date-inputs): it takes a day, or a day and a time, as one.
      const when = await field.evaluate((el) => el.closest("[data-graview-when]")?.getAttribute("data-graview-when") ?? null);
      const type = when ? (when === "day" ? "date" : "datetime-local") : await field.getAttribute("type");
      const known = values[(await field.getAttribute("name")) ?? ""];
      const value = known !== undefined && (named || known !== name) ? known : type === "date" ? "2026-09-20" : type === "datetime-local" ? "2026-09-20T09:00" : type === "number" ? "2" : !named && name ? name : "Something";
      if (type === "date" || type === "datetime-local") {
        // A date field takes its value whole; a person types it into the field.
        await (person.input === "pointer" ? field.click().then(() => (person.presses += 1)) : person.reach(field, "the date"));
        await field.fill(value);
        person.presses += 1;
      } else {
        await person.fill(field, value, "the field it asks for");
      }
      if (type !== "date" && type !== "datetime-local" && type !== "number") named = true;
      await person.key("Enter");
      await person.settle(200);
      continue;
    }
    const filter = ask.locator('[data-testid="ask-filter"]');
    const wanted = choose.find(Boolean);
    if (wanted && (await filter.isVisible().catch(() => false))) {
      await person.fill(filter, wanted, "the filter of choices");
      await person.settle(150);
    }
    const choices = ask.locator('[role="group"] button:not([disabled])');
    await choices.first().waitFor({ state: "visible", timeout: 1_200 }).catch(() => {});
    let count = await choices.count();
    if (count === 0 && wanted && (await filter.isVisible().catch(() => false))) {
      // The name wanted is not among these (it was another question's): a person clears the filter and picks.
      await person.fill(filter, "", "the filter of choices", { clear: true });
      await person.settle(150);
      await choices.first().waitFor({ state: "visible", timeout: 1_200 }).catch(() => {});
      count = await choices.count();
    }
    if (count === 0) throw new DeadEnd("the act asks a question with nothing to answer it with");
    let pick = choices.first();
    if (wanted) {
      const exact = ask.locator(`[role="group"] button[aria-label$=": ${escapeAttr(wanted)}"]`).first();
      if (await exact.isVisible().catch(() => false)) pick = exact;
    }
    await person.press(pick, "a choice");
    await person.settle(200);
  }
}

/**
 * WHAT A PERSON WOULD TYPE, per argument: the record's name where it fits,
 * else the first of a few ordinary answers the act's own input accepts — an
 * email, an address, a date, a year — else one copied from a record of the
 * same kind, as a person copies a VIN off a windscreen. A field given
 * "Something" was a form a person could not have sent (the seventh walk:
 * "Sign up" refused every run on its email, "Put a car on sale" on its VIN).
 */
async function validValues(ctx, act, kind, name) {
  return inStore(ctx.page, ctx.kinds, (store, { act, kind, name }) => {
    const mutation = store.allMutations().find((one) => one.name === act);
    const shape = mutation?.input?.shape ?? {};
    const existing = store.graph.allNodes().filter((node) => node.kind === kind);
    const values = {};
    for (const [key, field] of Object.entries(shape)) {
      if (typeof field?.safeParse !== "function") continue;
      const seen = existing.map((node) => node[key]).filter((value) => typeof value === "string" || typeof value === "number").slice(0, 1);
      // A list is answered as a person leaves one: empty.
      for (const candidate of [name, "Something", "someone@example.test", "https://example.test/one.jpg", "2026-09-20", "2026-09-20T09:00", 2, 2020, 12, 0, ...seen, []]) {
        if (field.safeParse(candidate).success) {
          values[key] = String(candidate);
          break;
        }
      }
    }
    return values;
  }, { act, kind, name });
}

/** Fill a routed page's form for one act and send it. */
async function fillForm(person, form, { name, choose = [], values = {} }) {
  // A date's editor arrives a beat after its form (fetched when first asked for): a person sees the box before typing in it.
  await form.locator("[data-graview-when-arriving]").first().waitFor({ state: "detached", timeout: 5_000 }).catch(() => undefined);
  const fields = form.locator("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea");
  const count = await fields.count();
  let named = false;
  let lastText = null;
  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    if (!(await field.isVisible().catch(() => false)) || (await field.isDisabled())) continue;
    const info = await field.evaluate((el) => {
      // The label's own words, not the options of the select it wraps.
      const own = el.labels?.[0] ?? el.closest("label");
      const label = (own ? [...own.childNodes].filter((node) => node !== el && !node.contains?.(el)).map((node) => node.textContent).join(" ") : el.getAttribute("aria-label") ?? "").trim();
      // A date's editor is a text box that reads what people say (Roadmap f-date-inputs): it takes a day, or a day and a time, as one.
      const when = el.closest("[data-graview-when]")?.getAttribute("data-graview-when");
      const type = when ? (when === "day" ? "date" : "datetime-local") : el.type;
      return { tag: el.tagName.toLowerCase(), type, name: el.name, label, required: el.required || /\*/.test(label), value: el.value };
    });
    const isName = !named && /label|name|title/i.test(info.label);
    if (!info.required && !isName) continue;
    if (info.tag === "select") {
      await person.choose(field, choose.find((wanted) => wanted) ?? null, `the ${info.label || "choice"}`);
      continue;
    }
    if (info.value && !isName) continue;
    // What a person would type there: the name where a name goes, else a value the act accepts (`validValues`).
    const known = isName ? undefined : values[info.name];
    const value = known ?? (info.type === "date" ? "2026-09-20" : info.type === "datetime-local" ? "2026-09-20T09:00" : info.type === "number" ? "2" : info.type === "time" ? "09:00" : isName ? name : "Something");
    if (info.type === "date" || info.type === "time" || info.type === "datetime-local") {
      await (person.input === "pointer" ? field.click().then(() => (person.presses += 1)) : person.reach(field, `the ${info.label}`));
      await field.fill(value);
      person.presses += 1;
    } else {
      // A name already written there (a rename's form) is replaced, not added to.
      await person.fill(field, value, `the ${info.label || "field"}`, { clear: Boolean(info.value) });
      lastText = field;
    }
    if (isName) named = true;
  }
  const submit = form.locator('button[type="submit"], button:not([type])').last();
  if (person.input === "keyboard" && lastText) {
    // Enter in a field sends its form.
    await person.reach(lastText, "the last field");
    await person.key("Enter");
  } else {
    await person.press(submit, "the form's button");
  }
  await person.settle(250);
}

/**
 * A kind's district on the scene. The pointer aims at its name — the
 * middle of the district is often its billboard, a different thing to
 * press — and the keyboard lands on the district itself.
 */
async function pressDistrict(person, kind, plural) {
  const page = person.page;
  // Already chosen: nothing to press.
  if ((await page.locator(`[data-graview-view="kind:${escapeAttr(kind)}"][data-graview-selected]`).count()) > 0) return;
  const district = page.locator(`[data-graview-view="kind:${escapeAttr(kind)}"]`).first();
  if (!(await district.isVisible().catch(() => false))) {
    // A narrow scene folds the districts it has no room for into a menu, said in words: "3 more districts".
    const more = page.getByRole("button", { name: /^\d+ more districts?$/ }).first();
    if (await more.isVisible().catch(() => false)) await person.press(more, "the folded districts");
    const item = page.getByRole("menuitem", { name: new RegExp(`^${plural}(?!\\p{L})`, "u") }).first();
    if (await item.isVisible().catch(() => false)) {
      await person.press(item, `${plural} in the menu`);
      await person.settle(400);
      /*
       * The menu's press goes into the district, and the keyboard with it, to
       * its heading. Its own card on the row, which a phone's full-width row
       * now has room to keep (FR-143), is where the reader already is: walking
       * there too cost a keyboard twenty-five presses nobody makes.
       */
      return;
    }
  }
  /*
   * Past the edge of a phone, a district is no place a finger can land; the
   * sign on that edge names it and brings it in, and a person follows it.
   */
  const sign = page.locator(`[data-graview-past-edge="kind:${escapeAttr(kind)}"]`).first();
  if (person.input === "pointer" && (await sign.isVisible().catch(() => false))) {
    await person.press(sign, `the sign to the ${plural}`);
    await person.settle(500);
  }
  const face = district.locator(".graview-kind-face").getByText(plural, { exact: true }).first();
  const aim = person.input === "pointer" && (await face.isVisible().catch(() => false)) ? face : district;
  await person.press(aim, `the ${plural} district`);
}

/** The pages face's link to a kind's list, wherever the face put it. */
async function openKindPage(person, plural) {
  const page = person.page;
  // "Tasks 10" is often "Tasks" and "10" with nothing between: the name ends where its letters do.
  const link = page.locator("a[href]").filter({ hasText: new RegExp(`^\\s*${plural}(?!\\p{L})`, "u") });
  if (!(await link.first().isVisible().catch(() => false))) {
    const menu = page.getByRole("button", { name: /every place|more (place|picture)|menu|sections|kinds|navigation/i }).first();
    if (await menu.isVisible().catch(() => false)) await person.press(menu, "the menu");
  }
  const visible = link.locator("visible=true");
  if ((await visible.count()) === 0) throw new DeadEnd(`no link to the ${plural} is on the screen`);
  await person.press(visible.first(), `the ${plural} link`);
  await page.waitForLoadState("domcontentloaded");
  /*
   * ARRIVED, not merely asked to go. The face routes in the page, so the
   * load state is the one it already had; on the nightly's runner the talks
   * took a second to draw, and the journey took the HOME page's "Only…" —
   * the gallery's lens has one — as the talks', walked past the real one,
   * and said the keyboard could not reach it. The page is there when its
   * heading names the kind.
   */
  // The page's own title, at whatever level the face says it: under the app bar's name it is an h2 (FR-131).
  const heading = page.locator("[data-graview-page-title], main h1").filter({ hasText: new RegExp(`^\\s*${plural}(?!\\p{L})`, "u") }).first();
  if (!(await appears(heading))) throw new DeadEnd(`the ${plural} link did not open the ${plural}`);
  await person.settle(300);
}

/** The Find box on either face, pressed or reached with its own shortcut. */
async function openFind(person, face) {
  const page = person.page;
  const box =
    face === "scene"
      ? page.locator('[data-testid="find-box"]')
      : page.getByRole("searchbox", { name: "Find anything" }).or(page.locator('[data-testid="find-box"]'));
  /*
   * The box says its own keys (`aria-keyshortcuts`: "/" and ⌘K); a keyboard
   * person uses one — on the pages as on the scene, where the walk had Tabbed
   * eleven times across the bar to a box that answered "/" all along.
   */
  // Put away behind a magnifier on a phone, the box still says them: the key opens it.
  const anyBox = page.locator('[data-testid="find-box"], [data-testid="nav-find"]');
  const keys = person.input === "keyboard" ? await anyBox.first().getAttribute("aria-keyshortcuts", { timeout: 2_000 }).catch(() => null) : null;
  if (keys && keys.split(/\s+/).includes("/")) {
    await person.key("/");
    await person.settle(200);
    const now = anyBox.locator("visible=true").first();
    if (await now.evaluate((el) => el === document.activeElement).catch(() => false)) return now;
  }
  let shown = box.locator("visible=true").first();
  if (!(await shown.isVisible().catch(() => false))) {
    const opener = page.locator('[data-testid="nav-find"]').or(page.getByRole("button", { name: /^(find|search)/i })).first();
    if (await opener.isVisible().catch(() => false)) await person.press(opener, "the way to Find");
    shown = box.locator("visible=true").first();
  }
  if (!(await appears(shown))) throw new DeadEnd("there is no Find box on the screen");
  if (person.input === "pointer") {
    await shown.click();
    person.presses += 1;
  } else {
    await person.reach(shown, "the Find box");
  }
  return shown;
}

/**
 * Into a kind by its name, from the keyboard: "/", the kind's name, and
 * Enter on the row that is the kind. Falls back to the district where Find
 * offers no row for it.
 */
async function goByFind(person, kind, plural) {
  const page = person.page;
  const before = person.presses;
  await openFind(person, "scene");
  await person.type(plural.toLowerCase());
  await person.settle(450);
  const row = page.locator('[data-testid="find-hit"][data-about="kind"]').filter({ hasText: new RegExp(`^${plural}(?!\\p{L})`, "u") }).first();
  if (!(await row.isVisible().catch(() => false))) {
    await person.key("Escape");
    await person.key("Escape");
    person.note(`Find "${plural.toLowerCase()}" (no row for the kind)`, before);
    return pressDistrict(person, kind, plural);
  }
  const wanted = await row.getAttribute("id");
  const lit = () => page.locator('[data-testid="find-box"]').getAttribute("aria-activedescendant");
  for (let i = 0; i < 12 && (await lit()) !== wanted; i++) await person.key("ArrowDown");
  if ((await lit()) !== wanted) throw new DeadEnd(`the keys do not reach "${plural}" in the Find strip`);
  await person.key("Enter");
  person.note(`Find "${plural.toLowerCase()}"`, before);
  /*
   * THERE WHEN THE KEYBOARD IS IN THE KIND, as a person sees it go in, not
   * after a set while. Eight hundred milliseconds was a guess at a fast
   * machine: on the nightly's runner the keys had not yet landed when the
   * walk looked for the place's acts key, found none, and went Up and across
   * the districts — 24 presses for 4. On the place, or on its arranging
   * line once the line is drawn; where they never land, the walk goes on
   * and finds that out.
   */
  await page
    .waitForFunction(
      (kind) => {
        const place = document.querySelector(`[data-graview-view="aggregate:${CSS.escape(kind)}"]`);
        const at = document.activeElement;
        if (!place || !at || !place.contains(at)) return false;
        const line = [...place.querySelectorAll('[role="group"][aria-label="Arrange"] :is(button, input)')].some((one) => one.checkVisibility?.() ?? true);
        return at !== place || !line;
      },
      kind,
      { timeout: PATIENCE },
    )
    .catch(() => undefined);
}

/** Find a record by part of its name and open it. Returns once it is open. `more` is a word of the name that narrows a long answer. */
async function findAndOpen(person, face, target, query, more = null) {
  const page = person.page;
  const before = person.presses;
  await openFind(person, face);
  await person.type(query);
  person.note(`Find "${query}"`, before);
  await person.settle(450);
  if (face === "scene") {
    const hits = page.locator('[data-testid="find-hit"]');
    const count = await hits.count();
    if (count === 0) throw new DeadEnd(`Find shows nothing for "${query}"`);
    const texts = await hits.allTextContents();
    const reading = texts.flatMap((text, at) => (text.includes(target.label) ? [at] : []));
    if (reading.length === 0) throw new DeadEnd(`Find does not offer "${target.label}" for "${query}" among ${count}`);
    // Of several that read the name, a person takes the one that says it is what they want — "· song" — else the first.
    const saysNoun = target.noun ? new RegExp(`· ${target.noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|·|$)`) : null;
    let index = (saysNoun && reading.find((at) => saysNoun.test(texts[at]))) ?? reading[0];
    // Rows that read the same: a person cannot tell which is which, and takes the first.
    person.twins = texts.filter((text) => text.trim() === texts[index].trim()).length;
    if (person.input === "pointer") {
      await hits.nth(index).click();
      person.presses += 1;
    } else {
      /*
       * A LONG ANSWER, NARROWED BY ANOTHER WORD (the tenth walk). Where the
       * row wanted is past what the strip shows and the strip says "another
       * word of the name narrows them", a person types it rather than walk a
       * hundred rows; then walks what is left.
       */
      let wanted = await hits.nth(index).evaluate((el) => el.id || el.closest("[id]")?.id || "");
      if (more && index >= 12 && (await page.locator('[data-testid="find-more-words"]').isVisible().catch(() => false))) {
        const before = person.presses;
        await person.type(` ${more}`);
        person.note(`another word, "${more}"`, before);
        await person.settle(450);
        const narrowed = await hits.allTextContents();
        const at = narrowed.findIndex((text) => text.includes(target.label));
        if (at < 0) throw new DeadEnd(`Find does not offer "${target.label}" for "${query} ${more}"`);
        index = at;
        wanted = await hits.nth(index).evaluate((el) => el.id || el.closest("[id]")?.id || "");
      }
      // Arrowed to, watching the highlight move as a person does, until the row wanted is the one lit.
      const lit = () => page.locator('[data-testid="find-box"]').getAttribute("aria-activedescendant");
      const position = async () => {
        const id = await lit();
        return id ? page.locator('[data-testid="find-hit"]').evaluateAll((els, id) => els.findIndex((el) => el.id === id), id) : -1;
      };
      // A page at a time while the row is more than a page away, then a row at a time (PageDown walks records, as ↓ does).
      for (let i = 0; i < 40 && index - (await position()) > 12; i++) await person.key("PageDown");
      // The rows stay as they are while the keys move (a record's acts stand beside the list, or open under it only when asked): the bound is the rows there are.
      const rowsNow = () => page.locator('[data-testid="find-hit"]').count();
      for (let i = 0; i < (await rowsNow()) + 2 && index > 0 && (await lit()) !== wanted; i++) await person.key((await position()) > index ? "ArrowUp" : "ArrowDown");
      if ((await lit()) !== wanted) throw new DeadEnd(`the keys do not reach "${target.label}" in the Find strip`);
      await person.key("Enter");
    }
    await person.settle(500);
    return;
  }
  await person.key("Enter");
  await page.waitForLoadState("domcontentloaded");
  await person.settle(450);
  const link = page.locator(`main a[href$="/${encodeURIComponent(target.id)}"], main a[href$="/${target.id}"]`).locator("visible=true").first();
  if (!(await appears(link))) throw new DeadEnd(`the search page does not link "${target.label}" for "${query}"`);
  await person.press(link, `"${target.label}"`);
  await page.waitForLoadState("domcontentloaded");
  await person.settle(300);
}

/** A word of the record's name that is its own, to search by. */
export function partOf(label, others) {
  const words = label.split(/[^\p{L}\p{N}']+/u).filter((word) => word.length >= 4);
  const own = words.filter((word) => others.filter((other) => other.toLowerCase().includes(word.toLowerCase())).length === 1);
  if (own.length > 0) return own.sort((a, b) => b.length - a.length)[0].toLowerCase();
  /*
   * NO WORD OF ITS OWN: two that are its own together. Every word of
   * "2021/063 · Mountain biker, head injury, Crib Ddu" is in a hundred other
   * callouts' names; a person types the two that are this one's — its year
   * and number — not the longest word, which finds a hundred (the tenth walk).
   */
  const all = label.split(/[^\p{L}\p{N}']+/u).filter((word) => word.length >= 2);
  const holds = (other, pair) => pair.every((word) => other.toLowerCase().includes(word.toLowerCase()));
  for (let at = 0; at + 1 < all.length; at++) {
    const pair = [all[at], all[at + 1]];
    if (others.filter((other) => holds(other, pair)).length === 1) return pair.join(" ").toLowerCase();
  }
  /*
   * NOR TWO: the whole name, as a person who knows it types it. "Hollow
   * Daughters 7" shares every word and every pair with a dozen other films;
   * the longest word, "daughters", found two hundred (the twelfth walk).
   */
  return label.toLowerCase();
}

/**
 * THE WORD A PERSON TYPES NEXT, when what they typed finds a hundred: the
 * word of the name, not yet typed, that the fewest other names share with
 * what was (the tenth walk: "incremental", then "kubernetes").
 */
function anotherWord(label, others, query) {
  const typed = query.toLowerCase().split(/\s+/);
  const holds = (other, words) => words.every((word) => other.toLowerCase().includes(word));
  const words = [...new Set(label.split(/[^\p{L}\p{N}']+/u).filter((word) => word.length >= 4).map((word) => word.toLowerCase()))].filter((word) => !typed.includes(word));
  const ranked = words.map((word) => ({ word, sharing: others.filter((other) => holds(other, [...typed, word])).length })).sort((a, b) => a.sharing - b.sharing || b.word.length - a.word.length);
  return ranked[0]?.word ?? null;
}

/** Wait for the store to say the job happened. */
async function until(page, kinds, fn, arg, what, ms = 2_500) {
  const began = Date.now();
  let last;
  while (Date.now() - began < ms) {
    last = await inStore(page, kinds, fn, arg);
    if (last && last.ok) return last;
    await page.waitForTimeout(120);
  }
  throw new DeadEnd(last?.why ?? `${what} did not happen`);
}

/* ------------------------------------------------------------------ */
/* The jobs, on each face                                              */
/* ------------------------------------------------------------------ */

const lastBatch = (store) => {
  const batches = store.batches();
  return batches.length;
};

/**
 * Each job: `prepare` (untimed: choose the record, arrange what must be
 * true), `start` (the URL the job begins on), `run` (timed, pressed).
 */
export const JOBS = {
  narrow: {
    /*
     * A LIST THIS SHORT IS READ, NOT NARROWED. The pages draw no arranging
     * line under eight records (`ARRANGE_FROM`), on purpose; seedbed's four
     * plots were a dead end "in every face" for a job nobody does with four.
     * Counted with the past, which a person widens to.
     */
    async prepare(ctx, job) {
      const count = await inStore(ctx.page, ctx.kinds, (store, kind) => store.graph.count(kind), job.kind);
      if (typeof count === "number" && count < 8) return { skip: `${count} ${job.plural.toLowerCase()} are read, not narrowed` };
      // The number a person has in mind: the middle of what the list holds, as they would type it.
      const typical = await inStore(ctx.page, ctx.kinds, (store, { kind, field }) => {
        const held = store.graph.allNodes().filter((node) => node.kind === kind && typeof node[field] === "number").map((node) => node[field]).sort((a, b) => a - b);
        return held.length > 0 ? Math.round(held[Math.floor(held.length / 2)]) : null;
      }, { kind: job.kind, field: job.field });
      // How many are behind the horizon, by the kind's own lifecycle.
      const split = await inStore(ctx.page, ctx.kinds, (store, kind) => {
        const lifecycle = store.schema.tryDefinition(kind)?.lifecycle;
        const nodes = store.graph.allNodes().filter((node) => node.kind === kind);
        const past = Array.isArray(lifecycle?.retired) ? nodes.filter((node) => lifecycle.retired.includes(node[lifecycle.field])).length : 0;
        return { current: nodes.length - past, past };
      }, job.kind);
      return { ...(typeof typical === "number" ? { typical } : {}), ...(split && typeof split.current === "number" ? split : {}) };
    },
    start: (ctx) => ctx.home,
    async run(person, ctx, job, prep) {
      const page = person.page;
      if (ctx.face === "pages") await openKindPage(person, job.plural);
      else if (person.input === "keyboard") {
        /*
         * FROM THE KEYBOARD, BY NAME: "/" and the kind's name, Enter — where
         * a Tab walk to the district, then to Down, cost forty keys (the
         * tenth walk). Find goes into the kind whole, and the keys land on
         * its arranging line.
         */
        await goByFind(person, job.kind, job.plural);
      } else {
        await pressDistrict(person, job.kind, job.plural);
        await person.settle(300);
        /*
         * PRESSED FROM INSIDE ANOTHER PLACE, a district is raised as a
         * relation of it (todo's Tasks from "The lists"): its name on the
         * trail goes in, as a person reads it (the tenth walk).
         */
        const into = page.locator('[data-testid="raised-into"]').locator("visible=true").first();
        if (!(await page.locator('button[data-testid$="-add"], button[data-testid$="-all"]').locator("visible=true").first().isVisible().catch(() => false)) && (await into.isVisible().catch(() => false))) {
          await person.press(into, `"${((await into.textContent()) ?? job.plural).replace(/\s*↘\s*$/, "").trim()}" on the trail`);
          await person.settle(600);
        }
        // The list arranges where the kind is drawn whole: down into its district.
        const down = page.locator('[data-testid="overview"][aria-pressed="true"]').locator("visible=true").first();
        if (!(await page.locator('button[data-testid$="-add"], button[data-testid$="-all"]').locator("visible=true").first().isVisible().catch(() => false)) && (await down.isVisible().catch(() => false))) {
          await person.press(down, `Down to ${job.plural}`);
          await person.settle(600);
        }
      }
      // "Filter" on the arranging line, or — where the line is narrow — the one "Arrange" that holds it.
      const filter = page.locator('button[data-testid$="-add"], button[data-testid$="-all"]').locator("visible=true").first();
      /*
       * PAST THE HORIZON FIRST, where that is where the records are. A rescue
       * team has one callout under way and 1,458 behind it: the list of one
       * offers nothing to arrange, and a person who wants the long ones
       * presses "+1458 past" and then narrows (the tenth walk).
       */
      // The district's "+1458 past", the list's own link, or — where the district is folded away on a phone — the arranging line's.
      const past = page.locator('[data-testid="past-link"], [data-testid$="-past"], button.graview-kind-past').locator("visible=true").first();
      // Where most of the list is past — one callout under way, 1,458 behind it — the past is what is narrowed.
      const mostlyPast = typeof prep.current === "number" && typeof prep.past === "number" && prep.past > prep.current;
      if ((mostlyPast || !(await appears(filter, 2_500))) && (await past.isVisible().catch(() => false))) {
        await person.press(past, `"${((await past.textContent()) ?? "past").trim()}"`);
        await person.settle(600);
      }
      if (!(await appears(filter))) throw new DeadEnd(`there is no "Filter" to narrow the ${job.plural.toLowerCase()} with`);
      await person.press(filter, '"Filter"');
      /*
       * A NUMBER, TYPED. From the keyboard the number a person has in mind
       * is typed into the list's own box, and "at most" it is the first
       * entry under it (the tenth walk); the pointer steps to one.
       */
      if (person.input === "keyboard" && typeof prep.typical === "number") {
        const box = page.locator('[data-testid="arrange-list"] input[data-testid$="-filter-find"]').first();
        if (await appears(box, 3_000)) {
          await person.fill(box, String(prep.typical), `${job.label} ${prep.typical}`);
          const typed = page.locator(`[data-testid="arrange-list"] [data-value="${job.field}:at-most:${prep.typical}"]`).first();
          if (!(await appears(typed, 3_000))) throw new DeadEnd(`typing ${prep.typical} into "Filter" offers no ${job.label.toLowerCase()} of at most ${prep.typical}`);
          const option = (await typed.textContent())?.trim() ?? job.label;
          await person.pick(typed, `"${option}"`);
          await person.settle(300);
          const chip = page.locator('[data-testid$="-condition"]').filter({ hasText: job.label }).locator("visible=true").first();
          if (!(await appears(chip))) throw new DeadEnd(`choosing "${option}" did not narrow the ${job.plural.toLowerCase()}`);
          return;
        }
      }
      /*
       * Each heading of the list starts closed: the one the field stands
       * under is opened, as a person opens it — once the list is there. The
       * list's part is fetched at the first press on the line, so a heading
       * looked for at once was not there yet on a cold page, was passed
       * over, and the entry under it never appeared ("Filter offers no …").
       */
      const section = page.locator(`[data-testid="arrange-list"] [data-section="${job.field}"]`).first();
      await appears(section);
      const heading = section.locator(':scope > button[aria-expanded="false"]');
      if (await heading.isVisible().catch(() => false)) await person.press(heading, `"${job.label}"`);
      const entry = page.locator(`[data-testid="arrange-list"] [data-value^="${job.field}:at-most:"]`).first();
      if (!(await appears(entry))) throw new DeadEnd(`"Filter" offers no ${job.label.toLowerCase()} to narrow the ${job.plural.toLowerCase()} by`);
      const option = (await entry.textContent())?.trim() ?? job.label;
      await person.pick(entry, `"${option}"`);
      await person.settle(300);
      /*
       * Narrowing two thousand talks is the list drawn again: on a throttled
       * runner that took longer than the three seconds once given to it, and
       * a narrowing that worked was called one that did not. It is given the
       * patience every other step has.
       */
      const chip = page.locator('[data-testid$="-condition"]').filter({ hasText: job.label }).locator("visible=true").first();
      if (!(await appears(chip))) throw new DeadEnd(`choosing "${option}" did not narrow the ${job.plural.toLowerCase()}`);
    },
  },

  make: {
    async prepare(ctx, job) {
      const name = `Journey ${job.kind} ${ctx.input[0]}${ctx.width}`;
      let subject = null;
      if (job.subject) {
        subject = await inStore(ctx.page, ctx.kinds, (store, kinds) => {
          const nodes = store.graph.allNodes().filter((node) => (kinds === "*" ? true : kinds.includes(node.kind)));
          const node = nodes.find((one) => window.__journeyName(store, one)) ?? nodes[0];
          return node ? { id: node.id, label: window.__journeyName(store, node) ?? node.id } : null;
        }, job.subject.kinds);
        if (!subject) return { skip: `no ${job.subject.kinds} exists to make ${article(job.noun)} on` };
      }
      return { name, subject, values: await validValues(ctx, job.act, job.kind, name) };
    },
    start: (ctx) => ctx.home,
    async run(person, ctx, job, prep) {
      const page = person.page;
      const before = await inStore(page, ctx.kinds, (store, kind) => store.graph.allNodes().filter((node) => node.kind === kind).length, job.kind);
      if (ctx.face === "scene") {
        if (prep.subject) {
          // The record itself, not its copy in a lens drawn small as a picture, which is inert.
          const pick = page
            .locator(`[data-graview-pick="${escapeAttr(prep.subject.id)}"]:not([inert] *):not([aria-hidden="true"] *)`)
            .locator("visible=true")
            .first();
          if (await pick.isVisible().catch(() => false)) await person.press(pick, `"${prep.subject.label}"`);
          else await findAndOpen(person, "scene", prep.subject, partOf(prep.subject.label, ctx.labels));
          await pressAct(person, job.act, job.title);
        } else {
          await pressDistrict(person, job.kind, job.plural);
          try {
            await pressAct(person, job.act, job.title);
          } catch (error) {
            /*
             * Pressed from inside another place, a district can be raised
             * as a relation of it rather than chosen: the way a person
             * finds next is Up, to every kind at once, and the district
             * from there.
             */
            const up = page.locator('[data-testid="overview"][aria-pressed="false"]').locator("visible=true").first();
            if (!(error instanceof DeadEnd) || !(await up.isVisible().catch(() => false))) throw error;
            await person.press(up, "Up");
            await person.settle(400);
            await pressDistrict(person, job.kind, job.plural);
            await pressAct(person, job.act, job.title);
          }
        }
        await answerAsks(person, { name: prep.name, choose: [prep.subject?.label], values: prep.values });
      } else {
        await openKindPage(person, job.plural);
        const opener = page.getByRole("button", { name: new RegExp(`^${job.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( …)?$`) }).locator("visible=true").first();
        const form = page.locator(`form[data-testid="form-${job.act}"]`);
        if (!(await form.isVisible().catch(() => false))) {
          if (!(await appears(opener))) throw new DeadEnd(`the ${job.plural} page offers no "${job.title}"`);
          await person.press(opener, `"${job.title}"`);
        }
        if (!(await appears(form))) throw new DeadEnd(`"${job.title}" opens no form`);
        await fillForm(person, form, { name: prep.name, choose: [prep.subject?.label], values: prep.values });
      }
      await until(page, ctx.kinds, (store, { kind, name, before }) => {
        const made = store.graph.allNodes().filter((node) => node.kind === kind);
        if (made.some((node) => Object.values(node).includes(name))) return { ok: true };
        return made.length > before ? { ok: true } : { ok: false, why: `no ${kind} called "${name}" was made` };
      }, { kind: job.kind, name: prep.name, before }, "the record");
    },
  },

  find: {
    async prepare(ctx, job) {
      const target = await inStore(ctx.page, ctx.kinds, (store, kind) => {
        const nodes = store.graph.allNodes().filter((node) => node.kind === kind && window.__journeyName(store, node));
        const node = nodes[Math.floor(nodes.length / 2)];
        return node ? { id: node.id, label: window.__journeyName(store, node) } : null;
      }, job.kind);
      if (!target) return { skip: `there is no ${job.noun} to find` };
      target.noun = job.noun;
      const query = partOf(target.label, ctx.labels);
      return { target, query, more: anotherWord(target.label, ctx.labels, query) };
    },
    start: (ctx) => ctx.home,
    async run(person, ctx, job, prep) {
      await findAndOpen(person, ctx.face, prep.target, prep.query, prep.more);
      const page = person.page;
      const open = await page.evaluate((id) => {
        const hash = decodeURIComponent(location.hash);
        const path = decodeURIComponent(location.pathname);
        return hash.includes(`sel=${id}`) || hash.includes(`focus=${id}`) || path.endsWith(`/${id}`);
      }, prep.target.id);
      if (!open && person.twins > 1) {
        throw new DeadEnd(`Find shows ${person.twins} rows that read "${prep.target.label}" and nothing that says which is the ${job.noun}; the first is not`);
      }
      if (!open) throw new DeadEnd(`"${prep.target.label}" was found but is not what is open`);
    },
  },

  change: {
    async prepare(ctx, job) {
      const target = await inStore(ctx.page, ctx.kinds, (store, kind) => {
        const nodes = store.graph.allNodes().filter((node) => node.kind === kind && window.__journeyName(store, node));
        const node = nodes[0];
        return node ? { id: node.id, label: window.__journeyName(store, node) } : null;
      }, job.kind);
      if (!target) return { skip: `there is no ${job.noun} to change` };
      return { target, value: `${target.label} again` };
    },
    start: (ctx, _job, prep) => ctx.recordUrl(prep.target),
    async run(person, ctx, job, prep) {
      const page = person.page;
      // The name, drawn on its own record: pressed, it becomes the field that edits it.
      const where = ctx.face === "scene" ? page.locator(`[role="group"][aria-label="${escapeAttr(prep.target.label)}"]`).first() : page.locator("main").first();
      const name = where.getByRole("button", { name: prep.target.label, exact: true }).locator("visible=true").first();
      // The framework's field says which it is; an app's own design may only put the cursor in it.
      const field = page.locator(`[data-graview-field="${job.field}"]`).locator("visible=true").or(page.locator("input:focus, textarea:focus")).first();
      let via = null;
      if (await name.isVisible().catch(() => false)) {
        await person.press(name, "the record's name");
        if (!(await field.isVisible().catch(() => false))) via = "pressing the name opens nothing to change it with";
      } else {
        via = "the name is not something to press";
      }
      if (via === null) {
        if (!(await field.evaluate((el) => el === document.activeElement))) {
          if (person.input === "pointer") {
            await field.click();
            person.presses += 1;
          } else await person.reach(field, "the name's field");
        }
        await person.key(process.platform === "darwin" ? "Meta+A" : "Control+A");
        await person.type(prep.value);
        await person.key("Enter");
        await person.settle(250);
      } else {
        // The way round: the act that renames it, through its form.
        if (!job.act) throw new DeadEnd(`${via}, and no act renames it`);
        await pressAct(person, job.act, job.title);
        if (ctx.face === "scene") {
          await answerAsks(person, { name: prep.value });
        } else {
          const form = page.locator(`form[data-testid="form-${job.act}"]`);
          if (!(await appears(form))) throw new DeadEnd(`${via}, and "${job.title}" opens no form`);
          await fillForm(person, form, { name: prep.value });
        }
        via = `${via}; it takes "${job.title}"`;
      }
      await until(page, ctx.kinds, (store, { id, field, value }) => {
        const node = store.graph.getNode(id);
        return node?.[field] === value ? { ok: true } : { ok: false, why: `the name still reads "${node?.[field]}"` };
      }, { id: prep.target.id, field: job.field, value: prep.value }, "the change");
      return via ? { via } : undefined;
    },
  },

  relate: {
    async prepare(ctx, job) {
      const pair = await inStore(ctx.page, ctx.kinds, (store, job) => {
        const subjects = store.graph.allNodes().filter((node) => node.kind === job.kind);
        const others = store.graph.allNodes().filter((node) => job.otherKinds.includes("*") || job.otherKinds.includes(node.kind));
        const edges = store.graph.allEdges();
        const tied = (a, b) => edges.some((edge) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a));
        for (const subject of subjects) {
          for (const other of others) {
            // Two that are not tied yet: a tie that exists is not offered again.
            if (other.id === subject.id || tied(subject.id, other.id)) continue;
            const call = { name: job.act, args: { [job.subjectArg]: subject.id, [job.otherArg]: other.id } };
            try {
              if (!store.wouldChange(call)) continue;
              const preview = store.preview(call);
              if (preview && preview.ok === false) continue;
            } catch {
              continue;
            }
            return { subject: { id: subject.id, label: window.__journeyName(store, subject) ?? subject.id }, other: { id: other.id, label: window.__journeyName(store, other) ?? other.id } };
          }
        }
        return null;
      }, job);
      if (!pair) return { skip: `no ${job.noun} can be tied to anything with "${job.title}" in the example` };
      return pair;
    },
    start: (ctx, _job, prep) => ctx.recordUrl(prep.subject),
    async run(person, ctx, job, prep) {
      const page = person.page;
      const before = await inStore(page, ctx.kinds, lastBatch);
      /*
       * An app's own page may offer the tie in its own words — "June takes
       * on Plot 1" rather than "Name a caretaker" — and a person presses
       * the one that names who they mean.
       */
      const own = page.locator("main button").filter({ hasText: prep.other.label }).locator("visible=true").first();
      if (!(await actControl(page, job.act, job.title).first().isVisible().catch(() => false)) && (await own.isVisible().catch(() => false))) {
        await person.press(own, `"${(await own.textContent()).trim()}"`);
      } else if (ctx.face === "scene") {
        await pressAct(person, job.act, job.title);
        await answerAsks(person, { choose: [prep.other.label] });
      } else {
        const form = page.locator(`form[data-testid="form-${job.act}"]`);
        /*
         * A FORM THE PAGE ALREADY HOLDS OPEN is answered where it stands: a
         * page that draws every act's form (the garden's plot) was walked
         * as if its submit were the act, pressed empty, and then answered.
         */
        if (!(await form.first().isVisible().catch(() => false))) await pressAct(person, job.act, job.title);
        if (!(await appears(form))) throw new DeadEnd(`"${job.title}" opens no form`);
        await fillForm(person, form, { choose: [prep.other.label] });
      }
      await until(page, ctx.kinds, (store, { act, before }) => {
        const batches = store.batches();
        const made = batches.slice(before).some((batch) => !batch.undone && batch.ops.some((op) => op.mutation?.name === act));
        return made ? { ok: true } : { ok: false, why: `"${act}" was not applied` };
      }, { act: job.act, before }, "the tie");
    },
  },

  undo: {
    async prepare(ctx, job) {
      if (!job.field) return { skip: "nothing could be changed to take back" };
      // The kind's own name field — a talk has a title, not a label — so the change is the one the renamer makes.
      const node = await inStore(ctx.page, ctx.kinds, (store, { kind, field }) => {
        const one = store.graph.allNodes().find((node) => node.kind === kind && typeof node[field] === "string");
        return one ? { id: one.id, label: one[field] } : null;
      }, { kind: job.kind, field: job.field });
      if (!node) return { skip: "nothing could be changed to take back" };
      return { node };
    },
    start: (ctx) => ctx.home,
    /* The change to take back, made on the page the job starts on, as the seat sitting there. */
    async arrange(page, ctx, job, prep) {
      const made = await inStore(page, ctx.kinds, (store, { job, node }, seat) => {
        try {
          store.apply({ name: job.act, args: { [job.subjectArg]: node.id, [job.field]: `${node.label} for now` } }, { author: seat ?? { kind: "human" } });
        } catch (error) {
          return { error: String(error?.message ?? error) };
        }
        const batch = store.batches().at(-1);
        return { batch: batch.id, intent: batch.intent };
      }, { job, node: prep.node });
      if (made.error) return { skip: `the change to take back was refused: ${made.error}` };
      return made;
    },
    async run(person, ctx, _job, prep) {
      const page = person.page;
      /*
       * FROM THE KEYBOARD, THE KEY THE PAGE SAYS TAKES IT BACK. The offer
       * that comes with a change says ⌘Z or Ctrl+Z on its Take back
       * (`aria-keyshortcuts`); a keyboard person who reads it presses the
       * key, where the walk opened Activity at the far end of the bar — eight
       * to ten keys for the pointer's two. Not from inside a text field,
       * where the key is the field's own undo.
       */
      if (person.input === "keyboard") {
        // The offer comes in after the change lands; on a slow runner it is not drawn yet when the walk begins.
        const said = await page
          .waitForFunction(
            () => [...document.querySelectorAll("[aria-keyshortcuts]")].some((el) => el.getClientRects().length > 0 && /(^|\s)(Meta|Control)\+Z(\s|$)/.test(el.getAttribute("aria-keyshortcuts") ?? "")),
            undefined,
            { timeout: 3000 },
          )
          .then(() => true, () => false);
        if (said) {
          const before = person.presses;
          await person.key(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
          person.note("⌘Z", before);
          await person.settle(250);
          const taken = await inStore(page, ctx.kinds, (store, batch) => store.batches().find((one) => one.id === batch)?.undone === true, prep.batch);
          if (taken) return { via: "the key the offer says" };
        }
      }
      const opener = page.getByRole("button", { name: /^Activity$/ }).or(page.locator('[data-testid="activity-button"]')).locator("visible=true").first();
      if (ctx.face === "scene" && (await opener.isVisible().catch(() => false))) await person.press(opener, "Activity");
      const undo = page
        .locator('[data-testid="undo-turn"]')
        .or(page.getByRole("button", { name: /^(undo|take (it |this )?back)/i }))
        .locator("visible=true")
        .first();
      if (!(await appears(undo))) throw new DeadEnd(`nothing on the ${ctx.face === "scene" ? "scene" : "page"} offers to take "${prep.intent}" back`);
      await person.press(undo, "undo");
      await until(page, ctx.kinds, (store, batch) => {
        const it = store.batches().find((one) => one.id === batch);
        return it?.undone ? { ok: true } : { ok: false, why: "the change is still there after pressing undo" };
      }, prep.batch, "the undo");
    },
  },

  several: {
    async prepare(ctx, job) {
      const ids = await inStore(ctx.page, ctx.kinds, (store, { kind, act, arg }) => store.graph.allNodes().filter((node) => node.kind === kind && store.wouldChange({ name: act, args: { [arg]: node.id } })).map((node) => node.id), { kind: job.kind, act: job.act, arg: job.subjectArg });
      if (!Array.isArray(ids) || ids.length < 3) return { skip: `fewer than three ${job.plural.toLowerCase()} that "${job.title}" would change` };
      return { ids };
    },
    start: (ctx) => ctx.home,
    // Chosen from a list: the pages' list of the kind. The scene's own lists (a kind's stop) are walked by verify-kind-stop.
    async arrange(_page, ctx) {
      return ctx.face === "scene" ? { skip: "several are chosen from a kind's list, on the pages" } : {};
    },
    async run(person, ctx, job, prep) {
      const page = person.page;
      await openKindPage(person, job.plural);
      // Three of the list's own rows the act would change, in the order the list draws them.
      const drawn = (ids) => [...document.querySelectorAll("[data-graview-choose]")].map((row) => row.getAttribute("data-graview-choose")).filter((id) => ids.includes(id));
      /*
       * Once the list has drawn them: two thousand talks take a moment on a
       * throttled runner, and a look taken as the page arrived found fewer
       * than three of them.
       */
      await page.waitForFunction(({ ids, source }) => new Function(`return (${source})`)()(ids).length >= 3, { ids: prep.ids, source: drawn.toString() }, { timeout: PATIENCE }).catch(() => undefined);
      const rows = await page.evaluate(drawn, prep.ids);
      if (rows.length === 0 && (await page.locator("[data-graview-choose]").count()) === 0) throw new DeadEnd(`the ${job.plural} page offers no way to choose several`);
      if (rows.length < 3) throw new DeadEnd(`the ${job.plural} page shows fewer than three that "${job.title}" would change`);
      const chosen = rows.slice(0, 3);
      const before = await inStore(page, ctx.kinds, (store) => store.batches().length);
      // What the first box cost from the keyboard, and whether the list's own skip was the way (`theKeyboardSkipsIntoALongList`).
      let firstBox;
      for (const [at, id] of chosen.entries()) {
        const box = page.locator(`[data-graview-choose-box="${escapeAttr(id)}"]`).first();
        if (person.input === "pointer") {
          await box.hover().catch(() => undefined);
          await person.press(box, `the box of the ${at === 0 ? "first" : at === 1 ? "second" : "third"}`);
        } else {
          const pressed = person.presses;
          const on = () => box.evaluate((el) => el === document.activeElement).catch(() => false);
          if (at === 0) {
            const skipped = person.skipped?.length ?? 0;
            await person.reach(box, "a row's box");
            firstBox = { presses: person.presses - pressed, skip: person.skipped?.[skipped] ?? null };
          } else {
            // The boxes are one Tab stop: the arrows go from the last one chosen to the next.
            for (let step = 0; step < 200 && !(await on()); step++) await person.key("ArrowDown");
            if (!(await on())) throw new DeadEnd(`the arrows do not reach the ${at === 1 ? "second" : "third"} row's box`);
          }
          await person.key("Space");
          person.note(at === 0 ? "a row's box, and Space" : "the arrows to a row's box, and Space", pressed);
          await person.settle();
        }
      }
      const said = await page.locator('[data-testid="several-count"]').textContent({ timeout: 4_000 }).catch(() => null);
      if (!said || !said.startsWith("3 ")) throw new DeadEnd(`choosing three ${job.plural.toLowerCase()} said ${said ? `"${said}"` : "nothing"}`);
      const act = page.locator(`[data-testid="several-bar"] [data-mutation="${escapeAttr(job.act)}"]`);
      if (!(await act.first().isVisible().catch(() => false))) {
        const more = page.locator('[data-testid="several-more"]');
        if (await more.isVisible().catch(() => false)) await person.press(more, '"More"');
      }
      if (!(await appears(act.first()))) throw new DeadEnd(`the bar over three ${job.plural.toLowerCase()} offers no "${job.title}"`);
      await person.press(act, `"${job.title}"`);
      await until(page, ctx.kinds, (store, { before, chosen, act, arg }) => {
        const batches = store.batches();
        if (batches.length !== before + 1) return { ok: false, why: `"${act}" over three was ${batches.length - before} changes, not one` };
        const left = chosen.filter((id) => store.wouldChange({ name: act, args: { [arg]: id } }));
        return left.length === 0 ? { ok: true } : { ok: false, why: `${left.length} of the three were not changed` };
      }, { before, chosen, act: job.act, arg: job.subjectArg }, "the change to all three");
      return firstBox ? { firstBox } : undefined;
    },
  },

  repair: {
    async prepare(ctx) {
      const broken = await inStore(ctx.page, ctx.kinds, (store) => {
        const violations = store.violations();
        const one = violations.find((violation) => (violation.repairs ?? []).length > 0);
        return one ? { invariant: one.invariant, message: one.message, repairs: one.repairs.map((repair) => repair.mutation), count: violations.length } : null;
      });
      if (!broken) return { skip: "nothing is broken in the example" };
      return broken;
    },
    start: (ctx) => ctx.home,
    async run(person, ctx, _job, prep) {
      const page = person.page;
      const before = await inStore(page, ctx.kinds, lastBatch);
      if (ctx.face === "scene") {
        const standing = page.locator('[data-testid="standing"]').locator("visible=true").first();
        if (!(await appears(standing))) throw new DeadEnd("nothing on the scene says something is wrong");
        // From the keyboard, the skip that says so, where the page offers one; else the standing itself.
        if (!(await person.pressSkip("problems", "the skip to the problems"))) await person.press(standing, "the problems");
        const problem = page.locator('[data-testid="standing"] ~ ul button, [data-testid="standing"] + * button, [data-testid="standing-card"] button').locator("visible=true").first();
        const listed = (await problem.isVisible().catch(() => false)) ? problem : page.getByRole("listitem").getByRole("button", { name: /ways? to fix|to fix/ }).locator("visible=true").first();
        await person.press(listed, "the problem");
        await person.settle(300);
        const repair = page.locator('[data-affordance^="invariant:"]').locator("visible=true").first();
        await revealActs(person, repair);
        await person.press(page.locator('[data-affordance^="invariant:"]').locator("visible=true").first(), "its repair");
        await answerAsks(person, { name: "Somebody" });
      } else {
        const link = page.locator('a[href$="/problems"]').locator("visible=true").first();
        if (!(await person.pressSkip("problems", "the skip to the problems"))) {
          if (!(await link.isVisible().catch(() => false))) {
            const menu = page.getByRole("button", { name: /every place|more (place|picture)|menu|sections|kinds|navigation/i }).first();
            if (await menu.isVisible().catch(() => false)) await person.press(menu, "the menu");
          }
          await person.press(page.locator('a[href$="/problems"]').locator("visible=true").first(), "the Problems link");
        }
        await page.waitForLoadState("domcontentloaded");
        await person.settle(300);
        const repair = page.locator('[data-testid="repairs"] button, [data-affordance^="invariant:"]').locator("visible=true").first();
        if (!(await appears(repair))) throw new DeadEnd("the problems page offers no repair to press");
        await person.press(repair, "a repair");
        const form = page.locator("form[data-testid^='form-']").locator("visible=true").first();
        if (await form.isVisible().catch(() => false)) await fillForm(person, form, { name: "Somebody" });
      }
      await until(page, ctx.kinds, (store, { before, repairs }) => {
        const applied = store.batches().slice(before).some((batch) => batch.ops.some((op) => repairs.includes(op.mutation?.name)));
        return applied ? { ok: true } : { ok: false, why: "no repair was applied" };
      }, { before, repairs: prep.repairs }, "the repair", 3_000);
    },
  },

  refused: {
    async prepare(ctx) {
      // The seat, chosen by `chooseRefusal` from the seats the bar offers, sits down from the address (`?as=`).
      if (!ctx.refusal) return { skip: ctx.refusalWhy ?? "no seat is refused anything it can see" };
      return ctx.refusal;
    },
    start: (ctx, _job, prep) => (prep.subject ? ctx.recordUrl(prep.subject, { as: prep.seat }) : ctx.homeAs({ as: prep.seat })),
    async arrange(page, _ctx, _job, prep) {
      const seat = await page.evaluate(() => window.__journeySeat?.id ?? null);
      return seat === prep.seat ? prep : { skip: `the app did not sit ${prep.seat} down from the address` };
    },
    async run(person, ctx, _job, prep) {
      const page = person.page;
      const before = await inStore(page, ctx.kinds, lastBatch);
      if (ctx.face === "scene" && !prep.subject) {
        /*
         * FROM THE KEYBOARD, BY NAME, as narrowing goes: "/", the kind's
         * name, Enter, and the keyboard is in the district, whose own key
         * opens its acts and says what is withheld — where a Tab walk across
         * every district before it cost eleven keys for the pointer's two.
         */
        await (person.input === "keyboard" ? goByFind(person, prep.kind, prep.plural) : pressDistrict(person, prep.kind, prep.plural)).catch(() => {});
      }
      if (ctx.face === "pages" && !prep.subject) await openKindPage(person, prep.plural).catch(() => {});
      if (ctx.face === "scene") await openActs(person);
      /*
       * Pressed from inside another place, a district is raised as a relation
       * of it rather than chosen, and nothing is open: a person goes Up, to
       * every kind at once, and presses the district there — as making one
       * does (the rota's viewer, carried from the eighth walk to the tenth).
       */
      if (ctx.face === "scene" && !prep.subject && !(await page.locator('[data-testid="context-menu"]').first().isVisible().catch(() => false))) {
        const up = page.locator('[data-testid="overview"][aria-pressed="false"]').locator("visible=true").first();
        if (await up.isVisible().catch(() => false)) {
          await person.press(up, "Up");
          await person.settle(400);
          await pressDistrict(person, prep.kind, prep.plural).catch(() => {});
          await openActs(person);
        }
      }
      const said = async () =>
        page.evaluate((title) => {
          const visible = (el) => el.getClientRects().length > 0;
          const lower = title.toLowerCase();
          const disabled = [...document.querySelectorAll("button[disabled], [aria-disabled='true']")].some((el) => visible(el) && (el.textContent ?? "").toLowerCase().includes(lower));
          // A sentence that names the act and says it is not this seat's.
          const sentence = [...document.querySelectorAll("[data-testid='withheld'], [data-testid='withheld-why'], [data-testid='refused'], [role='note'], li, p, span")].some(
            (el) => visible(el) && (el.textContent ?? "").toLowerCase().includes(lower) && /not (permitted|yours|allowed)|may not|can(no|['’])t/i.test(el.textContent ?? ""),
          );
          return disabled || sentence;
        }, prep.title);
      // Given the time a slow page takes to say it, like any control (see `appears`).
      const saidSoon = async (ms = Number(process.env["GRAVIEW_JOURNEYS_PATIENCE"] ?? 10_000)) => {
        for (const end = Date.now() + ms; Date.now() < end; await page.waitForTimeout(250)) if (await said()) return true;
        return said();
      };
      if (await saidSoon(3_000)) return;
      const more = page.locator('[data-testid="withheld-more"]').locator("visible=true").first();
      if (await appears(more, 3_000)) {
        await person.press(more, "what is withheld");
        if (await saidSoon()) return;
      }
      const offered = actControl(page, prep.act, prep.title).locator("visible=true").first();
      if (await offered.isVisible().catch(() => false)) {
        if (await offered.isDisabled().catch(() => false)) return;
        await person.press(offered, `"${prep.title}"`);
        await answerAsks(person, { name: "Not mine" }).catch(() => {});
        const applied = await inStore(page, ctx.kinds, (store, before) => store.batches().length > before, before);
        throw new DeadEnd(applied ? `"${prep.title}" was offered to and applied by a seat the policy refuses` : `"${prep.title}" is offered to ${prep.seatLabel}, and refused only after the press`);
      }
      throw new DeadEnd(`"${prep.title}" is not offered to ${prep.seatLabel}, and nothing says it is not theirs`);
    },
  },
};

/* ------------------------------------------------------------------ */
/* Reading the verdict                                                 */
/* ------------------------------------------------------------------ */

export const VARIANTS = [];
for (const face of ["scene", "pages"]) for (const width of [1440, 390]) for (const input of ["pointer", "keyboard"]) VARIANTS.push({ face, width, input });

export const variantKey = ({ face, width, input }) => `${face}/${width}/${input}`;
const say = {
  face: { scene: "on the scene", pages: "on the pages" },
  width: { 1440: "on a laptop", 390: "on a phone" },
  input: { pointer: "with the pointer", keyboard: "from the keyboard" },
};
const sayVariant = (key) => {
  const [face, width, input] = key.split("/");
  return `${say.face[face]} ${say.width[width]} ${say.input[input]}`;
};
const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

/** Several ways at once, said as few: "on the pages, at either width and with either hand". */
function sayKeys(keys, total) {
  if (keys.length === total) return "in every face, width and input";
  const parts = [];
  for (const face of ["scene", "pages"]) {
    let mine = keys.filter((key) => key.startsWith(`${face}/`)).map((key) => key.split("/"));
    if (mine.length === 0) continue;
    if (mine.length === 4) {
      parts.push(`${say.face[face]}, at either width and with either hand`);
      continue;
    }
    for (const input of ["pointer", "keyboard"]) {
      const both = mine.filter(([, , one]) => one === input);
      if (both.length === 2) {
        parts.push(`${say.face[face]} ${say.input[input]}, at either width`);
        mine = mine.filter(([, , one]) => one !== input);
      }
    }
    for (const width of ["1440", "390"]) {
      const both = mine.filter(([, one]) => one === width);
      if (both.length === 2) parts.push(`${say.face[face]} ${say.width[width]}, with either hand`);
      else if (both.length === 1) parts.push(sayVariant(both[0].join("/")));
    }
  }
  return parts.join("; ");
}

/**
 * THE FRICTION, ranked by what it costs a person: a job that cannot be done
 * at all, then one done with a rule broken on the way, then one that costs
 * far more presses than the cheapest way anybody found to do the same job.
 */
export function frictionOf(report) {
  const items = [];
  for (const [app, result] of Object.entries(report.apps)) {
    for (const [jobId, job] of Object.entries(result.jobs ?? {})) {
      const runs = Object.entries(job.runs ?? {}).filter(([, run]) => !run.skipped);
      if (runs.length === 0) continue;
      const done = runs.filter(([, run]) => run.done);
      const cheapest = done.length ? Math.min(...done.map(([, run]) => run.presses)) : null;
      const cheapestKey = done.find(([, run]) => run.presses === cheapest)?.[0];
      // Not done: grouped by where it dead-ended, so one cause reads as one item.
      const failed = runs.filter(([, run]) => !run.done);
      const byCause = new Map();
      for (const [key, run] of failed) {
        const cause = run.deadEnd ?? "it did not finish";
        byCause.set(cause, [...(byCause.get(cause) ?? []), key]);
      }
      for (const [cause, keys] of byCause) {
        const where = sayKeys(keys, runs.length);
        items.push({
          app, job: jobId, rank: 0, weight: keys.length,
          says: `${app}: ${job.says} cannot be done ${where} — ${cause}.`,
        });
      }
      // Done, but a rule every screen holds broke on the way, or only the long way round: one item per cause.
      const byViolation = new Map();
      const byWay = new Map();
      for (const [key, run] of done) {
        for (const violation of run.violations) {
          const cause = `${violation.rule}: ${violation.detail}`;
          byViolation.set(cause, [...(byViolation.get(cause) ?? []), key]);
        }
        if (run.via) byWay.set(run.via, [...(byWay.get(run.via) ?? []), key]);
      }
      const across = (keys) => sayKeys(keys, runs.length);
      for (const [cause, keys] of byViolation) {
        items.push({ app, job: jobId, rank: 1, weight: keys.length, says: `${app}: ${job.says} works but breaks ${cause} — ${across(keys)}.` });
      }
      for (const [way, keys] of byWay) {
        items.push({ app, job: jobId, rank: 1, weight: keys.length, says: `${app}: ${job.says} works only the long way round — ${way} — ${across(keys)}.` });
      }
      for (const [key, run] of done) {
        if (cheapest !== null && run.presses >= cheapest * 2 && run.presses - cheapest >= 4) {
          items.push({
            app, job: jobId, rank: 2, weight: run.presses / Math.max(1, cheapest),
            says: `${app}: ${job.says} ${sayVariant(key)} takes ${run.presses} presses; ${sayVariant(cheapestKey)}, ${cheapest}.`,
          });
        }
      }
    }
  }
  items.sort((a, b) => a.rank - b.rank || b.weight - a.weight);
  return items.map(({ app, job, says }) => ({ app, job, says: says.replace(/: (\w)/, (m, c) => `: ${c.toUpperCase()}`) }));
}

/**
 * WHAT GOT WORSE since the verdict committed last: a job that was done and
 * now is not, or that costs more than 30% more presses than it did.
 */
export function regressionsOf(previous, current) {
  /*
   * AN APP THAT COULD NOT BE SET UP IS NOT "NO REGRESSIONS". It has no
   * runs to compare, so the loop below passed over it, and a harness that
   * threw before it walked anything — every app, for a week — said green.
   */
  const unwalked = Object.entries(current.apps)
    .filter(([, result]) => result.failed)
    .map(([app, result]) => `${app}: Not one job was walked — it ${result.failed}.`);
  if (!previous?.apps) return unwalked;
  const found = [];
  for (const [app, result] of Object.entries(current.apps)) {
    for (const [jobId, job] of Object.entries(result.jobs ?? {})) {
      for (const [key, run] of Object.entries(job.runs ?? {})) {
        const was = previous.apps[app]?.jobs?.[jobId]?.runs?.[key];
        if (!was || was.skipped || run.skipped) continue;
        if (was.done && !run.done) {
          found.push(`${app}: ${job.says} ${sayVariant(key)} was done and now is not — ${run.deadEnd ?? "it did not finish"}.`);
        } else if (was.done && run.done && run.presses > was.presses * 1.3 && run.presses - was.presses >= 2) {
          // (Two presses at least: one more on a two-press job is 50%, and not a regression anybody would feel.)
          found.push(`${app}: ${job.says} ${sayVariant(key)} took ${was.presses} presses and now takes ${run.presses}.`);
        }
      }
    }
  }
  return [...unwalked, ...found.map((line) => line.replace(/: (\w)/, (m, c) => `: ${c.toUpperCase()}`))];
}

/**
 * WHY THE KEYBOARD COSTS MORE THAN TWICE THE POINTER, where it still does —
 * by job, by job on one face, and by job on one face in one app ("<app>
 * <job>/<face>") where it is that app's own design — said as a reader would
 * be told it. A job named here may cost the keyboard more than twice the
 * pointer's presses; any other is held to twice (`keyboardChecks`). What a
 * skip, a group that is one stop, or a key could take off has been taken
 * off (walks XI and XII, and the acts made one stop, an act's form opened at
 * what it asks, ⌘Z said on the scene's offer, a district reached by its name
 * — 0.1.45); what is left is the shape of the page.
 */
export const KEYBOARD_WHY = {
  make: "a form is answered field by field: the pointer goes straight to each field it needs, and the keyboard passes the ones it does not, and crosses the bar to the act that opens it",
  "find/pages": "Find on the pages answers on a page of its own: the keyboard goes on from the box past the bar's tools to the row, where the pointer presses the row it reads",
  "seedbed relate/pages": "the garden's plot page draws every act's form open, as its chapter shows: the caretaker's choice is a field among the sowing's above it, Tabbed past in turn, where the pointer presses the one it wants",
  "discography relate/pages": "two of a song's acts begin with P (\"Place it in an era\", \"Put it on a release\"), so the letter is pressed twice among its one stop of acts, and a choice is sent by its button: one key over twice the pointer's four",
  narrow: "a kind's list is a place on the bar, reached across it, and its \"Filter\" stands after the list's own chips; the pointer presses each where it is drawn",
  "several/pages": "a kind's list is a place on the bar, reached across it; into the records is one skip, and the boxes are one stop",
  "repair/pages": "the problems are a page of their own, their count a tool at the bar's far end, crossed to before the page's repair, where the pointer presses the count and the repair; a repair's question, opened, has the keyboard in it",
  "refused/scene": "a record chosen from the address is where the pointer right-clicks it, and its menu says what is withheld; the keyboard first skips to the chosen card, then presses its acts' key — three for one",
  "refused/pages": "a kind's list is a place on the bar, reached across it, where the pointer presses its name and reads what is withheld",
};

const jobKind = (jobId) => (jobId.startsWith("make-") ? "make" : jobId);

/** Why a job on a face, in an app, may cost the keyboard more than twice the pointer, or null where it may not. */
export function keyboardWhy(jobId, face, app) {
  const job = jobKind(jobId);
  return (app !== undefined ? KEYBOARD_WHY[`${app} ${job}/${face}`] : undefined) ?? KEYBOARD_WHY[`${job}/${face}`] ?? KEYBOARD_WHY[job] ?? null;
}

/**
 * THE KEYBOARD'S CLAIMS, from the verdict.
 *
 * `theKeyboardCostsAtMostTwiceThePointer`: every job done both ways, on each
 * face and at each width, costs the keyboard at most twice the pointer's
 * presses — or its job is named in `KEYBOARD_WHY`, and the verdict says why.
 *
 * `theKeyboardSkipsIntoALongList`: wherever several records are chosen from
 * a list on the pages, the keyboard's way to the first box is the list's own
 * skip, at most five presses from the list's heading.
 */
export function keyboardChecks(report) {
  const within = [];
  const named = new Map();
  const unnamed = [];
  const lists = [];
  for (const [app, result] of Object.entries(report.apps)) {
    for (const [jobId, job] of Object.entries(result.jobs ?? {})) {
      for (const face of ["scene", "pages"]) {
        for (const width of ["1440", "390"]) {
          const pointer = job.runs?.[`${face}/${width}/pointer`];
          const keyboard = job.runs?.[`${face}/${width}/keyboard`];
          if (jobKind(jobId) === "several" && face === "pages" && keyboard?.done) lists.push({ app, width: Number(width), firstBox: keyboard.firstBox ?? null });
          if (!pointer?.done || !keyboard?.done) continue;
          const said = `${app} ${jobId} ${face}/${width}: ${keyboard.presses} by keyboard, ${pointer.presses} by pointer`;
          if (keyboard.presses <= Math.max(1, pointer.presses) * 2) {
            within.push(said);
            continue;
          }
          const why = keyboardWhy(jobId, face, app);
          if (why) named.set(why, [...(named.get(why) ?? []), said]);
          else unnamed.push(said);
        }
      }
    }
  }
  const skipped = lists.filter((one) => one.firstBox?.skip === "records" && one.firstBox.presses <= 5);
  return {
    theKeyboardCostsAtMostTwiceThePointer: {
      ok: unnamed.length === 0 && within.length + named.size > 0,
      within: within.length,
      unnamed,
      named: [...named].map(([why, runs]) => ({ why, runs })),
    },
    theKeyboardSkipsIntoALongList: { ok: skipped.length === lists.length, lists },
  };
}

export { lower };
