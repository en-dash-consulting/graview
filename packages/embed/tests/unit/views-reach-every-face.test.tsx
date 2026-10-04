// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { DefaultView } from "@graview/primitives";
import { createViews, type ViewProps } from "@graview/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages } from "../../src/pages.js";

/**
 * What a host registers through `mount({ views })` draws on every face
 * (FR-35), over the defaults rather than instead of them (FR-36); and what
 * the declaration says as data draws with no views at all (FR-03).
 */
const category = defineNode("category", { fields: z.object({ name: z.string() }), plural: "Categories" });
const vendor = defineNode("vendor", {
  fields: z.object({ name: z.string(), status: z.enum(["researching", "booked"]) }),
  edges: { fills: { to: ["category"], cardinality: "one" } },
  plural: "Vendors",
});
const schema = createSchema([category, vendor]);
type S = typeof schema;
const app = defineApp({ name: "Vendors", schema, mutations: [] });
const seed = {
  nodes: [
    { id: "florist", kind: "category", name: "Florist" },
    { id: "bloom", kind: "vendor", name: "Bloom & Co", status: "booked" },
  ],
  edges: [{ id: "e1", kind: "fills", from: "bloom", to: "florist" }],
};

const Card = (props: ViewProps<S>) => <div data-testid="host-card">{String((props.node as { name?: string } | undefined)?.name)}</div>;
const Page = (props: ViewProps<S>) => (
  <div data-testid="host-page">
    <p>About {String((props.node as { name?: string } | undefined)?.name)}</p>
    <DefaultView<S> {...props} />
  </div>
);
const hostViews = (s: S) =>
  createViews(s).register("vendor", { cardinality: "one", fidelity: "summary" }, Card).register("vendor", { cardinality: "one", fidelity: "full" }, Page);

async function mounted(options: Partial<EmbedOptions<S>>, run: (host: HTMLElement, handle: EmbedHandle) => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount<S>(host, { app, seed, fonts: false, ...options } as EmbedOptions<S>);
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  try {
    run(host, handle!);
  } finally {
    await act(async () => handle!.unmount());
    host.remove();
  }
}

describe("views reach every face", () => {
  it("draws a view registered through mount({ views }) on the pages face's gallery", async () => {
    await mounted({ face: "pages", views: hostViews }, (host) => {
      expect(host.querySelector('[data-testid="kind-sheet"] [data-testid="host-card"]')?.textContent).toBe("Bloom & Co");
    });
  });

  it("draws a view registered through mount({ views }) on the record page, without the default twice", async () => {
    await mounted({ face: "pages", path: "/vendors/bloom", views: hostViews }, (host) => {
      const page = host.querySelector('[data-testid="record-view"] [data-testid="host-page"]');
      expect(page?.textContent).toContain("About Bloom & Co");
      // The record page IS the default record: the wrapped default draws nothing here.
      expect(page?.querySelector('[data-graview-primitive="panel"]')).toBeNull();
      expect(host.querySelectorAll("h1")).toHaveLength(1);
    });
  });

  it("keeps every default mount({ views }) does not override", async () => {
    await mounted({ face: "pages", views: hostViews }, (host) => {
      // Categories were not touched: their sheet is the framework's own summary cards, not bare chips.
      const card = [...host.querySelectorAll('[data-testid="kind-card"]')].find((one) => one.textContent?.includes("Categories"));
      const sheet = card?.querySelector('[data-testid="kind-sheet"]');
      expect(sheet).toBeTruthy();
      expect(sheet!.querySelector('[data-graview-primitive="panel"]')).not.toBeNull();
    });
  });

  it("hands the views function the defaults to register over", async () => {
    let handed: unknown;
    await mounted(
      {
        face: "pages",
        views: (_s, registry) => {
          handed = registry?.lookup("category", { cardinality: "one", fidelity: "summary" });
          return registry!.register("vendor", { cardinality: "one", fidelity: "summary" }, Card);
        },
      },
      (host) => {
        expect(handed).toBeTypeOf("function");
        expect(host.querySelector('[data-testid="host-card"]')).not.toBeNull();
      },
    );
  });

  it("draws the declaration's view specs with no views at all", async () => {
    const specified = defineApp({ name: "Vendors", schema, mutations: [], viewSpecs: { vendor: { card: [{ title: "{name}" }, { badge: "{status}", tone: "good" }] } } });
    await mounted({ app: specified, face: "pages" }, (host) => {
      expect(host.querySelector('[data-graview-spec="card"] [data-graview-tone="good"]')?.textContent).toBe("booked");
    });
  });

  it("draws a view registered through views on the pages-only embed too", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: { unmount(): void } | undefined;
    await act(async () => {
      handle = mountPages<S>(host, { app, seed, fonts: false, views: hostViews });
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    try {
      expect(host.querySelector('[data-testid="kind-sheet"] [data-testid="host-card"]')?.textContent).toBe("Bloom & Co");
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
    }
  });
});
