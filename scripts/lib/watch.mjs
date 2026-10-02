/**
 * THE WATCH: the rules that hold everywhere, judged on every screen every
 * harness reaches.
 *
 * Six walks logged 152 findings, and the same few kinds kept coming back on
 * a surface nobody had tested: the keyboard left on <body> after an act
 * (eight times), a declared id shown to a person (twelve), an act offered to
 * somebody the policy then refused (nine). Each was fixed with a criterion
 * local to the one component it was found in, so the next surface had none.
 * These rules do not belong to a harness; they belong to every screen. So
 * they run inside the page, attached where every harness launches its
 * browser (`launchEngine`), and judge whatever state the harness happens to
 * drive the app into — a criterion nobody has to remember to write.
 *
 * What it judges:
 *
 *   keyboard-lands-nowhere  Enter, Space, Escape or Delete on a focused
 *                           control, or a press on a control the engine
 *                           focused, and the keyboard ends on <body>.
 *   machine-words-shown     visible text, or a name a screen reader reads
 *                           (aria-label, title, placeholder, alt), contains
 *                           a declared id the declaration has words for —
 *                           an act's name, a role, a field key, a seat's id.
 *                           Ids are learned from the store itself
 *                           (`@graview/core`'s watched.ts), so this is an
 *                           exact match and never a guess at what an id
 *                           looks like.
 *   offered-then-refused    a press reached the store and the policy
 *                           refused it: something offered an act to a seat
 *                           that may not take it.
 *   page-error              an uncaught error in the page.
 *
 * Each harness writes what it saw to docs/watch/<script>.json, and
 * `verify-all` fails a harness with any violation not acknowledged, by
 * name and with a reason, in scripts/lib/watch-acknowledged.mjs.
 *
 * GRAVIEW_WATCH=0 turns it off, for profiling something else.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acknowledgedBy } from "./watch-acknowledged.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The harness this process is: its script's name. */
export const harnessName = () => basename(process.argv[1] ?? "harness").replace(/\.mjs$/, "");

/** Where a harness's watch report is written, per engine. */
export const watchFile = (script, engine = "chromium") =>
  resolve(repoRoot, "docs/watch", `${script}${engine === "chromium" ? "" : `.${engine}`}.json`);

/* ------------------------------------------------------------------ */
/* In the page. Serialised by addInitScript: no closure over Node.     */
/* ------------------------------------------------------------------ */

