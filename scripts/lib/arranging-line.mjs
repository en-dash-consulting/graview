/**
 * A LIST ARRANGES ON ONE QUIET LINE, measured in a browser.
 *
 * Nick, on Graview Cloud's "Purchase scenarios": the list's head — an
 * eyebrow count, the title, "Related:", "See … as:", two form-sized selects
 * and a full-width "Only…" — stood some 400 pixels between the top of the
 * page and its first record. These read what a person meets instead: how
 * far down the first record is, whether any select is left for arranging,
 * whether the keyboard reaches every way to arrange, and what an address
 * opens. `verify-pages` asks them of todo and seedbed, `verify-rota` of the
 * rota's shifts, and `verify-chrome-quiet` of Cloud's workshop.
 */

/** How far a list's first record stands from the top of the page's content, at most, by the window's width. */
export const FIRST_RECORD_WITHIN = { desk: 210, phone: 240 };

/** The page's head, measured: where its content begins (under the bar), where the first record is, and what arranges it. */
export function listHead(page) {
  return page.evaluate(() => {
    const shown = (element) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return false;
      for (let at = element; at; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    };
    // The content begins under the app's bar, and under a phone's place line beneath it.
    const bar = document.querySelector("[data-graview-app-bar]");
    const line = bar?.parentElement?.querySelector(".graview-bar-line");
    const under = Math.max(bar ? bar.getBoundingClientRect().bottom : 0, line && shown(line) ? line.getBoundingClientRect().bottom : 0);
    const first = [...document.querySelectorAll('[data-testid="records"] li, [data-testid="records"] [data-testid="record-row"]')].find(shown);
    const lines = [...document.querySelectorAll('[role="group"][aria-label="Arrange"]')].filter(shown);
    const selects = lines.flatMap((one) => [...one.querySelectorAll("select")].filter(shown)).length;
    const count = lines[0]?.querySelector('[data-testid$="-count"]')?.textContent?.trim() ?? null;
    const eyebrow = [...document.querySelectorAll("main p, main span")].filter(shown).some((one) => getComputedStyle(one).textTransform === "uppercase" && /\d/.test(one.textContent ?? "") && one.closest('[role="group"]') === null);
    return {
      under: Math.round(under),
      first: first ? Math.round(first.getBoundingClientRect().top) : null,
      fromTop: first ? Math.round(first.getBoundingClientRect().top - under) : null,
      lines: lines.length,
      selects,
      count,
      countedInAnEyebrow: eyebrow,
      scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

/**
 * Scrolled to its end, whether the page's last line stands clear of what is
 * fixed at the foot (the seat's field): the field covered a phone's last row
 * however far the page scrolled.
 */
export async function endClearsTheFoot(page) {
  return page.evaluate(async () => {
    // The page's own column, not a host's page around an embed (which goes on under the box).
    const main = document.querySelector("[data-graview-page-title]")?.closest("main, section") ?? document.querySelector("main");
    if (!main) return { ok: false, why: "no main" };
    for (let at = main; at; at = at.parentElement) if (at.scrollHeight > at.clientHeight + 1) at.scrollTop = at.scrollHeight;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    // The last thing drawn in the page's column: its content's end, less its own padding.
    const leaves = [...main.querySelectorAll("a, button, input, li, p, h2, h3, label")].filter((one) => {
      const box = one.getBoundingClientRect();
      // Not the field itself, nor what is drawn for a screen reader alone.
      return box.width > 2 && box.height > 2 && getComputedStyle(one).visibility !== "hidden" && !one.closest("[data-graview-foot], [data-graview-popover]");
    });
    const end = Math.max(...leaves.map((one) => one.getBoundingClientRect().bottom));
    const feet = [...document.querySelectorAll("[data-graview-foot]")]
      .map((one) => one.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0 && box.top < innerHeight);
    const left = Math.min(...leaves.map((one) => one.getBoundingClientRect().left));
    const right = Math.max(...leaves.map((one) => one.getBoundingClientRect().right));
    const over = feet.filter((box) => box.right > left && box.left < right && box.top < end);
    const last = leaves.find((one) => Math.round(one.getBoundingClientRect().bottom) === Math.round(end));
    return { end: Math.round(end), feet: feet.map((box) => Math.round(box.top)), last: last ? `${last.tagName.toLowerCase()} ${(last.getAttribute("data-testid") ?? last.textContent ?? "").trim().slice(0, 40)}` : null, ok: over.length === 0 };
  });
}

/**
 * Every way to arrange, from the keyboard alone: each word on the line is
 * reached with Tab, opened with Enter, and its list walked with the arrow
 * keys until every entry has had the keyboard; Escape closes it and gives
 * the keyboard back to the word. On a narrow line the one "Arrange" holds
 * them all. `prefix` is the line's test id prefix (`arrange`, `list`).
 */
export async function arrangeByKeyboard(page, prefix) {
  const words = await page.evaluate((prefix) => {
    const shown = (element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== "hidden";
    return ["sort", "group", "add", "all"].filter((word) => {
      const element = document.querySelector(`button[data-testid="${prefix}-${word}"]`);
      return element && shown(element);
    });
  }, prefix);
  const seen = [];
  for (const word of words) {
    const trigger = `button[data-testid="${prefix}-${word}"]`;
    // Reached as a person reaches it: Tab from the page until the keyboard is on it.
    await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
    let reached = false;
    for (let presses = 0; presses < 80 && !reached; presses++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate((selector) => document.activeElement?.matches(selector) ?? false, trigger);
    }
    if (!reached) {
      seen.push({ word, reached: false });
      continue;
    }
    await page.keyboard.press("Enter");
    // The lists come when one is first opened: given a moment to arrive.
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="arrange-list"] button').length > 0, null, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(100);
    const entries = await page.evaluate(() => document.querySelectorAll('[data-testid="arrange-list"] button:not([disabled])').length);
    const visited = new Set();
    for (let presses = 0; presses < entries + 2; presses++) {
      const at = await page.evaluate(() => {
        const active = document.activeElement;
        const pane = document.querySelector('[data-testid="arrange-list"]');
        if (!pane || !active || !pane.contains(active)) return null;
        return [...pane.querySelectorAll("button:not([disabled])")].indexOf(active);
      });
      if (at !== null && at >= 0) visited.add(at);
      await page.keyboard.press("ArrowDown");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const back = await page.evaluate((selector) => ({ closed: document.querySelector('[data-testid="arrange-list"]') === null, onTrigger: document.activeElement?.matches(selector) ?? false }), trigger);
    seen.push({ word, reached: true, entries, visited: visited.size, ...back });
  }
  return { words, seen, ok: words.length > 0 && seen.every((one) => one.reached && one.entries > 0 && one.visited === one.entries && one.closed && one.onTrigger) };
}

/** Chooses one entry on the line with the pointer: the word, then the entry whose value is `value` (`due`, `price:at-most:25000`). */
export async function chooseOnTheLine(page, prefix, word, value) {
  const visible = await page.locator(`button[data-testid="${prefix}-${word}"]`).isVisible().catch(() => false);
  // A narrow line holds every word in its one "Arrange".
  await page.click(`button[data-testid="${prefix}-${visible ? word : "all"}"]`);
  await page.waitForSelector('[data-testid="arrange-list"]', { timeout: 5_000 });
  await page.click(`[data-testid="arrange-list"] [data-value="${value}"]`);
}
