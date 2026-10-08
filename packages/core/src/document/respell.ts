/*
 * KEYS RESPELLED WITHIN A FORMAT (FR-134).
 *
 * 0.1.16 spelled the framework in American English and renamed a key a
 * document carries without moving the format: a setting says `honored`,
 * where every document `toDocument` wrote before said `honoured`. Its notes
 * said the document format was unchanged, and Graview Cloud's stored
 * documents stopped compiling. A stored document is history, and history is
 * not rewritten by a spelling: so a document is read with each key as it is
 * spelled now, and the next one written says the new name.
 *
 * Each line is one key under one place: `where` is a dotted path from the
 * document's root, `[]` meaning every item of a list. A document that says
 * both keeps the current one. A respelling is not a format change — a build
 * that predates it reads the old spelling, and the one after it reads both —
 * so it lives here, beside the format's upgrade steps rather than among
 * them, and is read before them on every document, whatever its version.
 *
 * This module imports nothing: a hosted page handed a compiled app reads its
 * document through here (`appFrom`), and must not pay for the schema.
 *
 * A key renamed in the document format from now on is a line here, and
 * `tests/document/fixtures/` keeps a document from the build before as it
 * wrote it (`an-older-document-keeps-compiling.test.ts`).
 */

export interface Respelling {
  /** Where the key lives: a dotted path, `[]` for every item of a list. */
  readonly where: string;
  /** The key as an older build wrote it. */
  readonly was: string;
  /** The key as this build reads and writes it. */
  readonly now: string;
  /** The version that renamed it. */
  readonly since: string;
}

export const RESPELLED: readonly Respelling[] = [
  { where: "settings[]", was: "honoured", now: "honored", since: "0.1.16" },
  // What the scene is called: the name of its tab beside the places (FR-132), now its word on the bar's switch (FR-137).
  { where: "pages", was: "overview", now: "scene", since: "0.1.17" },
];

export interface Respelled<T = unknown> {
  /** The document with each key spelled as now: the one handed when nothing needed it, never changed in place. */
  readonly document: T;
  /** Each key that was respelled, by its path in the document handed (`settings.0.honoured`). */
  readonly respelled: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A document with every key in RESPELLED read as its current name. Anything that is not a document comes back as it was. */
export function respellDocument<T>(document: T, respellings: readonly Respelling[] = RESPELLED): Respelled<T> {
  if (!isRecord(document)) return { document, respelled: [] };
  const respelled: string[] = [];
  let out: unknown = document;
  for (const one of respellings) out = respellAt(out, one.where.split("."), one, "", respelled);
  return { document: out as T, respelled };
}

/** The value with `one` respelled under `steps`, copied only along the path it changed. */
function respellAt(value: unknown, steps: readonly string[], one: Respelling, at: string, respelled: string[]): unknown {
  if (steps.length === 0) {
    if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, one.was)) return value;
    respelled.push(`${at}${one.was}`);
    const { [one.was]: old, ...rest } = value;
    return Object.prototype.hasOwnProperty.call(value, one.now) ? rest : { ...rest, [one.now]: old };
  }
  if (!isRecord(value)) return value;
  const [step, ...more] = steps as [string, ...string[]];
  const every = step.endsWith("[]");
  const key = every ? step.slice(0, -2) : step;
  const inner = value[key];
  let next: unknown = inner;
  if (!every) next = respellAt(inner, more, one, `${at}${key}.`, respelled);
  else if (Array.isArray(inner)) {
    const items = inner.map((item, index) => respellAt(item, more, one, `${at}${key}.${index}.`, respelled));
    next = items.some((item, index) => item !== inner[index]) ? items : inner;
  }
  return next === inner ? value : { ...value, [key]: next };
}
