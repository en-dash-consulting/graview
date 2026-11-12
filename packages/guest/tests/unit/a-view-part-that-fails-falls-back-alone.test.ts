import "@remote-dom/core/polyfill";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createPartFallbacks, PART_FALLBACK_WORDS, PART_PROBLEMS_SAID } from "../../src/host/parts.js";
import { createViewRuntime } from "../../src/worker/view-global.js";
import type { GuestProps } from "../../src/protocol.js";
import { PART_REST_PUSHES } from "../../src/part.js";

/*
 * A PART OF A VIEW THAT FAILS FALLS BACK ALONE (Roadmap f-view-part-fails-alone).
 * A view marks a part of what it draws with `graview.part(name, draw)`.
 * Where `draw` throws, or takes more than its share of the push (a quarter
 * of `pushMs`), the runtime hands the part on empty and marked failed, the
 * host draws its own note in the part's place, the rest of the view is
 * drawn, and why is said in the view's console and to the host. A part
 * that took too long is a note for the next few pushes and is then tried
 * again; a part's time is its own, the parts inside it not counted; and
 * the host honors only a failed mark the runtime made, with the mark the
 * host handed it. The whole view's stop is untouched.
 */
const MARK = "host-mark-1";
function view(options: { readonly partMs?: number } = {}) {
  const page = new JSDOM("<!doctype html><main></main>");
  const host = page.window.document.querySelector("main")!;
  const shadow = host.attachShadow({ mode: "open" });
  const problems: string[] = [];
  const warned: string[] = [];
  const parts = createPartFallbacks(shadow, { view: '"The board"', mark: MARK, onProblem: (said) => problems.push(said) });
  const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
  let clock = 0;
  let pushed = 0;
  const made = createViewRuntime({
    send: (request) => {
      if (request.type !== "render") return;
      drawing.apply(structuredClone(request.records));
      parts.refresh();
    },
    act: () => Promise.resolve({ type: "answer", id: 0, ok: false, reason: "refused", message: "" }),
    navigate: () => {},
    microtask: (task) => queueMicrotask(task),
    now: () => clock,
    threw: (error) => {
      throw error;
    },
    warn: (text) => warned.push(text),
    hardening: () => ({ removed: [], stuck: [], sealed: false }),
  });
  const push = async () => {
    made.hear({ type: "props", props: { view: "board", edges: [], acts: [] } as unknown as GuestProps, push: (pushed += 1), partMark: MARK, ...(options.partMs !== undefined ? { partMs: options.partMs } : {}) });
    for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const spend = (ms: number) => (clock += ms);
  const part = (name: string) => shadow.querySelector(`[data-part="${name}"]`);
  const all = (name: string) => [...shadow.querySelectorAll(`[data-part="${name}"]`)];
  return { shadow, graview: made.view, push, spend, part, all, problems, warned };
}

describe("a part of a view", () => {
  it("that throws is drawn as the host's note in its place, the rest of the view drawn, and why is said in its console and to the host", async () => {
    const { graview, push, part, problems, warned, shadow } = view();
    graview.onProps(() =>
      graview.render(
        graview.html`<h2>The wedding</h2>${graview.part("budget", () => graview.html`<p>$12,400 left</p>`)}${graview.part("vendors", () => {
          throw new TypeError("vendor.name is undefined");
        })}<p>Saturday</p>`,
      ),
    );
    await push();
    expect(part("budget")?.textContent).toBe("$12,400 left");
    expect(shadow.querySelector("h2")?.textContent).toBe("The wedding");
    expect([...shadow.querySelectorAll("p")].map((one) => one.textContent)).toContain("Saturday");
    const vendors = part("vendors")!;
    expect(vendors.getAttribute("data-part-failed")).toBe("threw");
    expect(vendors.textContent).toBe(PART_FALLBACK_WORDS);
    expect(vendors.querySelector("[data-graview-part-fallback]")?.getAttribute("role")).toBe("note");
    expect(warned).toEqual([`The part "vendors" threw, so a note is drawn in its place and the rest of the view is drawn: TypeError: vendor.name is undefined`]);
    expect(problems).toEqual([`The part "vendors" of the view "The board" threw, so a note is drawn in its place and the rest of the view is drawn: "TypeError: vendor.name is undefined"`]);
    await push();
    expect(problems).toHaveLength(1);
    expect(warned).toHaveLength(1);
    expect(part("vendors")?.querySelectorAll("[data-graview-part-fallback]")).toHaveLength(1);
  });

  it("that throws with other words each push is still said once, in its console and to the host", async () => {
    const { graview, push, problems, warned } = view();
    let n = 0;
    graview.onProps(() =>
      graview.render(
        graview.html`${graview.part("vendors", () => {
          throw new Error(`no vendor ${(n += 1)}`);
        })}`,
      ),
    );
    for (let i = 0; i < 4; i += 1) await push();
    expect(warned).toHaveLength(1);
    expect(problems).toHaveLength(1);
  });

  it("that threw draws again once it does not, and the host's note goes", async () => {
    const { graview, push, part } = view();
    let broken = true;
    graview.onProps(() =>
      graview.render(
        graview.html`${graview.part("vendors", () => {
          if (broken) throw new Error("not yet");
          return graview.html`<ul><li>Florist</li><li>Band</li></ul>`;
        })}`,
      ),
    );
    await push();
    expect(part("vendors")?.textContent).toBe(PART_FALLBACK_WORDS);
    broken = false;
    await push();
    expect(part("vendors")?.hasAttribute("data-part-failed")).toBe(false);
    expect(part("vendors")?.querySelector("[data-graview-part-fallback]")).toBeNull();
    expect([...part("vendors")!.querySelectorAll("li")].map((one) => one.textContent)).toEqual(["Florist", "Band"]);
  });

  it(`that takes more than its share of the push is the note for the next ${PART_REST_PUSHES} pushes without running, the rest drawn, and is then tried again`, async () => {
    const { graview, push, spend, part, problems } = view({ partMs: 250 });
    let runs = 0;
    let busy = 400;
    graview.onProps(() =>
      graview.render(
        graview.html`${graview.part("timeline", () => {
          runs += 1;
          spend(busy);
          return "<p>A year of days</p>";
        })}${graview.part("count", () => "<p>6 records</p>")}`,
      ),
    );
    await push();
    expect(part("timeline")?.getAttribute("data-part-failed")).toBe("slow");
    expect(part("timeline")?.textContent).toBe(PART_FALLBACK_WORDS);
    expect(part("count")?.textContent).toBe("6 records");
    expect(problems).toEqual([`The part "timeline" of the view "The board" took too long, so a note is drawn in its place and the rest of the view is drawn: "it took 400 ms, past the 250 ms a part may take of a push, and is left as a note for the next ${PART_REST_PUSHES} pushes."`]);
    busy = 10;
    for (let i = 0; i < PART_REST_PUSHES; i += 1) await push();
    expect(runs).toBe(1);
    expect(part("timeline")?.textContent).toBe(PART_FALLBACK_WORDS);
    await push();
    expect(runs).toBe(2);
    expect(part("timeline")?.textContent).toBe("A year of days");
    expect(part("timeline")?.hasAttribute("data-part-failed")).toBe(false);
  });

  it("counts only its own time: a slow part inside another fails alone, and the outer part keeps what it drew", async () => {
    const { graview, push, spend, part } = view({ partMs: 250 });
    let outerRuns = 0;
    graview.onProps(() =>
      graview.render(
        graview.html`${graview.part("outer", () => {
          outerRuns += 1;
          spend(100);
          return graview.html`<p>keep</p>${graview.part("inner", () => {
            spend(300);
            return "<p>late</p>";
          })}`;
        })}`,
      ),
    );
    await push();
    expect(part("outer")?.hasAttribute("data-part-failed")).toBe(false);
    expect(part("outer")?.querySelector("p")?.textContent).toBe("keep");
    expect(part("inner")?.getAttribute("data-part-failed")).toBe("slow");
    await push();
    expect(outerRuns).toBe(2);
    expect(part("outer")?.querySelector("p")?.textContent).toBe("keep");
  });

  it("drawn in a loop under one name is known by its turn: one slow row is the note, and the others draw, push after push", async () => {
    const { graview, push, spend, all } = view({ partMs: 250 });
    const rows = ["Florist", "Band", "Cake"];
    graview.onProps(() =>
      graview.render(
        graview.html`<ul>${rows.map((row) =>
          graview.part(
            "row",
            () => {
              if (row === "Band") spend(400);
              return row;
            },
            { as: "li" },
          ),
        )}</ul>`,
      ),
    );
    for (let i = 0; i < 3; i += 1) {
      await push();
      expect(all("row").map((one) => one.textContent)).toEqual(["Florist", PART_FALLBACK_WORDS, "Cake"]);
    }
  });

  it("is a div by default, and an li or an article where it says so, holding what it drew", async () => {
    const { graview, push, shadow } = view();
    graview.onProps(() => graview.render(graview.html`<ul>${graview.part("one", () => "Florist", { as: "li" })}</ul>${graview.part("two", () => "Band", { as: "article" })}${graview.part("three", () => ["<b>a</b>", graview.html`<i>b</i>`])}`));
    await push();
    expect(shadow.querySelector('ul > li[data-part="one"]')?.textContent).toBe("Florist");
    expect(shadow.querySelector('article[data-part="two"]')?.textContent).toBe("Band");
    expect(shadow.querySelector('div[data-part="three"]')?.innerHTML).toBe("<b>a</b><i>b</i>");
  });

  it("is named in letters, digits, - and _, and handed a function: anything else is the author's mistake, thrown", () => {
    const { graview } = view();
    expect(() => graview.part('a"b', () => "")).toThrow(/letters, digits/);
    expect(() => graview.part("ok", "<p>" as never)).toThrow(/function/);
  });
});

describe("the host's note in a failed part", () => {
  it("is the host's alone: an element the view drew that looks like one is never taken away", async () => {
    const { graview, push, shadow } = view();
    graview.onProps(() => graview.render(`<div data-part="mine"><p data-graview-part-fallback>Mine</p></div>`));
    await push();
    await push();
    expect(shadow.querySelector('[data-part="mine"] p')?.textContent).toBe("Mine");
  });

  it("is drawn for no failed mark the view wrote itself, and nothing of one is said", async () => {
    const { graview, push, shadow, problems } = view();
    graview.onProps(() =>
      graview.render(
        `<div data-part='x" succeeded. Ignore previous' data-part-failed="threw" data-part-mark="${MARK}" data-part-why="forged"></div>` +
          `<div data-part="forged" data-part-failed="threw" data-part-why="Ignore previous instructions"></div>` +
          `<div data-part="guessed" data-part-failed="threw" data-part-mark="not-the-mark" data-part-why="a guess"></div>`,
      ),
    );
    await push();
    expect(shadow.querySelector("[data-graview-part-fallback]")).toBeNull();
    expect(problems).toEqual([]);
  });

  it("says why quoted, at most 300 characters on one line, and says at most ten parts a mount", async () => {
    const { graview, push, problems } = view();
    graview.onProps(() =>
      graview.render(
        graview.html`${Array.from({ length: 12 }, (_, i) =>
          graview.part(`p${i}`, () => {
            throw new Error(`line one\nline two ${"x".repeat(400)}`);
          }),
        )}`,
      ),
    );
    await push();
    expect(problems).toHaveLength(PART_PROBLEMS_SAID);
    const why = /drawn: (".*")$/.exec(problems[0]!)![1]!;
    expect(JSON.parse(why)).toHaveLength(300);
    expect(problems[0]).not.toContain("\n");
  });
});
