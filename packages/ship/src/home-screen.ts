import type { Brand } from "@graview/core";
import { homeScreenOf, type HomeScreen } from "@graview/core/head";

/**
 * AN APP ON A HOME SCREEN, SERVED (Roadmap f-app-icons-home-screen): the
 * files `homeScreenOf` names — the web manifest, an SVG mark at
 * `/icon.svg` — answered at their paths, and a PNG made from the brand's
 * own PNG answered by sending the browser to it (this server makes no
 * PNG of its own: it has no rasterizer, so an SVG or emoji mark is offered
 * as SVG alone). Anything else is not its to answer.
 */
export function homeScreenAnswer(brand: Brand | undefined, options: { readonly name?: string } = {}): { readonly screen: HomeScreen; answer(request: Request): Response | undefined } {
  const screen = homeScreenOf(brand, options.name !== undefined ? { name: options.name } : {});
  const files = new Map(screen.files.map((file) => [file.path, file]));
  return {
    screen,
    answer(request) {
      if (request.method !== "GET" && request.method !== "HEAD") return undefined;
      const file = files.get(new URL(request.url).pathname);
      if (!file) return undefined;
      if (file.body !== undefined) return new Response(request.method === "HEAD" ? null : file.body, { headers: { "content-type": file.type, "cache-control": "no-cache" } });
      if (file.from && "png" in file.from) return new Response(null, { status: 307, headers: { location: file.from.png, "cache-control": "no-cache" } });
      return undefined;
    },
  };
}
