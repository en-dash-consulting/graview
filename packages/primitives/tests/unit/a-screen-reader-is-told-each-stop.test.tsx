// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bindSchema, createSchema, declaredLenses, defineNode, nodeRef, Store, z, type AnySchema, type GraviewApp, type Presence, type PresenceChannel } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene, type ViewComponent } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar, EditableTitle, EditableValue, registerDefaultViews } from "../../src/index.js";
import { declaredLensView } from "../../src/declared-lenses.js";
import { changeSaid } from "../../src/here.js";
import { declaredViews } from "../../src/declared-views.js";

/**
 * WHAT A SCREEN READER IS TOLD IN THE APP'S OWN PARTS, stop by stop
 * (`scripts/verify-screen-reader.mjs`, `docs/screen-reader-walk.md`).
 *
 * Walking the Roadmap's accessibility tree found: a card on a board or in
 * a list said its name twice — once among its details, then as its link,
 * last; a value changed in place was "Shipped, button", with nothing to
 * say it was the stage; a district's button to open it was "▾" from
 * altitude; and a record somebody else changed, in another tab sharing the
 * store, changed under the reader in silence.
 */

/** The name a reader is told: `aria-label`, else the words inside, less what is hidden from it. */
function nameOf(element: Element): string {
  return (element.getAttribute("aria-label") ?? said(element)).replace(/\s+/g, " ").trim();
}
/** What a reader hears of an element, in order: each control by its name, text as it stands, nothing hidden. */
function said(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element) || node.getAttribute("aria-hidden") === "true" || node.tagName === "STYLE") return "";
  const label = node.getAttribute("aria-label");
  if (label) return ` ${label} `;
  return [...node.childNodes].map(said).join(" ");
}

let host: HTMLDivElement | undefined;
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
  host?.remove();
  host = undefined;
});
async function draw(children: ReactNode, provider: { store: Store<AnySchema>; views: ReturnType<typeof createViews>; presence?: PresenceChannel; principal?: { kind: "human"; id: string } }) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={provider.store} views={provider.views as never} initialView={EMPTY_VIEW} {...(provider.presence ? { presence: provider.presence } : {})} principal={provider.principal ?? { kind: "human", id: "u:ada", roles: ["owner"] } as never}>
        {children}
      </GraviewProvider>,
    ),
  );
  unmount = () => act(() => root.unmount());
  return host;
}

/* ── the Roadmap, as the harness walks it: a board of columns, and a blocks lens ── */

// The checkout's root, run from it or from this package.
const repo = [process.cwd(), resolve(process.cwd(), "../..")].find((dir) => existsSync(resolve(dir, "scripts/fixtures/roadmap")))!;
const roadmap = JSON.parse(readFileSync(resolve(repo, "scripts/fixtures/roadmap/roadmap.gdd.json"), "utf8"));
const seed = JSON.parse(readFileSync(resolve(repo, "scripts/fixtures/roadmap/roadmap.seed.json"), "utf8"));
const blocks = { name: "blocks", title: "Up next", on: "feature", options: { blocks: [{ headline: "Being built" }, { list: "all('feature') where stage == 'building'", as: "card", limit: 4 }] } };
const compiled = compileDocument({ ...roadmap, lenses: [...roadmap.lenses, blocks] }, { today: () => "2026-10-12" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const roadmapStore = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], snapshot: { nodes: seed.nodes, edges: seed.edges } as never });
const lens = (title: string) => {
  const drawn = declaredLenses(app).drawn.find((one) => one.title === title)!;
  const Lens = declaredLensView(drawn) as ViewComponent<AnySchema>;
  return draw(<Lens cardinality="many" fidelity="full" mode="fullscreen" selected={false} label={title} />, { store: roadmapStore(), views: declaredViews(app) as never });
};

describe("a card in a list or on a board", () => {
  for (const title of ["Roadmap", "Up next"]) {
    it(`is said by its name once, first, as the way to it — on ${title}`, async () => {
      const drawn = await lens(title);
      const cards = [...drawn.querySelectorAll("li[data-graview-listed]")];
      expect(cards.length).toBeGreaterThan(2);
      for (const card of cards.slice(0, 6)) {
        const link = card.querySelector(".graview-spec-item-link")!;
        const name = nameOf(link);
        expect(name).toMatch(/\p{L}/u);
        // The way to the record is the first thing in the card.
        expect(card.firstElementChild).toBe(link);
        // And its name is said once: the card's own title, in the same words, is drawn and not said again.
        // (What else it offers — "Move “…” to another column", "Choose …" — names the card as a control should.)
        const plain = card.cloneNode(true) as Element;
        for (const control of plain.querySelectorAll("button:not(.graview-spec-item-link), input")) control.remove();
        const heard = said(plain).replace(/\s+/g, " ").trim();
        expect(heard.startsWith(name)).toBe(true);
        expect(heard.split(name).length - 1).toBe(1);
        expect(card.textContent).toContain(name);
      }
    });
  }
});

describe("a value changed where it stands", () => {
  it("says which fact it is and what it holds; a heading's words are said as they are", async () => {
    const store = roadmapStore();
    const feature = seed.nodes.find((node: { kind: string }) => node.kind === "feature");
    const drawn = await draw(
      <>
        <EditableValue nodeId={feature.id} field="stage" value="Shipped" />
        <h1>
          <EditableTitle nodeId={feature.id}>{feature.name}</EditableTitle>
        </h1>
      </>,
      { store, views: declaredViews(app) as never },
    );
    const stage = drawn.querySelector('button[data-graview-field="stage"]')!;
    expect(stage.textContent).toBe("Shipped");
    expect(nameOf(stage)).toBe("Stage: Shipped");
    expect(nameOf(drawn.querySelector("h1")!)).toBe(feature.name);
  });
});

