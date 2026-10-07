/**
 * TWO RELATIONS BETWEEN THE SAME TWO THINGS ARE TWO LINES.
 *
 * A song is by Mara Vey and produced by Mara Vey: two edges, two kinds,
 * two lines — drawn along the identical curve, so the picture showed one
 * and the pointer could only ever pick the one on top. The first was
 * neither visible nor selectable, and "selecting the line offers the act
 * that severs it" was false for it.
 *
 * Lines sharing both ends fan out: each is bowed by its own offset about
 * the shared curve, centered so the bundle stays where one line would be.
 * Returns the offset, in pixels along the curve's normal, for each line.
 */
export function parallelOffsets(
  lines: readonly { readonly key: string; readonly a: string; readonly b: string }[],
  spacing = 16,
): Map<string, number> {
  const pairs = new Map<string, string[]>();
  for (const line of lines) {
    const pair = line.a < line.b ? `${line.a}\u0000${line.b}` : `${line.b}\u0000${line.a}`;
    const held = pairs.get(pair);
    if (held) held.push(line.key);
    else pairs.set(pair, [line.key]);
  }
  const offsets = new Map<string, number>();
  for (const keys of pairs.values()) {
    keys.forEach((key, index) => offsets.set(key, (index - (keys.length - 1) / 2) * spacing));
  }
  return offsets;
}
