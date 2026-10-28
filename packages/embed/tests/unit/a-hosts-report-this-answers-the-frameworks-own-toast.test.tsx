// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, FRAMEWORK_VERSION, z } from "@graview/core";
import { frameworkVoice } from "@graview/primitives/frame";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { placeOfPath } from "../../src/frame.js";
import { createNoticeBoard, preload, type NoticeReport } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle } from "../../src/pages.js";

beforeAll(() => preload());

/**
 * A HOST'S "REPORT THIS" ANSWERS THE FRAMEWORK'S OWN TOAST (FR-237).
 *
 * Graview Cloud's own error toasts carry "Report this", opening its
 * feedback dialog prefilled with the error, the app, the place and the
 * version; the toasts the framework raises itself — a tidying the host
 * refused, a take-back that failed — carried none. Given `onReport`, the
 * embed draws the button on those and hands the host the toast's words,
 * the page the reader is on and the framework's version; what the host
 * says through `notify` is left as it was.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const app = defineApp({ name: "Field notes", schema: createSchema([note]), mutations: [] });

let handle: PagesEmbedHandle | undefined;
let host: HTMLElement;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
});

const reports = () => [...host.querySelectorAll<HTMLButtonElement>('[data-testid="notice-report"]')];
const toasts = () => [...host.querySelectorAll('[data-testid="notices-toasts"] [data-testid="notice"]')];

describe("a host's Report this in an embed", () => {
  it("is drawn on an error the pages raised, and hands the host the words, the record's page and the version", async () => {
    const told: NoticeReport[] = [];
    const board = createNoticeBoard();
    host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      handle = mountPages(host, { app, fonts: false, path: "/notes/n%201", notices: board, onReport: (report) => told.push(report) });
    });
    // What the pages say on the board is said in the framework's voice, as the embed hands it to them.
    await act(async () => void frameworkVoice(board).notify({ kind: "toast", tone: "bad", sentence: "“Up next” could not be hidden. The host refused it." }));
    expect(reports().map((one) => one.getAttribute("aria-label"))).toEqual(["Report this: “Up next” could not be hidden."]);
    await act(async () => reports()[0]!.click());
    expect(told).toEqual([{ message: "“Up next” could not be hidden. The host refused it.", place: "notes", record: "n 1", version: FRAMEWORK_VERSION }]);
    expect(toasts()).toHaveLength(1);
  });

  it("is not drawn on what the host says through the handle, and not at all without the hook", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      handle = mountPages(host, { app, fonts: false, onReport: () => {} });
    });
    await act(async () => void handle!.notify({ kind: "toast", tone: "bad", sentence: "That change was refused." }));
    expect(toasts()).toHaveLength(1);
    expect(reports()).toEqual([]);
    await act(async () => handle?.unmount());
    const board = createNoticeBoard();
    await act(async () => {
      handle = mountPages(host, { app, fonts: false, notices: board });
    });
    await act(async () => void frameworkVoice(board).notify({ kind: "toast", tone: "bad", sentence: "“Up next” could not be hidden." }));
    expect(toasts()).toHaveLength(1);
    expect(reports()).toEqual([]);
  });

  it("says where the routed face's reader is from the page's path", () => {
    expect(placeOfPath("/")).toEqual({ place: "home" });
    expect(placeOfPath("/?sort=due")).toEqual({ place: "home" });
    expect(placeOfPath("/notes")).toEqual({ place: "notes" });
    expect(placeOfPath("/notes/n-1?section=facts#top")).toEqual({ place: "notes", record: "n-1" });
    expect(placeOfPath("/places/up-next?of=notes")).toEqual({ place: "up-next" });
    expect(placeOfPath("/problems")).toEqual({ place: "problems" });
  });
});
