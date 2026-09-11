import { mount, mountWhenNear, type EmbedFace, type EmbedHandle } from "@graview/embed";
import { CHAPTERS, type Chapter } from "./domain/chapters.js";
import { seedbedDesign } from "./ui/design.js";
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

export function mountChapter(element: HTMLElement, n: number, face?: EmbedFace, label?: string): EmbedHandle {
  const chapter = CHAPTERS[n - 1];
  if (!chapter) throw new Error(`No chapter ${n}; there are ${CHAPTERS.length}.`);
  const schema = chapter.app.schema;
  return mount(element, {
    app: chapter.app,
    seed: chapter.seed,
    // The page's own say first, then the chapter's face (a pages chapter
    // opens on its pages), else the stop decides — altitude or the scene.
    ...(face ? { face } : chapter.face === "pages" ? { face: "pages" as const } : {}),
    ...(chapter.stop ? { stop: chapter.stop } : {}),
    path: (chapter.path ?? "/pages").replace(/^\/pages/, "") || "/",
    ...(chapter.principal ? { principal: chapter.principal } : {}),
    ...(chapter.seats ? { seats: chapter.seats } : {}),
    /*
     * The cast here is the CHAPTER MODEL's, not the embed's: a chapter holds
     * a different schema per chapter, so `chapter.app` is a
     * `GraviewApp<AnySchema>` and `s` arrives erased. An app with one
     * declaration passes its own typed registry with no cast at all — see
     * the `src/embed.tsx` every scaffolded project now starts with.
     */
    views: (s) => seedbedViews(s as never, { lens: chapter.lens, board: chapter.board, map: chapter.map ?? false }) as never,
    ...(chapter.pages ? { pages: (chapter.design ? seedbedDesign(schema) : seedbedPages(schema)) as never } : {}),
    standing: "The garden keeps its agreements",
    // The page may name an embed itself: the opener carries chapter one
    // too, and two regions called "Chapter 1" is one landmark said twice.
    label: label ?? `Chapter ${chapter.n}`,
  });
}

/** Every `[data-graview-chapter]` on the page, mounted as the reader comes near. */
export function mountAll(root: ParentNode = document): void {
  mountWhenNear([...root.querySelectorAll<HTMLElement>("[data-graview-chapter]")], (element) => {
    element.replaceChildren();
    mountChapter(element, Number(element.dataset["graviewChapter"]), element.dataset["face"] as EmbedFace | undefined, element.dataset["label"]);
  });
}

window.graviewChapters = { mount: mountChapter, mountAll, chapters: CHAPTERS };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountAll());
else mountAll();
