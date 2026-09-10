import { mount, type EmbedFace, type EmbedHandle } from "@graview/embed";
import { aggregateId } from "@graview/layout";
import { CHAPTERS, type Chapter } from "./domain/chapters.js";
import { seedbedPages } from "./ui/pages.js";
import { seedbedViews } from "./ui/views.js";

/**
 * THE CHAPTERS, LIVE, ON THE PAGE THAT EXPLAINS THIS THING.
 *
 * `docs/site/index.html` used to show a photograph per chapter. This is the
 * bundle that replaces each with the chapter itself: the same declaration,
 * the same seed, opened at the same stop the photograph was taken at, with
 * the three faces a click away. Built by `vite build --config
 * vite.site.config.ts` into `docs/site/chapters.js`; the page's own copy
 * loads it by name and the artifact build inlines it.
 */
declare global {
  interface Window {
    graviewChapters?: { mount: typeof mountChapter; mountAll: typeof mountAll; chapters: readonly Chapter[] };
  }
}

/** The face a chapter's stop implies, when the page does not say. */
function faceOf(chapter: Chapter): EmbedFace {
  if (chapter.face === "pages") return "pages";
  return chapter.stop.includes("overview=1") ? "graview" : "scene";
}

export function mountChapter(element: HTMLElement, n: number, face?: EmbedFace, label?: string): EmbedHandle {
  const chapter = CHAPTERS[n - 1];
  if (!chapter) throw new Error(`No chapter ${n}; there are ${CHAPTERS.length}.`);
  const schema = chapter.app.schema;
  return mount(element, {
    app: chapter.app,
    seed: chapter.seed,
    face: face ?? faceOf(chapter),
    // A stop may name a group by kind; the id is the layout's to mint.
    ...(chapter.stop ? { stop: chapter.stop.replace(/agg:([a-z-]+)/g, (_, kind: string) => aggregateId(kind)) } : {}),
    path: (chapter.path ?? "/pages").replace(/^\/pages/, "") || "/",
    ...(chapter.principal ? { principal: chapter.principal } : {}),
    views: (s) => seedbedViews(s as never, { lens: chapter.lens, board: chapter.board }) as never,
    ...(chapter.pages ? { pages: seedbedPages(schema) as never } : {}),
    standing: "The garden keeps its agreements",
    // The page may name an embed itself: the opener carries chapter one
    // too, and two regions called "Chapter 1" is one landmark said twice.
    label: label ?? `Chapter ${chapter.n}`,
    scheme: document.documentElement.dataset["theme"] === "dark" || (!document.documentElement.dataset["theme"] && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light",
  });
}

/**
 * Every `[data-graview-chapter]` on the page, mounted — as it comes near.
 * Twelve applications at once is a lot to ask of a first paint; each one
 * mounts when the reader is a screen away, and stays. A sweep on scroll
 * rather than an IntersectionObserver: a fast scroll can jump an element
 * through the observer's margin between two of its checks, and a chapter
 * that stayed "loading…" because the reader scrolled quickly is worse
 * than a sweep that costs one rectangle per chapter per frame.
 */
export function mountAll(root: ParentNode = document): void {
  const elements = [...root.querySelectorAll<HTMLElement>("[data-graview-chapter]")];
  const mountOne = (element: HTMLElement) => {
    if (element.dataset["graviewMounted"]) return;
    element.dataset["graviewMounted"] = "1";
    element.replaceChildren();
    mountChapter(element, Number(element.dataset["graviewChapter"]), element.dataset["face"] as EmbedFace | undefined, element.dataset["label"]);
  };
  const NEAR = 900;
  let pending = false;
  const sweep = () => {
    pending = false;
    for (const element of elements) {
      if (element.dataset["graviewMounted"]) continue;
      const rect = element.getBoundingClientRect();
      // Near below, on screen, or already scrolled past: all of these are
      // places a reader can be looking at next.
      if (rect.top < innerHeight + NEAR && rect.bottom > -NEAR) mountOne(element);
    }
  };
  const later = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(sweep);
  };
  addEventListener("scroll", later, { passive: true });
  addEventListener("resize", later, { passive: true });
  sweep();
}

window.graviewChapters = { mount: mountChapter, mountAll, chapters: CHAPTERS };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountAll());
else mountAll();
