// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";

// Every face fetched before the first mount, so each draws in the commit `mount` makes (FR-57).
beforeAll(() => preload());

/**
 * FR-25: the workbench in an embed says its name in a heading. axe's
 * `page-has-heading-one` failed on every embedded workbench, in both
 * schemes: a reader moving by headings found nothing. The host says what
 * level the embed's name is at — `1` when the page is the app.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const app = defineApp({ name: "Field notes", schema: createSchema([note]), mutations: [] });

async function mounted(options: Partial<EmbedOptions>, run: (host: HTMLElement) => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, fonts: false, ...options } as EmbedOptions);
  });
  try {
    run(host);
  } finally {
    await act(async () => handle!.unmount());
    host.remove();
  }
}

describe("the workbench names itself", () => {
  it("in an h1 when the host says the page is the app's", async () => {
    await mounted({ face: "scene", heading: 1 }, (host) => {
      expect([...host.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Field notes"]);
    });
  });

  it("in an h2 by default, by the embed's label", async () => {
    await mounted({ face: "scene", label: "The notes" }, (host) => {
      expect(host.querySelector("h1")).toBeNull();
      expect(host.querySelector("h2")?.textContent).toBe("The notes");
    });
  });

  it("not at all when the host's own heading names it, nor twice on the pages face", async () => {
    await mounted({ face: "scene", heading: false }, (host) => {
      expect([...host.querySelectorAll("h1, h2")].map((h) => h.textContent)).not.toContain("Field notes");
    });
    await mounted({ face: "pages", heading: 1 }, (host) => {
      expect(host.querySelectorAll("h1")).toHaveLength(1);
    });
  });
});
