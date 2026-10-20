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
 *   control-covered         a press at a control's middle or a quarter in
 *                           from a corner lands on something else standing
 *                           over it (not a menu, dialog or popover opened
 *                           over the page, nor a sticky bar).
 *   card-wider-than-screen  a card is laid out wider than the screen, or
 *                           holds what reaches past its own edge and the
 *                           screen's, cut off rather than scrolled.
 *   page-error              an uncaught error in the page.
 *   app-drew-nothing        the root an app mounts into (`#root`) is still
 *                           empty eight seconds after the page loaded: its
 *                           module threw, or its top-level await rejected,
 *                           which WebKit raises no error for at all.
 *
 * A harness whose page leaves an app's root empty on purpose opts out by
 * name in watch-acknowledged.mjs ({ rule, harness, match, reason }), or the
 * page marks the root `data-graview-draws-nothing`.
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
/* What the watch learns from a store. Plain functions with no closure */
/* over Node: put into the page beside `watchInPage`, and imported by  */
/* the tests that hold them.                                           */
/* ------------------------------------------------------------------ */

/*
 * THE STORE IS HANDED OVER; THE WATCH READS IT. The declaration's names,
 * what a seat may not see and who signed what were worked out by
 * `@graview/core` and told to the watch — 2.4 KB that every reader of a
 * hosted page downloaded for a harness's sake, and the room the ninth
 * walk's fixes needed (the hosted page's budget). The store hands itself
 * over (`watch.store`, `watch.seat`) and the watch works the words out
 * here, as core did.
 */

