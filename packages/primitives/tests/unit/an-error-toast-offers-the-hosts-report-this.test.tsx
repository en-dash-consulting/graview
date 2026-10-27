// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { FRAMEWORK_VERSION } from "@graview/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createNoticeBoard, fetchNotices, frameworkVoice, Notices, sceneReportWhere, type NoticeReport, type NoticeReporting } from "../../src/frame.js";
import { firstSentenceOf } from "../../src/notice-stacks.js";

// What draws a notice is fetched with the first; here it is fetched before.
beforeAll(() => fetchNotices());

/**
 * AN ERROR TOAST OFFERS THE HOST'S "REPORT THIS" (FR-237).
 *
 * Graview Cloud gives its own error and warning toasts a "Report this"
 * that opens its feedback dialog prefilled with the error, the app, the
 * place and the version; the toasts the framework raises itself could
 * carry none. Given `onReport`, every warning or error toast the framework
 * raises draws a native button named for the toast, hands the host the
 * toast's words, where the reader is and the framework's version, and
 * stays while the button has focus. The host's own notices carry none.
 */
let root: Root | undefined;
let host: HTMLElement;
afterEach(async () => {
  vi.useRealTimers();
  await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
});

async function drawn(report?: NoticeReporting) {
  const board = createNoticeBoard();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<Notices board={board} anchor={() => host} {...(report ? { report } : {})} />));
  return { board, framework: frameworkVoice(board) };
}

const cards = () => [...document.querySelectorAll<HTMLElement>('[data-testid="notice"]')];
const reports = () => [...document.querySelectorAll<HTMLButtonElement>('[data-testid="notice-report"]')];

describe("a host's Report this on the framework's own toasts", () => {
  it("is a native button named for the toast on an error the framework raised, and hands the host its words, where the reader is and the version", async () => {
    const told: NoticeReport[] = [];
    const { framework } = await drawn({ tell: (report) => told.push(report), where: () => ({ place: "tasks", record: "t-paint" }) });
    await act(async () => void framework.notify({ kind: "toast", tone: "bad", sentence: "“Up next” could not be hidden. The host is holding the app while a repair is checked.", code: "held" }));
    const [button] = reports();
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.textContent).toBe("Report this");
    expect(button?.getAttribute("aria-label")).toBe("Report this: “Up next” could not be hidden.");
    await act(async () => button!.click());
    expect(told).toEqual([{ message: "“Up next” could not be hidden. The host is holding the app while a repair is checked.", code: "held", place: "tasks", record: "t-paint", version: FRAMEWORK_VERSION }]);
    // The toast stays once pressed: the host's dialog opens over it, and the words are still there to read.
    expect(cards()).toHaveLength(1);
  });

  it("is on a warning too, and on neither a good nor a plain toast of the framework's", async () => {
    const { framework } = await drawn({ tell: () => {}, where: () => ({}) });
    await act(async () => {
      framework.notify({ kind: "toast", tone: "warn", sentence: "Nothing to take back." });
      framework.notify({ kind: "toast", tone: "good", sentence: "Kept “Up next” as a lens." });
      framework.notify({ kind: "toast", sentence: "Took back “Mark done”." });
    });
    expect(cards().map((card) => card.querySelector('[data-testid="notice-report"]') !== null)).toEqual([true, false, false]);
  });

  it("is never on the host's own notices, and not drawn at all when the host gave no hook", async () => {
    const { board } = await drawn({ tell: () => {}, where: () => ({}) });
    await act(async () => void board.notify({ kind: "toast", tone: "bad", sentence: "That change was refused." }));
    expect(cards()).toHaveLength(1);
    expect(reports()).toEqual([]);
    await act(async () => root?.unmount());
    root = undefined;
    const { framework } = await drawn();
    await act(async () => void framework.notify({ kind: "toast", tone: "bad", sentence: "“Up next” could not be hidden." }));
    expect(cards()).toHaveLength(1);
    expect(reports()).toEqual([]);
  });

  it("holds the toast while the button has focus, and lets it go once focus leaves", async () => {
    vi.useFakeTimers();
    const { framework } = await drawn({ tell: () => {}, where: () => ({}) });
    await act(async () => void framework.notify({ kind: "toast", tone: "bad", sentence: "“Up next” could not be hidden." }));
    const [button] = reports();
    await act(async () => button!.focus());
    expect(document.activeElement).toBe(button);
    await act(async () => void vi.advanceTimersByTime(20_000));
    expect(cards()).toHaveLength(1);
    // The keyboard moves on, as a person's does: the toast's time runs out as before.
    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    await act(async () => elsewhere.focus());
    await act(async () => void vi.advanceTimersByTime(7_000));
    expect(cards()).toEqual([]);
    elsewhere.remove();
  });

  it("names the toast by its first sentence, and says where the scene's reader is as the overview and its record", () => {
    expect(firstSentenceOf("“Up next” could not be hidden. The host is read-only.")).toBe("“Up next” could not be hidden.");
    expect(firstSentenceOf("Nothing to take back")).toBe("Nothing to take back");
    expect(firstSentenceOf("Refused! Try again?")).toBe("Refused!");
    expect(sceneReportWhere("t-paint")).toEqual({ place: "overview", record: "t-paint" });
    expect(sceneReportWhere("aggregate:task")).toEqual({ place: "overview" });
    expect(sceneReportWhere(null)).toEqual({ place: "overview" });
  });
});
