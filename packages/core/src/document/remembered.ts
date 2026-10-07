import type { GraviewDocument } from "./schema.js";

/*
 * WHERE AN APP CAME FROM, in a module of its own: the page that builds an
 * app from a compiled one (compiled.ts) remembers its document so that
 * `toDocument(app)` gives it back, and must not carry `toDocument` — nor the
 * document format's schema it reads — to do so (FR-123).
 */
const COMPILED_FROM = new WeakMap<object, GraviewDocument>();

/** Remembered by the compiler: the document an app was compiled from. */
export function rememberDocument(app: object, document: GraviewDocument): void {
  COMPILED_FROM.set(app, document);
}

/** The document an app was compiled from, if it was. */
export function documentOf(app: object): GraviewDocument | undefined {
  return COMPILED_FROM.get(app);
}
