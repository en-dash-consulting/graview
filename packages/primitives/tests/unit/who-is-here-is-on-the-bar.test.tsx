// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, z, type Presence, type PresenceChannel } from "@graview/core";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar } from "../../src/index.js";
import { hereSaid, othersHere, whereSaid } from "../../src/here.js";

/**
 * WHO IS HERE IS ON THE BAR, ON BOTH FACES AND A PHONE (FR-155).
 *
 * Graview Cloud, after 0.1.20 (Nick: "i can't always see who's on
 * actively"): presence was drawn as figures on the scene and nowhere on
 * Pages or a phone, so Cloud stood a stack of its own under the bar. The
 * one bar draws it now, from the presence the provider holds: a letter per
 * person ringed in their hue, an agent said for whom it acts, viewers not
 * signed in counted, the names and where each one is on a press, said
 * politely, and nothing at all when nobody else is here.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "tasks" });
const schema = createSchema([task]);
const store = () => new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] } as never });

const at = new Date().toISOString();
const ada: Presence = { participant: "human:ada:s1", kind: "human", name: "Ada Lovelace", hue: 30, stop: "#focus=t1", at, held: "socket" };
const claude: Presence = { participant: "agent:claude:visit", kind: "agent", name: "Claude", onBehalfOf: "ada", onBehalfOfName: "Ada", hue: 200, stop: "#focus=aggregate:task", at, held: "socket" };
const viewer: Presence = { participant: "human::anon1", kind: "human", hue: 90, stop: "#", at, held: "socket" };
const meElsewhere: Presence = { participant: "human:me:other-tab", kind: "human", name: "Me", hue: 10, stop: "#", at, held: "socket" };

function channel(): PresenceChannel & { say(who: readonly Presence[]): void } {
  const listeners = new Set<(who: readonly Presence[]) => void>();
  return {
    here() {},
    leave() {},
    onWho(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    say(who) {
      for (const listener of listeners) listener(who);
    },
  };
}

let host: HTMLDivElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});

describe("who is here, in words (FR-155)", () => {
  it("is everybody but this reader, in any tab of theirs, each person once however many tabs they have open", () => {
    const later = new Date(Date.parse(at) + 1000).toISOString();
    const who = new Map(
      [ada, claude, viewer, { ...viewer, participant: "human::anon2" }, meElsewhere, { ...ada, participant: "human:ada:s2", stop: "#overview=1", at: later }, { ...ada, participant: "human:me:x:s2", name: "Somebody whose id has a colon" }].map((one) => [one.participant, one]),
    );
    const others = othersHere(who, { kind: "human", id: "me" });
    expect(others.map((one) => one.participant)).toEqual(["human:ada:s2", "agent:claude:visit", "human::anon1", "human::anon2", "human:me:x:s2"]);
  });

  it("says each by name, an agent for whom it acts, and the rest counted", () => {
    expect(hereSaid([ada])).toBe("Ada Lovelace is here");
    expect(hereSaid([ada, claude, viewer, { ...viewer, participant: "human::anon2" }])).toBe("Ada Lovelace, Claude, for Ada and 2 viewers are here");
    expect(hereSaid([viewer])).toBe("1 viewer is here");
  });

  it("says where each one is in the declaration's words, never an id, and nothing of what this reader may not see", () => {
    const words = (stop: string, hidden: ReadonlySet<string> = new Set()) => whereSaid(stop, { store: store() as never, principal: { kind: "human", id: "me" }, hidden, pictures: [{ kind: "task", as: "board", title: "The week's board" }] });
    expect(words("#focus=t1")).toBe("Book the hall");
    expect(words("#focus=aggregate:task")).toBe("Tasks");
    expect(words("#focus=aggregate:task&in.view=board")).toBe("The week's board");
    expect(words("#overview=1")).toBe("the whole thing");
    expect(words("#focus=nobody-knows")).toBeNull();
    expect(words("#")).toBeNull();
    expect(words("#focus=aggregate:task", new Set(["task"]))).toBeNull();
    expect(words("#focus=t1", new Set(["task"]))).toBeNull();
  });
});

describe("who is here, on the bar (FR-155)", () => {
  async function bar(scene: boolean) {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const wire = channel();
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={createViews(schema)} presence={wire} principal={{ kind: "human", id: "me" }}>
          <AppBar
            brand={undefined}
            name="Workshop"
            home={{ go: () => undefined, current: false }}
            faces={{ scene: { label: "Scene", current: scene, go: () => undefined }, pages: { label: "Pages", current: !scene, go: () => undefined } }}
            places={[]}
            current={null}
            reach={{}}
            tools={null}
            find={false}
          />
        </GraviewProvider>,
      ),
    );
    return { root, wire, at: host };
  }
  const settle = async () => {
    // The list is fetched once somebody is here: let it arrive.
    for (let turn = 0; turn < 20 && !host!.querySelector('[data-testid="here"]'); turn++) await act(async () => new Promise((done) => setTimeout(done, 10)));
  };

  it("draws nothing while this reader is alone, or only with themselves in another tab", async () => {
    const { root, wire, at } = await bar(false);
    expect(at.querySelector('[data-testid="here"]')).toBeNull();
    await act(async () => wire.say([meElsewhere]));
    await act(async () => new Promise((done) => setTimeout(done, 50)));
    expect(at.querySelector('[data-testid="here"]')).toBeNull();
    act(() => root.unmount());
  });

  it("draws a letter for each of the others in their hue, an agent as a square, counts the rest, and says it politely", async () => {
    const { root, wire, at } = await bar(false);
    await act(async () => wire.say([ada, claude, viewer]));
    await settle();
    const here = at.querySelector('[data-testid="here"]')!;
    expect(here).not.toBeNull();
    // On the bar's own row, among its tools.
    expect(here.closest(".graview-bar-tools")).not.toBeNull();
    const marks = [...here.querySelectorAll('[data-testid="here-open"] .graview-here-mark')];
    expect(marks.map((one) => one.textContent)).toEqual(["A", "C"]);
    expect(marks[1]!.hasAttribute("data-agent")).toBe(true);
    expect((marks[0] as HTMLElement).style.getPropertyValue("--graview-hue")).toBe("30");
    expect(here.querySelector('[data-testid="here-open"] > [aria-hidden="true"]:last-child')?.textContent).toBe("+1");
    const status = here.querySelector('[role="status"]')!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Ada Lovelace, Claude, for Ada and 1 viewer are here");
    expect(here.querySelector('[data-testid="here-open"]')!.getAttribute("aria-label")).toBe("Ada Lovelace, Claude, for Ada and 1 viewer are here — who and where");
    // No pill: the marks are the person's own letter in a circle, nothing around them.
    const css = here.querySelector("style")!.textContent ?? "";
    expect(css).not.toMatch(/border-radius:999px/);
    // Gone, and the bar says nothing.
    await act(async () => wire.say([]));
    expect(at.querySelector('[data-testid="here"]')).toBeNull();
    act(() => root.unmount());
  });

  it("lists, on a press, each by name and where each one is; on Pages a name says, on the scene it goes where they are", async () => {
    const pages = await bar(false);
    await act(async () => pages.wire.say([ada, claude, viewer]));
    await settle();
    act(() => pages.at.querySelector<HTMLButtonElement>('[data-testid="here-open"]')!.click());
    const list = pages.at.querySelector('[data-testid="here-list"]')!;
    expect(list.hasAttribute("hidden")).toBe(false);
    expect([...list.querySelectorAll('[data-testid="here-one"]')].map((one) => one.textContent)).toEqual(["AAda LovelaceOn Book the hall", "CClaude, for AdaOn Tasks"]);
    expect(list.querySelector('[data-testid="here-viewers"]')?.textContent).toBe("11 viewerNot signed in");
    expect(list.querySelector("button")).toBeNull();
    act(() => pages.root.unmount());
    host?.remove();

    const scene = await bar(true);
    await act(async () => scene.wire.say([ada]));
    await settle();
    act(() => scene.at.querySelector<HTMLButtonElement>('[data-testid="here-open"]')!.click());
    const go = scene.at.querySelector<HTMLButtonElement>('[data-testid="here-list"] button[data-testid="here-one"]')!;
    expect(go.title).toBe("Go where Ada Lovelace is");
    act(() => scene.root.unmount());
  });
});
