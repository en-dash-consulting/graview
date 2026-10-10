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
  const core = await import(pathToFileURL(require.resolve("@graview/core")).href);
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
  return [...apps.filter((one) => asked.includes(one.dir) || (asked.length === 0 && beside.length === 0)), ...beside];
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
  const relating = declared
    .filter((mutation) => mutation.subject && !(mutation.creates ?? []).length)
    .map((mutation) => ({ mutation, others: core.nodeRefArgs(mutation.input).filter((ref) => ref.name !== mutation.subject.arg && !ref.optional) }))
    .filter(({ others }) => others.length === 1)
    // Ties are adds; the act that takes one away is the other half, and an "un-" act needs a tie to exist.
    .filter(({ mutation }) => !/^(un|stop-|take-off|drop|remove)/.test(mutation.name));
  const relate = relating.find(({ mutation }) => mutation.subject.kinds?.includes?.(primary)) ?? relating[0];
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
  watch.store = (store) => {
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
const appears = (locator, ms = Number(process.env["GRAVIEW_JOURNEYS_PATIENCE"] ?? 10_000)) =>
  locator
    .waitFor({ state: "visible", timeout: ms })
    .then(() => true)
    .catch(() => false);

export class DeadEnd extends Error {}

const onMarked = (page) =>
  page.evaluate(() => {
    const target = document.querySelector("[data-journey-target]");
    const active = document.activeElement;
    // The control itself: a district holds controls of its own, and landing on one of those is somewhere else.
    return !!target && active === target;
  });

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

  /** The keyboard to this control, by Tab or Shift+Tab, whichever is shorter. */
  async reach(locator, what) {
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
    const onTarget = async (page) => (await mark()) && onMarked(page);
    if (!(await mark())) throw new DeadEnd(`${what} is not on the screen`);
    if (await onTarget(this.page)) return;
    /*
     * HOW FAR IT REALLY IS, found by pressing rather than computed: the
     * browser's Tab order is not the document's (a scroller takes focus, a
     * lens's inert copy does not), and a guess that walked the wrong way
     * counted presses nobody would make. The walk forward is a probe; where
     * the keyboard started on a control, the walk back from it is tried
     * too, and the person is charged the shorter.
     */
    const LIMIT = 220;
    const page = this.page;
    const started = await page.evaluate(() => {
      for (const old of document.querySelectorAll("[data-journey-start]")) old.removeAttribute("data-journey-start");
      const at = document.activeElement;
      if (!at || at === document.body || at === document.documentElement) return false;
      at.setAttribute("data-journey-start", "");
      return true;
    });
    let forward = -1;
    for (let i = 1; i <= LIMIT; i++) {
      await page.keyboard.press("Tab");
      if (await onTarget(page)) {
        forward = i;
        break;
      }
    }
    let charged = forward;
    {
      const ceiling = forward < 0 ? LIMIT : forward - 1;
      await page.evaluate((started) => {
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
      let backward = -1;
      for (let i = 1; i <= ceiling; i++) {
        await page.keyboard.press("Shift+Tab");
        if (await onTarget(page)) {
          backward = i;
          break;
        }
      }
      if (backward > 0) charged = backward;
      else if (forward > 0) await page.evaluate(() => document.querySelector("[data-journey-target]")?.focus());
    }
    if (charged < 0) throw new DeadEnd(`the keyboard cannot reach ${what} in ${LIMIT} presses of Tab`);
    this.presses += charged;
  }

  /** Activate a control the way this person does. */
  async press(locator, what) {
    const before = this.presses;
    const target = locator.first();
    if (!(await appears(target))) throw new DeadEnd(`${what} is not on the screen`);
    if (this.input === "pointer") {
      await target.click({ timeout: 4_000 }).catch((error) => {
        throw new DeadEnd(`${what} cannot be pressed (${String(error.message).split("\n")[0].slice(0, 90)})`);
      });
      this.presses += 1;
    } else {
      await this.reach(target, what);
      await this.key("Enter");
    }
    this.note(what, before);
    await this.settle();
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
      await target.click({ timeout: 4_000 });
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
      await entry.click({ timeout: 4_000 });
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
      await select.click({ timeout: 4_000 });
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
    if (!(await chosen.isVisible().catch(() => false))) return;
    await chosen.click({ button: "right", timeout: 4_000 }).catch(() => {});
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
    const field = ask.locator("form input").first();
    if (await field.isVisible().catch(() => false)) {
      const type = await field.getAttribute("type");
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
      return { tag: el.tagName.toLowerCase(), type: el.type, name: el.name, label, required: el.required || /\*/.test(label), value: el.value };
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
    // A narrow scene folds the districts it has no room for into a menu.
    const more = page.getByRole("button", { name: /^\+\d+ more$/ }).first();
    if (await more.isVisible().catch(() => false)) await person.press(more, "the folded districts");
    const item = page.getByRole("menuitem", { name: new RegExp(`^${plural}(?!\\p{L})`, "u") }).first();
    if (await item.isVisible().catch(() => false)) {
      await person.press(item, `${plural} in the menu`);
      await person.settle(400);
      if (!(await district.isVisible().catch(() => false))) return;
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
    const menu = page.getByRole("button", { name: /menu|sections|kinds|navigation/i }).first();
    if (await menu.isVisible().catch(() => false)) await person.press(menu, "the menu");
  }
  const visible = link.filter({ visible: true });
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
  const heading = page.getByRole("heading", { level: 1, name: new RegExp(`^\\s*${plural}(?!\\p{L})`, "u") });
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
  if (face === "scene" && person.input === "keyboard") {
    // The box says its own keys (`aria-keyshortcuts`: "/" and ⌘K); a keyboard person uses one.
    await person.key("/");
    await person.settle(100);
    if (await box.first().evaluate((el) => el === document.activeElement).catch(() => false)) return box.first();
  }
  let shown = box.filter({ visible: true }).first();
  if (!(await shown.isVisible().catch(() => false))) {
    const opener = page.locator('[data-testid="nav-find"]').or(page.getByRole("button", { name: /^(find|search)/i })).first();
    if (await opener.isVisible().catch(() => false)) await person.press(opener, "the way to Find");
    shown = box.filter({ visible: true }).first();
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

/** Find a record by part of its name and open it. Returns once it is open. */
async function findAndOpen(person, face, target, query) {
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
    const index = (saysNoun && reading.find((at) => saysNoun.test(texts[at]))) ?? reading[0];
    // Rows that read the same: a person cannot tell which is which, and takes the first.
    person.twins = texts.filter((text) => text.trim() === texts[index].trim()).length;
    if (person.input === "pointer") {
      await hits.nth(index).click();
      person.presses += 1;
    } else {
      // Arrowed to, watching the highlight move as a person does, until the row wanted is the one lit.
      const wanted = await hits.nth(index).evaluate((el) => el.id || el.closest("[id]")?.id || "");
      const lit = () => page.locator('[data-testid="find-box"]').getAttribute("aria-activedescendant");
      // A highlighted record opens its acts under it, so the rows grow as the keys move: the bound is the rows there are now.
      const rowsNow = () => page.locator('[data-testid="find-hit"]').count();
      for (let i = 0; i < (await rowsNow()) + 2 && index > 0 && (await lit()) !== wanted; i++) await person.key("ArrowDown");
      if ((await lit()) !== wanted) throw new DeadEnd(`the keys do not reach "${target.label}" in the Find strip`);
      await person.key("Enter");
    }
    await person.settle(500);
    return;
  }
  await person.key("Enter");
  await page.waitForLoadState("domcontentloaded");
  await person.settle(450);
  const link = page.locator(`main a[href$="/${encodeURIComponent(target.id)}"], main a[href$="/${target.id}"]`).filter({ visible: true }).first();
  if (!(await appears(link))) throw new DeadEnd(`the search page does not link "${target.label}" for "${query}"`);
  await person.press(link, `"${target.label}"`);
  await page.waitForLoadState("domcontentloaded");
  await person.settle(300);
}

/** A word of the record's name that is its own, to search by. */
function partOf(label, others) {
  const words = label.split(/[^\p{L}\p{N}']+/u).filter((word) => word.length >= 4);
  const own = words.filter((word) => others.filter((other) => other.toLowerCase().includes(word.toLowerCase())).length === 1);
  return (own.sort((a, b) => b.length - a.length)[0] ?? words.sort((a, b) => b.length - a.length)[0] ?? label).toLowerCase();
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
    async prepare() {
      return {};
    },
    start: (ctx) => ctx.home,
    async run(person, ctx, job) {
      const page = person.page;
      if (ctx.face === "pages") await openKindPage(person, job.plural);
      else {
        await pressDistrict(person, job.kind, job.plural);
        await person.settle(300);
        // The list arranges where the kind is drawn whole: down into its district.
        const down = page.locator('[data-testid="overview"][aria-pressed="true"]').filter({ visible: true }).first();
        if (!(await page.locator('button[data-testid$="-add"], button[data-testid$="-all"]').filter({ visible: true }).first().isVisible().catch(() => false)) && (await down.isVisible().catch(() => false))) {
          await person.press(down, `Down to ${job.plural}`);
          await person.settle(600);
        }
      }
      // "Filter" on the arranging line, or — where the line is narrow — the one "Arrange" that holds it.
      const filter = page.locator('button[data-testid$="-add"], button[data-testid$="-all"]').filter({ visible: true }).first();
      if (!(await appears(filter))) throw new DeadEnd(`there is no "Filter" to narrow the ${job.plural.toLowerCase()} with`);
      await person.press(filter, '"Filter"');
      const entry = page.locator(`[data-testid="arrange-list"] [data-value^="${job.field}:at-most:"]`).first();
      if (!(await appears(entry))) throw new DeadEnd(`"Filter" offers no ${job.label.toLowerCase()} to narrow the ${job.plural.toLowerCase()} by`);
      const option = (await entry.textContent())?.trim() ?? job.label;
      await person.pick(entry, `"${option}"`);
      await person.settle(300);
      const chip = page.locator('[data-testid$="-condition"]').filter({ hasText: job.label }).filter({ visible: true }).first();
      if (!(await appears(chip, 3_000))) throw new DeadEnd(`choosing "${option}" did not narrow the ${job.plural.toLowerCase()}`);
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
            .filter({ visible: true })
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
            const up = page.locator('[data-testid="overview"][aria-pressed="false"]').filter({ visible: true }).first();
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
        const opener = page.getByRole("button", { name: new RegExp(`^${job.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( …)?$`) }).filter({ visible: true }).first();
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
      return { target, query: partOf(target.label, ctx.labels) };
    },
    start: (ctx) => ctx.home,
    async run(person, ctx, job, prep) {
      await findAndOpen(person, ctx.face, prep.target, prep.query);
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
      const name = where.getByRole("button", { name: prep.target.label, exact: true }).filter({ visible: true }).first();
      // The framework's field says which it is; an app's own design may only put the cursor in it.
      const field = page.locator(`[data-graview-field="${job.field}"]`).filter({ visible: true }).or(page.locator("input:focus, textarea:focus")).first();
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
      const own = page.locator("main button").filter({ hasText: prep.other.label }).filter({ visible: true }).first();
      if (!(await actControl(page, job.act, job.title).first().isVisible().catch(() => false)) && (await own.isVisible().catch(() => false))) {
        await person.press(own, `"${(await own.textContent()).trim()}"`);
      } else if (ctx.face === "scene") {
        await pressAct(person, job.act, job.title);
        await answerAsks(person, { choose: [prep.other.label] });
      } else {
        await pressAct(person, job.act, job.title);
        const form = page.locator(`form[data-testid="form-${job.act}"]`);
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
      const opener = page.getByRole("button", { name: /^Activity$/ }).or(page.locator('[data-testid="activity-button"]')).filter({ visible: true }).first();
      if (ctx.face === "scene" && (await opener.isVisible().catch(() => false))) await person.press(opener, "Activity");
      const undo = page
        .locator('[data-testid="undo-turn"]')
        .or(page.getByRole("button", { name: /^(undo|take (it |this )?back)/i }))
        .filter({ visible: true })
        .first();
      if (!(await appears(undo))) throw new DeadEnd(`nothing on the ${ctx.face === "scene" ? "scene" : "page"} offers to take "${prep.intent}" back`);
      await person.press(undo, "undo");
      await until(page, ctx.kinds, (store, batch) => {
        const it = store.batches().find((one) => one.id === batch);
        return it?.undone ? { ok: true } : { ok: false, why: "the change is still there after pressing undo" };
      }, prep.batch, "the undo");
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
        const standing = page.locator('[data-testid="standing"]').filter({ visible: true }).first();
        if (!(await appears(standing))) throw new DeadEnd("nothing on the scene says something is wrong");
        await person.press(standing, "the problems");
        const problem = page.locator('[data-testid="standing"] ~ ul button, [data-testid="standing"] + * button, [data-testid="standing-card"] button').filter({ visible: true }).first();
        const listed = (await problem.isVisible().catch(() => false)) ? problem : page.getByRole("listitem").getByRole("button", { name: /ways? to fix|to fix/ }).filter({ visible: true }).first();
        await person.press(listed, "the problem");
        await person.settle(300);
        const repair = page.locator('[data-affordance^="invariant:"]').filter({ visible: true }).first();
        await revealActs(person, repair);
        await person.press(page.locator('[data-affordance^="invariant:"]').filter({ visible: true }).first(), "its repair");
        await answerAsks(person, { name: "Somebody" });
      } else {
        const link = page.locator('a[href$="/problems"]').filter({ visible: true }).first();
        if (!(await link.isVisible().catch(() => false))) {
          const menu = page.getByRole("button", { name: /menu|sections|kinds|navigation/i }).first();
          if (await menu.isVisible().catch(() => false)) await person.press(menu, "the menu");
        }
        await person.press(page.locator('a[href$="/problems"]').filter({ visible: true }).first(), "the Problems link");
        await page.waitForLoadState("domcontentloaded");
        await person.settle(300);
        const repair = page.locator('[data-testid="repairs"] button, [data-affordance^="invariant:"]').filter({ visible: true }).first();
        if (!(await appears(repair))) throw new DeadEnd("the problems page offers no repair to press");
        await person.press(repair, "a repair");
        const form = page.locator("form[data-testid^='form-']").filter({ visible: true }).first();
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
        await pressDistrict(person, prep.kind, prep.plural).catch(() => {});
      }
      if (ctx.face === "pages" && !prep.subject) await openKindPage(person, prep.plural).catch(() => {});
      if (ctx.face === "scene") await openActs(person);
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
      const more = page.locator('[data-testid="withheld-more"]').filter({ visible: true }).first();
      if (await appears(more, 3_000)) {
        await person.press(more, "what is withheld");
        if (await saidSoon()) return;
      }
      const offered = actControl(page, prep.act, prep.title).filter({ visible: true }).first();
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
  if (!previous?.apps) return [];
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
  return found.map((line) => line.replace(/: (\w)/, (m, c) => `: ${c.toUpperCase()}`));
}

export { lower };