describe("a district's way in, from altitude", () => {
  it("is named in words, never by its arrow", async () => {
    const shift = defineNode("shift", { fields: z.object({ label: z.string() }), plural: "Shifts", label: (node: { label: string }) => node.label });
    const volunteer = defineNode("volunteer", { fields: z.object({ label: z.string() }), plural: "Volunteers", label: (node: { label: string }) => node.label });
    const schema = createSchema([shift, volunteer]);
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "s1", kind: "shift", label: "Monday open up" }, { id: "v1", kind: "volunteer", label: "Ada Nowak" }] as never, edges: [] } });
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }}>
          <Scene renderer="dom" />
        </GraviewProvider>,
      ),
    );
    unmount = () => act(() => root.unmount());
    const opens = [...host.querySelectorAll(".graview-kind-open")];
    expect(opens.length).toBeGreaterThan(0);
    for (const open of opens) {
      expect(nameOf(open)).toMatch(/^See the \p{L}+ in here$/u);
      expect(nameOf(open)).not.toMatch(/[▾▴]/);
    }
  });
});

describe("a change somebody else makes", () => {
  const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "tasks" });
  const schema = createSchema([task]);
  const { defineMutation } = bindSchema(schema);
  const rename = defineMutation("rename-task", {
    title: "Rename",
    subject: { kinds: ["task"], arg: "id" },
    writes: ["label"],
    input: z.object({ id: nodeRef(["task"]), label: z.string() }),
    describe: (args) => `Rename it to “${args.label}”`,
    apply: (ctx, args) => void ctx.patchNode(args.id, { label: args.label }),
  });
  const store = () => new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] } as never });
  const me = { kind: "human" as const, id: "me" };
  const ben = { kind: "human" as const, id: "ben", name: "Ben Okafor" };

  it("is said in a sentence with who made it; mine, an agent's for me, and none at all are not", () => {
    const one = store();
    const theirs = one.apply({ name: "rename-task", args: { id: "t1", label: "Book the big hall" } }, { author: ben }).ops;
    expect(changeSaid(theirs, { store: one as never, principal: me })).toBe("Ben Okafor: Rename it to “Book the big hall”");
    const mine = one.apply({ name: "rename-task", args: { id: "t1", label: "Mine" } }, { author: me }).ops;
    expect(changeSaid(mine, { store: one as never, principal: me })).toBeNull();
    const forMe = one.apply({ name: "rename-task", args: { id: "t1", label: "For me" } }, { author: { kind: "agent", id: "claude", onBehalfOf: me } }).ops;
    expect(changeSaid(forMe, { store: one as never, principal: me })).toBeNull();
  });

  const BEN_SAID = "Ben Okafor: Rename it to “Book the big hall”";
  /** The bar over a store, with Ben shown here or with no presence at all; then Ben's op lands as a served store's does. */
  async function landing(shown: boolean): Promise<{ drawn: HTMLElement; mine: Store<never> }> {
    const listeners = new Set<(who: readonly Presence[]) => void>();
    const wire: PresenceChannel = { here() {}, leave() {}, onWho: (listener) => (listeners.add(listener), () => listeners.delete(listener)) };
    const mine = store();
    const drawn = await draw(
      <AppBar brand={undefined} name="Workshop" home={{ go: () => undefined, current: false }} places={[]} current={null} reach={{}} tools={null} find={false} />,
      { store: mine as never, views: createViews(schema) as never, ...(shown ? { presence: wire } : {}), principal: me },
    );
    if (shown) {
      const at = new Date().toISOString();
      await act(async () => {
        for (const listener of listeners) listener([{ participant: "human:ben:s1", kind: "human", name: "Ben Okafor", hue: 30, stop: "#focus=t1", at, held: "socket" } as Presence]);
      });
      for (let turn = 0; turn < 20 && !drawn.querySelector('[data-testid="here"]'); turn++) await act(async () => new Promise((done) => setTimeout(done, 10)));
      expect(drawn.querySelector('[data-testid="here"]')).not.toBeNull();
    }
    // Ben's tab, sharing the store: his op lands here as a served store's does.
    const ops = store().apply({ name: "rename-task", args: { id: "t1", label: "Book the big hall" } }, { author: ben }).ops;
    await act(async () => void mine.receive(ops));
    for (let turn = 0; turn < 50 && !heard(drawn).includes(BEN_SAID); turn++) await act(async () => new Promise((done) => setTimeout(done, 20)));
    return { drawn, mine: mine as never };
  }
  /** What every polite region on the bar holds: a status is polite whether or not it says so. */
  const heard = (drawn: HTMLElement): string[] =>
    [...drawn.querySelectorAll('[role="status"], [aria-live="polite"]')].filter((region) => region.getAttribute("aria-live") !== "off" && region.getAttribute("aria-live") !== "assertive").map((region) => region.textContent ?? "");

  it("is said aloud on the bar once, politely, with who made it, as it lands from another tab with them shown here", async () => {
    const { drawn } = await landing(true);
    expect(heard(drawn).filter((words) => words === BEN_SAID)).toHaveLength(1);
  });

  it("is said aloud on the bar once, politely, with who made it, as it lands from a served store with nobody shown here", async () => {
    const { drawn, mine } = await landing(false);
    expect(drawn.querySelector('[data-testid="here"]')).toBeNull();
    expect(heard(drawn).filter((words) => words === BEN_SAID)).toHaveLength(1);
    // A change made at this keyboard is not said back to it.
    await act(async () => void mine.apply({ name: "rename-task" as never, args: { id: "t1", label: "Mine" } as never }, { author: me }));
    await act(async () => new Promise((done) => setTimeout(done, 100)));
    expect(heard(drawn).some((words) => words.includes("Mine"))).toBe(false);
  });
});