/** A key in words: "plannedAt" → "Planned at", as `humanizeField` says it. */
export function spoken(field) {
  const words = String(field)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The declaration's names, and the words it has for them: what the watch's `learn` takes. */
export function namesOf(store) {
  const schema = store.schema;
  const policy = store.policy;
  const mutations = typeof store.allMutations === "function" ? store.allMutations() : [];
  const ids = [];
  const words = [];
  /*
   * THE KEY'S WORDS WHERE THE DECLARATION HAS ITS OWN. "Vin" over a field
   * the kind calls "VIN", "suv" in a picker the record says "SUV" in: a
   * single word passes for prose, so these are caught only where they are
   * the whole of what is shown.
   */
  const unsaid = [];
  const fieldsOf = (definition) => definition.fields?.shape ?? {};
  for (const definition of schema.definitions) {
    ids.push(definition.kind);
    // A kind with a noun of its own is never shown by its id: "vehicle" where the declaration says "car".
    if (definition.noun && spoken(definition.kind).toLowerCase() !== definition.noun.toLowerCase()) unsaid.push(definition.kind);
    for (const [key, field] of Object.entries(fieldsOf(definition))) {
      const declared = definition.display?.labels?.[key];
      if (declared !== undefined && spoken(key) !== declared) unsaid.push(spoken(key));
      const entries = field?.def?.entries;
      const format = definition.display?.format?.[key];
      for (const value of entries && typeof entries === "object" ? Object.values(entries) : []) {
        if (typeof value !== "string") continue;
        ids.push(value);
        if (!format) continue;
        const said = format(value);
        /*
         * The raw value only where the declaration says the same word another
         * way ("suv" for "SUV"): a value that is an ordinary word ("open",
         * "new") is a word the interface also says, and its spoken form
         * ("Mon") one a calendar prints.
         */
        if (said !== value && said.toLowerCase() === value.toLowerCase()) unsaid.push(value);
      }
    }
    words.push(definition.plural ?? "", definition.noun ?? "", definition.description ?? "");
    ids.push(...Object.keys(fieldsOf(definition)));
    for (const label of Object.values(definition.display?.labels ?? {})) words.push(label);
    for (const [name, edge] of Object.entries(definition.edges ?? {})) {
      ids.push(name);
      // An edge's name spoken ("Drives", "On show at") where it has words of its own ("the test drives booked in it").
      if (edge.description || edge.inverse) unsaid.push(spoken(name));
      words.push(edge.description ?? "", edge.inverse ?? "");
    }
  }
  for (const mutation of mutations) {
    ids.push(mutation.name);
    words.push(mutation.title ?? "");
  }
  for (const grant of policy?.grants ?? []) if (grant.roles !== "*") ids.push(...grant.roles);
  ids.push(...(policy?.roles ?? []));
  // A word one kind declares is never another's key: "Status" is a test drive's own label even where a car says "Availability".
  const declared = new Set();
  for (const definition of schema.definitions) {
    // A kind's own words: what a picker asks for ("Owner") is a noun, not an edge's name.
    declared.add(definition.plural ?? "");
    declared.add(spoken(definition.noun ?? definition.kind));
    for (const label of Object.values(definition.display?.labels ?? {})) declared.add(label);
    for (const [key, field] of Object.entries(fieldsOf(definition))) {
      const format = definition.display?.format?.[key];
      const entries = field?.def?.entries;
      if (!format && !definition.display?.labels?.[key]) declared.add(spoken(key));
      // A value is said by its format, or spoken plainly where there is none ("Given", a talk's state).
      if (entries && typeof entries === "object") for (const value of Object.values(entries)) declared.add(format ? format(value) : spoken(String(value)));
      /*
       * A yes or a no the kind words itself is its own word too (W-193): a
       * hive's `queenSeen` labeled "Queen" and said "Queen seen" when true
       * says, in the declaration's words, what its key spoken also says.
       */
      if (format && !entries)
        try {
          declared.add(String(format(true)).trim()).add(String(format(false)).trim());
        } catch {
          // A format that is not a yes or a no's says nothing of one.
        }
    }
  }
  return { ids, words: words.filter(Boolean), unsaid: [...new Set(unsaid)].filter((word) => !declared.has(word)), kinds: schema.definitions.map((definition) => definition.kind) };
}

/**
 * A RECORD'S ID, AS MINTED: `film:small-harbor`, `screening:saltwater-2` —
 * a declared kind, a colon and a slug. Its kind is a declared name the watch
 * already knows, but the id is the store's and was never learned, so a film
 * picker reading "Small Harbor · film:small-harbor" four thousand times
 * passed every harness (the twelfth walk).
 */
export function mintedIds(kinds) {
  const named = kinds.filter((kind) => kind.length > 0).sort((a, b) => b.length - a.length).map((kind) => kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return named.length ? new RegExp(`(?<![\\w-])((?:${named.join("|")}):[\\p{Ll}\\p{N}][\\p{Ll}\\p{N}-]*)`, "u") : null;
}

/**
 * WHAT THIS SEAT MAY NOT SEE: the names (and email addresses) of the
 * records the policy's `sees` keeps from it, less any a record it may see
 * shares. Nothing where the policy says nothing of sight.
 */
export function unseenOf(store, principal) {
  if (!store.policy?.sees?.length) return null;
  const unseen = new Set();
  const seen = new Set();
  for (const node of store.graph.allNodes()) {
    const definition = store.schema.tryDefinition(node.kind);
    const name = definition?.label ? definition.label(node) : typeof node.label === "string" && node.label.length > 0 ? node.label : node.id;
    const said = [name, ...Object.values(node).filter((value) => typeof value === "string" && /^[^\s@]+@[^\s@]+$/.test(value))];
    for (const word of said) (store.sees(principal, node.id) ? seen : unseen).add(word);
  }
  return [...unseen].filter((word) => word.length >= 5 && !seen.has(word));
}

/** Who signed what, where no record is theirs: a seat's id is a name too. */
export function authorsOf(store) {
  return [...new Set(store.log.all().map((op) => op.author?.id).filter((id) => typeof id === "string" && store.graph.getNode(id) === undefined))];
}

/* ------------------------------------------------------------------ */
/* In the page. Serialized by addInitScript: no closure over Node.     */
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
  /*
   * A word one store declares is never another's key: with the studio open
   * over an app, the studio's "people" flag speaks as "People" while the
   * app's people kind is called "People", and the app's word is its own.
   */
  const declaredWhole = new Set();
  /* What the seat at the keyboard may not see: names and addresses of records the policy keeps from it. */
  let unseen = null;
  const unseenBy = new Map();
  let pattern = null;
  const kinds = new Set();
  let minted = null;
  const rebuild = () => {
    minted = mintedIds([...kinds]);
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
  let lastPress = null;
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
  /*
   * A TARGET A FINGER CAN HIT (WCAG 2.5.8). The class's table named a
   * target-size rule as its check from the first walk to the eighth, and
   * the watch had none: a district's "open" measured 22 pixels at a phone's
   * width, beside the next district's name. A control under 24 pixels either
   * way is a problem when a 24-pixel circle at its center reaches another
   * control — the standard's own spacing exception — unless it is a link
   * inside a sentence or the browser's own box.
   */
  const CONTROL = "a[href],button,select,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),[role=button],[role=link],[role=menuitem],[role=tab],[role=option]";
  /*
   * Asked again before it is said, as a covered control is: in Firefox the
   * rota's Find box measured the browser's own 19 pixels for a beat before
   * its line's stylesheet held it to 28.
   */
  const small = (again = null) => {
    const boxes = [];
    const found = new Set();
    for (const el of document.querySelectorAll(CONTROL)) {
      if (el.closest("[hidden],[aria-hidden='true'],[inert]") || !visible(el)) continue;
      const style = getComputedStyle(el);
      if (style.pointerEvents === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      /*
       * A record a lens draws at a size its data decides — fifteen minutes
       * on a week's timeline, two shifts sharing a day — is the standard's
       * "essential" exception: drawn larger, it would say something untrue.
       */
      if (el.matches("[data-graview-pick]") && el.closest('[data-graview-view^="aggregate:"]')) continue;
      // A link that is a word in a sentence is the standard's own exception.
      if (el.tagName === "A" && style.display === "inline" && (el.parentElement?.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 1) continue;
      /*
       * Its size as laid out, not as the scene happens to be zoomed: a
       * record in the picture is drawn smaller at altitude and larger
       * nearer, and that is the reader's zoom, which no control decides. A
       * control is held to the size it was given.
       */
      const own = el instanceof HTMLElement && el.offsetWidth > 0 ? { width: el.offsetWidth, height: el.offsetHeight } : box;
      boxes.push({ el, box, own });
    }
    const said = (el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
    for (const { el, box, own } of boxes) {
      if (own.width >= 23.5 && own.height >= 23.5) continue;
      // The standard's "equivalent": the same thing, by the same name, is a full-size control elsewhere on the page.
      if (boxes.some(({ el: other, own: theirs }) => other !== el && theirs.width >= 23.5 && theirs.height >= 23.5 && said(other) && said(other) === said(el))) continue;
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      // Its 24-pixel circle meets another control — or, when that one is small too, that one's circle.
      const crowded = boxes.find(({ el: other, box: near, own: theirs }) => {
        if (other === el || other.contains(el) || el.contains(other)) return false;
        if (theirs.width < 23.5 || theirs.height < 23.5) return (near.left + near.width / 2 - x) ** 2 + (near.top + near.height / 2 - y) ** 2 < 576;
        return Math.max(near.left - x, 0, x - near.right) ** 2 + Math.max(near.top - y, 0, y - near.bottom) ** 2 < 144;
      });
      if (!crowded) continue;
      if (!again) {
        found.add(el);
        continue;
      }
      if (!again.has(el)) continue;
      report("target-too-small", `${describe(el)} is ${Math.round(own.width)}×${Math.round(own.height)} pixels at ${document.documentElement.clientWidth} wide, within 12 pixels of ${describe(crowded.el)}`, `${location.pathname}|${describe(el)}|${document.documentElement.clientWidth}`);
    }
    if (!again && found.size > 0) setTimeout(() => small(found), 700);
  };
  /*
   * NOTHING STANDS OVER A CONTROL (layout-collision-or-overflow). The class
   * was logged by hand, walk after walk, and measured by nothing: the
   * rota's raised "Shifts ×" stood over its week's "Sort" (the tenth walk).
   * A control is covered where a press at a point of it — its middle, and
   * a quarter in from each corner — would land on something else. Not when
   * something was opened over the page on purpose (a menu, a dialog, a
   * popover), nor under a sticky bar a page scrolls beneath, nor while the
   * scene is still moving; and asked again before it is said.
   */
  let unsettled = 0;
  /* Laid over the page on purpose: a menu, a dialog, a popover, a panel or sheet laid on the map, the quick ask's card. */
  const OPENED_OVER = "[popover],dialog,[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[data-graview-popover],[data-graview-overlay]";
  const clips = (style) => style.overflowX !== "visible" || style.overflowY !== "visible";
  /** What of a control can be seen through the boxes that clip it: a point outside is scrolled or cut away, not covered. */
  const seenOf = (el) => {
    let { left, top, right, bottom } = el.getBoundingClientRect();
    for (let at = el.parentElement; at && at !== document.documentElement; at = at.parentElement) {
      if (!clips(getComputedStyle(at))) continue;
      const box = at.getBoundingClientRect();
      left = Math.max(left, box.left);
      top = Math.max(top, box.top);
      right = Math.min(right, box.right);
      bottom = Math.min(bottom, box.bottom);
    }
    return { left, top, right, bottom };
  };
  /** The boxes a control scrolls in, nearest first, and the page. */
  const scrollersOf = (el) => {
    const found = [];
    for (let at = el.parentElement; at && at !== document.body; at = at.parentElement) {
      const style = getComputedStyle(at);
      if ((style.overflowY === "auto" || style.overflowY === "scroll") && at.scrollHeight > at.clientHeight + 1) found.push(at);
    }
    found.push(document.scrollingElement ?? document.documentElement);
    return found;
  };
  const pinned = (el, within) => {
    for (let at = el; at && at !== within && at !== document.body; at = at.parentElement) {
      const position = getComputedStyle(at).position;
      if (position === "sticky" || position === "fixed" || at.hasAttribute("data-graview-foot")) return true;
    }
    return false;
  };
  /*
   * WHICH EDGE A PINNED BAR IS STUCK TO, where its own `top` or `bottom`
   * says so: graview.dev's rail at 900 wide is sticky at the top, and at the
   * foot of the long version, scrolled as far as it goes, "Chapter
   * fourteen" stood under the rail's lower half. Judged by their middles
   * the rail stood below the link, so the link was told to scroll up the
   * page where there was no room, and was said to be covered for good —
   * when scrolling back toward the top brings it out at once.
   */
  const stuckTo = (cover) => {
    for (let at = cover; at && at !== document.body; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.position !== "sticky" && style.position !== "fixed") continue;
      if (style.top !== "auto" && style.bottom === "auto") return "top";
      if (style.bottom !== "auto" && style.top === "auto") return "bottom";
      return null;
    }
    return null;
  };
  /*
   * A bar that stays put while what is under it scrolls — a sticky heading,
   * the ask field at the foot — covers nothing a person can scroll out from
   * under it, by any box it scrolls in; it does cover what is already as far
   * as it can go.
   */
  const scrollsClear = (el, cover) => {
    const mine = el.getBoundingClientRect();
    const theirs = cover.getBoundingClientRect();
    /*
     * Which way it scrolls clear: away from the side the bar stands on. A
     * bar at the foot (the ask field) stands below whatever it covers, even
     * a row cut by the window's own foot whose middle is lower than the
     * field's: judged by their middles, that row was told to scroll up,
     * where there was no room, and a page that scrolls on was said to end
     * under the field.
     */
    const below = cover.closest("[data-graview-foot]") !== null || (stuckTo(cover) ?? (theirs.top + theirs.bottom > mine.top + mine.bottom ? "bottom" : "top")) === "bottom";
    const needed = below ? mine.bottom - theirs.top : theirs.bottom - mine.top;
    return scrollersOf(el).some((scroller) => {
      const page = scroller === document.scrollingElement || scroller === document.documentElement;
      const stays = page ? pinned(cover, document.body) : !scroller.contains(cover) || pinned(cover, scroller);
      if (!stays) return false;
      const room = below ? scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop : scroller.scrollTop;
      return room >= needed - 1;
    });
  };
  const coveredAt = (el) => {
    const box = el.getBoundingClientRect();
    const seen = seenOf(el);
    const points = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    for (const [fx, fy] of points) {
      const x = box.left + box.width * fx;
      const y = box.top + box.height * fy;
      if (x < seen.left || x > seen.right || y < seen.top || y > seen.bottom) continue;
      const top = document.elementFromPoint(x, y);
      // Itself, or a box that holds it: not covered.
      if (!top || top === el || el.contains(top) || top.contains(el)) continue;
      if (top.closest(OPENED_OVER)) continue;
      const cover = top.closest(CONTROL) ?? top;
      if (scrollsClear(el, cover)) continue;
      return cover;
    }
    return null;
  };
  const covered = () => {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const found = [];
    for (const el of document.querySelectorAll(CONTROL)) {
      if (el.closest("[hidden],[aria-hidden='true'],[inert]") || !visible(el)) continue;
      const style = getComputedStyle(el);
      if (style.pointerEvents === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 8 || box.height < 8 || box.left < 0 || box.top < 0 || box.right > width || box.bottom > height) continue;
      const cover = coveredAt(el);
      if (cover) found.push({ el, cover });
    }
    if (found.length === 0) return;
    setTimeout(() => {
      for (const { el, cover } of found) {
        if (!el.isConnected || coveredAt(el) !== cover) continue;
        report("control-covered", `${describe(el)} is covered by ${describe(cover)} at ${width} wide — a press there lands on the other`, `${location.pathname}|${describe(el)}|${describe(cover)}|${width}`);
      }
    }, 700);
  };
  /*
   * A CARD NO WIDER THAN ITS SCREEN. Seedbed's plot card on a phone held a
   * column of facts and a column of relationships, 200 and 220 pixels, in
   * 293: its relationships ran past the card and the screen, cut off, and
   * the page never scrolled, so `breaks-at-width` had nothing to say (the
   * tenth walk). A card is judged where it is on the screen: laid out wider
   * than the screen, or holding what reaches past both its edge and the
   * screen's — unless that is a scroller of its own.
   */
  const CARD = "[data-graview-primitive=panel][data-graview-variant=card]";
  const scrollsWithin = (el, card) => {
    for (let at = el.parentElement; at && at !== card; at = at.parentElement) {
      // A row meant to scroll sideways: not a column that scrolls down (a browser makes either scroll both ways).
      const style = getComputedStyle(at);
      const sideways = style.overflowX === "auto" || style.overflowX === "scroll";
      const down = style.overflowY === "auto" || style.overflowY === "scroll";
      if ((sideways && !(down && at.scrollHeight > at.clientHeight + 1)) || at.hasAttribute("data-graview-scrolls")) return true;
    }
    return false;
  };
  const wide = () => {
    const width = document.documentElement.clientWidth;
    for (const card of document.querySelectorAll(CARD)) {
      if (card.closest("[hidden],[aria-hidden='true'],[inert]") || !visible(card)) continue;
      const box = card.getBoundingClientRect();
      // On the screen, and a card a person reads rather than a mark at altitude.
      if (box.right <= 0 || box.left >= width || box.width < width * 0.5) continue;
      let reach = box.right;
      let widest = null;
      for (const el of card.querySelectorAll("*")) {
        const at = el.getBoundingClientRect();
        if (at.width === 0 || at.height === 0 || at.right <= reach) continue;
        if (scrollsWithin(el, card)) continue;
        reach = at.right;
        widest = el;
      }
      const laidOut = card instanceof HTMLElement ? card.offsetWidth : box.width;
      if (laidOut > width + 1) {
        report("card-wider-than-screen", `${describe(card)} is laid out ${Math.round(laidOut)} pixels wide on a screen ${width} wide`, `${location.pathname}|${describe(card)}|${width}`);
      } else if (reach > width + 1 && reach > box.right + 1) {
        report("card-wider-than-screen", `${describe(card)} holds ${describe(widest)}, which reaches ${Math.round(reach - width)} pixels past the screen's edge at ${width} wide, cut off`, `${location.pathname}|${describe(card)}|${width}`);
      }
    }
  };
  const scan = () => {
    queued = false;
    sideways();
    /*
     * SIZES ARE JUDGED ON THE PAGE AS LAID OUT. While the document is still
     * loading, a stylesheet it waits on (a web font's) can hold back the
     * rest: WebKit drew the todo example's rows unstyled, a 16-pixel tick
     * beside the ask field, until its fonts arrived. Judged once it has.
     */
    if (document.readyState === "complete") small();
    else addEventListener("load", schedule, { once: true });
    /*
     * A scene still moving draws its cards over each other on the way: what
     * stands over what is judged where it settles, looked at again until it
     * has (a few times, for a scene that never stops).
     */
    if (document.querySelector(".graview-ground:not([data-graview-settled])")) {
      if (unsettled++ < 12) setTimeout(schedule, 500);
    } else {
      unsettled = 0;
      covered();
      wide();
    }
    if ((!pattern && !minted && unsaid.size === 0 && !unseen) || !document.body) return;
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
        if ((pattern || minted) && text && text.length > 2) {
          const hit = (pattern && pattern.exec(text)) || (minted && minted.exec(text));
          const el = node.parentElement;
          // An option of a closed picker is shown the moment it opens: judged whether or not it is drawn now.
          if (hit && el && !el.closest(UNSHOWN) && (el.closest("option") || visible(el))) {
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
          if (own && unsaid.has(own) && !declaredWhole.has(own) && (el.tagName === "OPTION" || visible(el))) {
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
    learn({ ids: learned, words: said, unsaid: plain = [], kinds: declaredKinds = [] }) {
      for (const id of learned) ids.add(id);
      for (const kind of declaredKinds) kinds.add(kind);
      for (const word of plain) unsaid.add(word);
      words.push(...said);
      for (const word of said) declaredWhole.add(word.trim());
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
    /* A store, once it holds its graph: the declaration's names, and who has signed what. */
    store(store) {
      const watch = window.__graviewWatch;
      watch.learn(namesOf(store));
      const authors = authorsOf(store);
      if (authors.length > 0) watch.learn({ ids: authors, words: [] });
    },
    /* A seat sat down at a surface (`from`), and again as the graph changes: what it may not see. */
    seat(store, principal, from) {
      const watch = window.__graviewWatch;
      const words = unseenOf(store, principal);
      if (words) watch.unseen({ words, ...(from ? { from } : {}) });
      const authors = authorsOf(store);
      if (authors.length > 0) watch.learn({ ids: authors, words: [] });
    },
    /*
     * AN ACT OFFERED WHOLE AND REFUSED BY ITS OWN INPUT (the twelfth walk).
     * A repair offered as one press answered "Not yet: Venue id — invalid
     * input"; the policy had not refused it, so nothing heard it. A form a
     * person filled wrongly is refused the same way and is not a fault: the
     * press's origin tells them apart — a submit from inside a form, or a
     * key in a box being typed in, is a person's answer; any other press is
     * the surface's offer.
     */
    refusedInput(refusal) {
      const origin = lastPress && Date.now() - lastPress.at < 4000 ? lastPress.target : null;
      if (origin && (origin.closest?.("form") || origin.matches?.(TEXT_ENTRY))) return;
      report(
        "offered-then-refused",
        `${refusal.author ?? "a seat"} reached "${refusal.mutation}"${origin ? ` from ${describe(origin)}` : ""} and its own input refused it: ${refusal.message}`,
        `input|${refusal.mutation}|${refusal.author ?? ""}`,
      );
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
  /* Where the last press came from, for a refusal by an act's own input to be told apart (`refusedInput`). */
  const pressed = (event) => {
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    lastPress = { target: event.type === "submit" ? event.target : event.target instanceof Element ? event.target : document.activeElement, at: Date.now() };
  };
  for (const type of ["click", "keydown", "submit"]) document.addEventListener(type, pressed, true);
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

  /*
   * THE APP'S ROOT DREW SOMETHING. The gauntlet's page module awaited
   * openStore at its top level, WebKit's 5 MB of localStorage did not hold
   * its seed, and the await rejected — and WebKit said nothing at all: no
   * pageerror, no error or unhandledrejection on the window, not even a
   * rejected import() of the same module (#330). Safari drew a blank page
   * and the watch passed it. What a rejected module leaves in every engine
   * is an app root with nothing in it, so that is what is judged: the root
   * an app mounts into (`#root`, what every app and `graview create` write),
   * some seconds after the page loaded, and asked again before it is said.
   * A harness's own host page mounts into a point of its own (`#app`) when
   * it chooses, and is not judged; a root left empty on purpose says so
   * (`data-graview-draws-nothing`).
   */
  const ROOTS = "#root";
  const empty = (root) => root.isConnected && !root.hasAttribute("data-graview-draws-nothing") && root.childElementCount === 0 && (root.textContent ?? "").trim() === "";
  const undrawn = () => [...document.querySelectorAll(ROOTS)].filter(empty);
  const drewNothing = () =>
    setTimeout(() => {
      if (undrawn().length === 0) return;
      setTimeout(() => {
        for (const root of undrawn()) {
          report(
            "app-drew-nothing",
            `the app's root <${root.tagName.toLowerCase()} id="${root.id}"> drew nothing in 8 seconds after the page loaded: its module threw, or its top-level await rejected, which WebKit raises no error for`,
            `${location.pathname}|${root.id}`,
          );
        }
      }, 3000);
    }, 5000);
  if (document.readyState === "complete") drewNothing();
  else addEventListener("load", drewNothing, { once: true });
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
    // The page's watch, and what it reads a store with beside it.
    await context.addInitScript({ content: `${spoken}\n${namesOf}\n${mintedIds}\n${unseenOf}\n${authorsOf}\n(${watchInPage})();` });
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
