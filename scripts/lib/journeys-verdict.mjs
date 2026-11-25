/**
 * WHAT THE JOURNEYS' RUNS SAY (verify-journeys.mjs): the friction ranked,
 * what got worse, the keyboard's claims, and one verdict made of several
 * parts' (lib/parts.mjs, which reads only this half of lib/journeys.mjs).
 */

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
  "relate/scene": "the menu opens on its field, the two ways to ask and the first few acts, and an act that ties a record to another waits behind More…: the keyboard Tabs from the field past the ways to ask to More…, then walks to the act, where the pointer presses More… and the act",
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

/** The report without the runs the harness could not drive, which are neither friction nor a regression. */
export function drivenOnly(report) {
  const counted = structuredClone(report);
  for (const result of Object.values(counted.apps)) {
    for (const job of Object.values(result.jobs ?? {})) {
      for (const [key, run] of Object.entries(job.runs)) if (run.harness) delete job.runs[key];
    }
  }
  return counted;
}

/**
 * THE VERDICT OF THE PARTS (lib/parts.mjs): every app's jobs with every run
 * a part made of them, and the friction and the keyboard's claims read from
 * the whole, as one process would have read them — a job's cheapest way is
 * looked for across the faces, which two parts walk. A regression is of one
 * run, so the parts' own are the whole's. A part that wrote no verdict is a
 * claim that fails.
 *
 * @param {{ part: string, verdict: object | null }[]} parts
 */
export function mergeJourneys(parts) {
  const wrote = parts.filter((one) => one.verdict?.apps);
  const apps = {};
  for (const { verdict } of wrote) {
    for (const [app, result] of Object.entries(verdict.apps)) {
      const was = apps[app] ?? {};
      const jobs = { ...was.jobs };
      for (const [id, job] of Object.entries(result.jobs ?? {})) jobs[id] = { ...job, runs: { ...jobs[id]?.runs, ...job.runs } };
      apps[app] = { ...was, ...result, ...(Object.keys(jobs).length > 0 ? { jobs } : {}) };
    }
  }
  const counted = drivenOnly({ apps });
  const missing = parts.filter((one) => !wrote.includes(one)).map((one) => one.part);
  const checks = { ...keyboardChecks(counted), everyPartWroteAVerdict: { ok: missing.length === 0, ...(missing.length > 0 ? { missing } : {}) } };
  const regressions = [...new Set(wrote.flatMap((one) => one.verdict.regressions ?? []))];
  return {
    at: wrote.map((one) => one.verdict.at).filter(Boolean).sort().at(-1) ?? new Date().toISOString(),
    parts: parts.map((one) => one.part),
    ...(wrote[0]?.verdict.engine ? { engine: wrote[0].verdict.engine } : {}),
    apps,
    friction: frictionOf(counted),
    regressions,
    checks,
    passed: regressions.length === 0 && wrote.every((one) => one.verdict.passed !== false) && Object.values(checks).every((check) => check.ok),
    took: wrote.reduce((sum, one) => sum + (one.verdict.took ?? 0), 0),
  };
}

export { lower };