function watchInPage() {
  if (window.__graviewWatch) return;
  const seen = new Set();
  const where = () => `${location.pathname.split("/").pop() || "/"}${location.search}${location.hash}`.slice(0, 160);
  const report = (rule, detail, key) => {
    const id = `${rule}|${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    try {
      window.__graviewWatchReport({ rule, detail, at: where() });
    } catch {
      // The binding is not there (a page opened outside a watched context).
    }
  };
  const describe = (el) => {
    if (!el || el.nodeType !== 1) return "nothing";
    const tag = el.tagName.toLowerCase();
    const testid = el.getAttribute("data-testid");
    const label = el.getAttribute("aria-label");
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    // Where it is, so a finding can be traced to the code that drew it.
    const host = el.parentElement?.closest("[data-testid]")?.getAttribute("data-testid");
    const view = el.closest("[data-graview-view]")?.getAttribute("data-graview-view");
    const inside = [host ? `in [data-testid="${host}"]` : "", view ? `in view "${view}"` : ""].filter(Boolean).join(" ");
    return `<${tag}${testid ? ` data-testid="${testid}"` : ""}${label ? ` aria-label="${label.slice(0, 50)}"` : ""}>${text ? ` "${text}"` : ""}${inside ? ` ${inside}` : ""}`;
  };
  /** What became of the control the keyboard was on — which says which fix it needs. */
  const fate = (el) =>
    !el.isConnected
      ? "it was removed"
      : el.matches(":disabled")
        ? "it was disabled"
        : (typeof el.checkVisibility === "function" ? !el.checkVisibility() : el.getClientRects().length === 0)
          ? "it was hidden"
          : "it is still there";
  const nowhere = () => {
    const now = document.activeElement;
    return !now || now === document.body || now === document.documentElement;
  };

  /* The declaration's names, learned from every store in the page. */
  const ids = new Set();
  const words = [];
  const unsaid = new Set();
  /* What the seat at the keyboard may not see: names and addresses of records the policy keeps from it. */
  let unseen = null;
  const unseenBy = new Map();
  let pattern = null;
  const rebuild = () => {
    const spoken = ` ${words.join(" | ").toLowerCase()} `;
    // A name is caught only where it is not also how the declaration says it.
    const caught = [...ids].filter(
      (id) => id.length >= 3 && /[-_:]|[a-z][A-Z]/.test(id) && !spoken.includes(id.toLowerCase()),
    );
    pattern = caught.length
      ? new RegExp(`(?<![\\w-])(${caught.sort((a, b) => b.length - a.length).map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`)
      : null;
  };

  /* Text a person sees or hears, scanned when the page goes quiet. */
  const SILENT = "script,style,code,pre,kbd,samp,textarea,template,[aria-hidden='true'],[hidden],[data-graview-speaks-ids]";
  /*
   * SEEN, THOUGH NOT SPOKEN. Text a screen reader is told to skip is still
   * text a person reads: the kind tag on a focused card is aria-hidden and
   * said "vehicle" — and "test-drive" — on every record the seventh walk
   * opened. Shown text is judged whether or not it is spoken.
   */
  const UNSHOWN = "script,style,code,pre,kbd,samp,textarea,template,[hidden],[data-graview-speaks-ids]";
  const visible = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.getClientRects().length > 0);
  let queued = false;
  /*
   * NO SIDEWAYS SCROLL. A page wider than its window at a phone's width or
   * a reader's text size: the class's own check, judged on every state
   * every harness reaches rather than on the routes one harness measured
   * (W-151 on search, W-175 on a list, one component apart).
   */
  const sideways = () => {
    const root = document.documentElement;
    if (!root || !document.body) return;
    const over = root.scrollWidth - root.clientWidth;
    if (over <= 1) return;
    const widest = [...document.body.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1 && !el.closest("[data-graview-scrolls]"))
      .pop();
    report("breaks-at-width", `the page scrolls sideways by ${over}px at ${root.clientWidth} wide (text ${getComputedStyle(root).fontSize})${widest ? `, reached by ${describe(widest)}` : ""}`, `${location.pathname}|${root.clientWidth}|${getComputedStyle(root).fontSize}`);
  };
  const scan = () => {
    queued = false;
    sideways();
    if ((!pattern && unsaid.size === 0 && !unseen) || !document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const work = (deadline) => {
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue;
        if (unseen && text && text.length > 4) {
          const hit = unseen.exec(text);
          const el = node.parentElement;
          /*
           * A SEAT IS NOT A RECORD. The seat switcher names the people the
           * host declared one may sit as — offering "sit down as Aiyana" is
           * the control's whole job, and reads nothing of hers from the store.
           */
          if (hit && el && !el.closest('script,style,template,[hidden],[role="group"][aria-label="Seat"]') && visible(el)) {
            report("shown-what-is-not-theirs", `"${hit[1]}" — a record this seat may not see — is shown in ${describe(el)}`, `${hit[1]}|${describe(el)}`);
          }
        }
        if (pattern && text && text.length > 2) {
          const hit = pattern.exec(text);
          const el = node.parentElement;
          if (hit && el && !el.closest(UNSHOWN) && visible(el)) {
            report("machine-words-shown", `"${hit[1]}" is shown as text in ${describe(el)}`, `${hit[1]}|${describe(el)}`);
          }
        }
        if (deadline && deadline.timeRemaining() < 2) return requestIdleCallback(work);
      }
      /*
       * A KEY'S OWN WORDS, WHOLE. A field the kind calls "VIN" asked for as
       * "Vin", a picker offering "suv" where the record says "SUV": single
       * words pass for prose inside a sentence, so they are caught only
       * where they are all an element says (a label, an option, a tag).
       */
      if (unsaid.size > 0) {
        for (const el of document.body.querySelectorAll("*")) {
          if (el.closest(UNSHOWN)) continue;
          const own = [...el.childNodes].filter((child) => child.nodeType === 3).map((child) => child.nodeValue).join("").replace(/\s*\*\s*$/, "").trim();
          if (own && unsaid.has(own) && (el.tagName === "OPTION" || visible(el))) {
            report("machine-words-shown", `"${own}" is shown in the key's words in ${describe(el)}, where the declaration says it otherwise`, `${own}|${describe(el)}`);
          }
        }
      }
      for (const el of document.querySelectorAll("[aria-label],[title],[placeholder],img[alt]")) {
        if (el.closest(SILENT)) continue;
        for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
          const value = el.getAttribute(attr);
          const hit = value && pattern && pattern.exec(value);
          if (hit) report("machine-words-shown", `"${hit[1]}" is read out in ${attr} of ${describe(el)}`, `${hit[1]}|${attr}|${describe(el)}`);
        }
      }
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(work);
    else work(null);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    setTimeout(scan, 400);
  };

  window.__graviewWatch = {
    learn({ ids: learned, words: said, unsaid: plain = [] }) {
      for (const id of learned) ids.add(id);
      for (const word of plain) unsaid.add(word);
      words.push(...said);
      rebuild();
      schedule();
    },
    unseen({ words: told, from = "page", gone = false }) {
      /*
       * Per surface, and only what NO surface on the page may see: two embeds
       * can sit two seats down, and what one may see the other may show.
       */
      if (gone) unseenBy.delete(from);
      else unseenBy.set(from, new Set(told));
      const sets = [...unseenBy.values()];
      const kept = sets.length === 0 ? [] : [...sets[0]].filter((word) => sets.every((set) => set.has(word)));
      const escaped = kept.filter((word) => word.length >= 5).sort((a, b) => b.length - a.length).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      unseen = escaped.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "u") : null;
      schedule();
    },
    refused(refusal) {
      report(
        "offered-then-refused",
        `${refusal.author ?? "a seat"} reached "${refusal.mutation}"${refusal.kind ? ` on ${refusal.kind}` : ""} and the policy refused it: ${refusal.message}`,
        `${refusal.mutation}|${refusal.kind ?? ""}|${refusal.author ?? ""}`,
      );
    },
  };

  // Judged once the scene has settled: a transition takes the old card away
  // at its end (about half a second), and the keyboard lands after it.
  const settle = (then) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(then)), 800);
  /*
   * AND ASKED AGAIN BEFORE IT IS SAID. Under a loaded machine the keyboard
   * can land a few hundred milliseconds late, and a violation that is there
   * at one look and gone at the next made the ledger flap — fixed, new,
   * fixed — which is noise a person then has to read. Reported only if the
   * keyboard is still on nothing a second and a half later.
   */
  const stillNowhere = (then) => settle(() => {
    if (nowhere()) setTimeout(() => nowhere() && then(), 1500);
  });
  const TEXT_ENTRY = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]),textarea,[contenteditable='true'],[contenteditable='']";
  const KEYS = { Enter: "Enter", " ": "Space", Escape: "Escape", Delete: "Delete", Backspace: "Backspace" };
  document.addEventListener(
    "keydown",
    (event) => {
      const key = KEYS[event.key];
      if (!key || event.isComposing) return;
      const before = document.activeElement;
      if (!before || before === document.body || before === document.documentElement) return;
      // Typing in a field: Space, Backspace and Delete are edits, not acts.
      if (key !== "Enter" && key !== "Escape" && before.matches(TEXT_ENTRY)) return;
      const what = describe(before);
      stillNowhere(() => report("keyboard-lands-nowhere", `${key} on ${what} left the keyboard on <body> (${fate(before)})`, `${key}|${what}`));
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target?.closest?.("button,[role=button],[role=menuitem],[role=option],[role=tab],a[href]");
      if (!target) return;
      // Only where the engine focused what was pressed (WebKit does not focus a button on click).
      if (document.activeElement !== target && !target.contains(document.activeElement)) return;
      const what = describe(target);
      stillNowhere(() => report("keyboard-lands-nowhere", `a press on ${what} left the keyboard on <body> (${fate(target)})`, `press|${what}`));
    },
    true,
  );
  const observe = () => {
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "title", "placeholder", "hidden"] });
    // A reader's text size and a window's width change the page without touching the body.
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-graview-text-size"] });
    window.addEventListener("resize", schedule);
    schedule();
  };
  if (document.body) observe();
  else document.addEventListener("DOMContentLoaded", observe, { once: true });
}

