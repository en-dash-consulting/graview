// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, Store, z, type Principal } from "@graview/core";
import { act } from "react";
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, preload } from "../../src/index.js";

// Every face fetched before the first mount, so each draws in the commit `mount` makes (FR-57).
beforeAll(() => preload());

/**
 * PEOPLE ARE NAMED WITHOUT BEING OFFERED AS SEATS (FR-13).
 *
 * A hosted app names its members in the rail and the pages, and the only
 * way to give the embed a name was to make the person a seat. Cloud passed
 * every member as one, and every reader was offered "As …" and "Sit as
 * somebody else" — in a hosted app the seat is who you signed in as. And
 * the seats were fixed at mount, so an agent who first acted after the page
 * opened stayed "somebody" until a remount.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: args.id, kind: "task", label: args.label }),
  describe: (args) => `Added ${args.label}`,
});
const app = defineApp({ name: "Errands", schema, mutations: [add] });
const me: Principal = { kind: "human", id: "acct_me", roles: ["member"] };

const mounted: { handle: EmbedHandle; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const { handle, host } of mounted.splice(0)) {
    await act(async () => handle.unmount());
    host.remove();
  }
});
async function mounting(options: Omit<Parameters<typeof mount>[1], "app">) {
  const host = document.createElement("div");
  document.body.append(host);
  let handle!: EmbedHandle;
  await act(async () => {
    handle = mount(host, { app: app as never, fonts: false, ...options });
  });
  mounted.push({ handle, host });
  return { handle, host };
}

describe("a people directory", () => {
  it("names authors the app has no record of, and names a newcomer once the host does", async () => {
    const store = new Store({ schema, mutations: [add], invariants: [] });
    store.apply({ name: "add-task", args: { id: "t1", label: "Post the letter" } }, { author: { kind: "human", id: "acct_7f3" } });
    const { handle, host } = await mounting({ store: store as never, face: "pages", principal: me, people: [{ id: "acct_7f3", name: "Nick Daniel" }] });
    expect(host.textContent).toContain("Added Post the letter — Nick Daniel");

    // An agent acts after the page opened: "an agent", until the host names it.
    await act(async () => void store.apply({ name: "add-task", args: { id: "t2", label: "Water the fern" } }, { author: { kind: "agent", id: "agent_42" } }));
    expect(host.textContent).toContain("Added Water the fern — an agent");
    await act(async () =>
      handle.setPeople([
        { id: "acct_7f3", name: "Nick Daniel" },
        { id: "agent_42", name: "Claude", kind: "agent" },
      ]),
    );
    expect(host.textContent).toContain("Added Water the fern — Claude");
  });
});

describe("a hosted reader", () => {
  it("is offered no seat switcher and no sitting as somebody else, however many people are named", async () => {
    const people = [
      { id: "acct_me", name: "Me" },
      { id: "acct_7f3", name: "Nick Daniel" },
      { id: "acct_9aa", name: "Ana Ruiz" },
    ];
    const { handle, host } = await mounting({ seed: { nodes: [], edges: [] }, face: "graview", principal: me, people, seats: [{ label: "Me", principal: me }] });
    expect(host.querySelector("[data-testid=embed-seats]")).toBeNull();
    const profile = host.querySelector<HTMLButtonElement>("[data-testid=profile-button]");
    expect(profile).not.toBeNull();
    await act(async () => profile!.click());
    expect(host.textContent).toContain("Me");
    expect(host.textContent).not.toContain("Sit as somebody else");
    expect(host.querySelector("[data-testid=seats]")).toBeNull();

    // Seats a host does offer can arrive after mount, and only then is there a choice.
    await act(async () =>
      handle.setSeats([
        { label: "Me", principal: me },
        { label: "A visitor", principal: { kind: "human", id: "visitor" } },
      ]),
    );
    expect(host.querySelector("[data-testid=embed-seats]")).not.toBeNull();
  });
});