/* ------------------------------------------------------------------ */
/* In Node.                                                            */
/* ------------------------------------------------------------------ */

const violations = [];
const keys = new Set();
let engineSeen = "chromium";
let wired = false;

const record = (violation) => {
  const key = `${violation.rule}|${violation.detail}`;
  if (keys.has(key)) return;
  keys.add(key);
  violations.push(violation);
};

/**
 * What the watch has seen so far, taken: the watch's own self-test drives
 * pages built to break each rule and must not be failed for doing so.
 */
export function takeViolations() {
  const taken = violations.splice(0);
  keys.clear();
  return taken;
}

/** Written on the way out, however the harness leaves. */
const writeReport = () => {
  const script = harnessName();
  const judged = violations.map((one) => {
    const by = acknowledgedBy(script, one);
    return by ? { ...one, acknowledged: by.reason } : one;
  });
  const open = judged.filter((one) => !one.acknowledged);
  const file = watchFile(script, engineSeen);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify({ at: new Date().toISOString(), harness: script, engine: engineSeen, open: open.length, violations: judged }, null, 2)}\n`,
  );
  if (open.length > 0) {
    process.stderr.write(`\nwatch: ${open.length} violation${open.length === 1 ? "" : "s"} of the rules every screen holds (docs/watch/${basename(file)})\n`);
    for (const one of open.slice(0, 20)) process.stderr.write(`  ${one.rule}  ${one.detail}  @ ${one.at}\n`);
  }
};

/**
 * A browser whose every context and page is watched. Used by launchEngine
 * and launchCanaryGpu, so no harness has to ask.
 */
export function watched(browser, engine) {
  if (process.env["GRAVIEW_WATCH"] === "0") return browser;
  engineSeen = engine === "canary" ? "chromium" : engine;
  if (!wired) {
    wired = true;
    process.on("exit", writeReport);
  }
  const attached = new WeakSet();
  const attach = async (context) => {
    if (attached.has(context)) return;
    attached.add(context);
    await context.exposeBinding("__graviewWatchReport", (_source, violation) => record(violation));
    await context.addInitScript(watchInPage);
    context.on("page", (page) => listen(page));
    for (const page of context.pages()) listen(page);
  };
  const listening = new WeakSet();
  const listen = (page) => {
    if (listening.has(page)) return;
    listening.add(page);
    /*
     * GRAVIEW_SLOW=4: every page as slow as the nightly's runner. The first
     * nightlies failed on what only a two-core runner shows — a dead end
     * decided before a list drew, a key lost to a lagging address — and an
     * hour per round to see it is not a loop. Chromium only.
     */
    const slow = Number(process.env["GRAVIEW_SLOW"] ?? 0);
    if (slow > 1 && engineSeen === "chromium") {
      page.context().newCDPSession(page).then((cdp) => cdp.send("Emulation.setCPUThrottlingRate", { rate: slow })).catch(() => {});
    }
    page.on("pageerror", (error) => record({ rule: "page-error", detail: String(error?.message ?? error).split("\n")[0].slice(0, 200), at: page.url().split("/").pop()?.slice(0, 160) ?? "" }));
  };
  return new Proxy(browser, {
    get(target, prop) {
      if (prop === "newContext") {
        return async (...args) => {
          const context = await target.newContext(...args);
          await attach(context);
          return context;
        };
      }
      if (prop === "newPage") {
        return async (...args) => {
          const page = await target.newPage(...args);
          await attach(page.context());
          listen(page);
          return page;
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
