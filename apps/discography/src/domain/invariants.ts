import { bindSchema, type Violation } from "@graview/core";
import { discographySchema } from "./schema.js";

const { defineInvariant } = bindSchema(discographySchema);

/**
 * A featured artist is somebody else. "Hometown (Again) feat. Mara Vey" on
 * Mara Vey's own song is a credit typed twice, not a collaboration.
 */
export const featuresSomebodyElse = defineInvariant("features-somebody-else", {
  label: "A feature is somebody else",
  description: "A song does not feature its own artist.",
  scope: { kind: "song" },
  repairs: ["unfeature"],
  evaluate({ graph, subject }): Violation[] {
    const own = new Set(graph.out(subject.id, "by").map((artist) => artist.id));
    return graph
      .out(subject.id, "features")
      .filter((artist) => own.has(artist.id))
      .map((artist) => ({
        invariant: "features-somebody-else",
        subjectId: subject.id,
        label: subject.label,
        message: `${subject.label} features ${artist.label}, whose song it already is`,
        nodeIds: [subject.id, artist.id],
        repairs: [{ mutation: "unfeature", args: { songId: subject.id, artistId: artist.id }, label: `Drop ${artist.label} as a feature` }],
      }));
  },
});

/**
 * Two songs a release introduces do not share a track number.
 *
 * A song's number is its place on its HOME: the first album, EP or mixtape
 * it came out on, or — for a song that was only ever a single or on
 * somebody's compilation — the first release of any kind. A single that
 * leads an album is numbered 1 on the single and 7 on the album, and the
 * album is where a person looks for it. A compilation, a box set or a
 * soundtrack carries songs numbered on their own albums, and two of them
 * sharing a number there is not a clash — so a release is judged only on
 * the songs whose home it is.
 */
export const tracksInOrder = defineInvariant("tracks-in-order", {
  label: "One song per track number",
  description: "No two songs a release introduces share a track number.",
  scope: { kind: "album" },
  repairs: ["edit-song"],
  evaluate({ graph, subject }): Violation[] {
    /*
     * The song's home, as the catalogue numbers it: among its albums, EPs
     * and mixtapes if it has any, otherwise among all its releases, the
     * earliest with a full date. A release known only by its year is a home
     * only when none of the candidates has a date; on the same day, every
     * one of them is.
     */
    const BODY = new Set(["album", "ep", "mixtape"]);
    const introduced = (song: { id: string }) => {
      const releases = graph.in(song.id, "tracks").filter((other) => other.kind === "album");
      const bodies = releases.filter((other) => BODY.has(String(other.type)));
      const pool = bodies.length > 0 ? bodies : releases;
      if (!pool.some((other) => other.id === subject.id)) return false;
      const dated = pool.flatMap((other) => (other.released ? [other.released] : []));
      if (dated.length === 0) return true;
      if (!subject.released) return false;
      return dated.every((released) => released >= subject.released!);
    };
    const songs = graph
      .out(subject.id, "tracks")
      .flatMap((song) => (song.kind === "song" && song.track !== undefined && introduced(song) ? [{ ...song, track: song.track }] : []));
    const byTrack = new Map<number, typeof songs>();
    for (const song of songs) byTrack.set(song.track, [...(byTrack.get(song.track) ?? []), song]);
    return [...byTrack.entries()]
      .filter(([, clash]) => clash.length > 1)
      .map(([track, clash]) => ({
        invariant: "tracks-in-order",
        subjectId: subject.id,
        label: subject.label,
        message: `${clash.map((song) => song.label).join(" and ")} are both track ${track} on ${subject.label}`,
        nodeIds: [subject.id, ...clash.map((song) => song.id)],
        // Renumber one of them: which number is the person's to say.
        repairs: clash.map((song) => ({
          mutation: "edit-song",
          args: { id: song.id },
          missing: ["track"],
          label: `Renumber ${song.label}`,
        })),
      }));
  },
});

/** A single comes out before (or with) the album it is taken from. */
export const singleBeforeAlbum = defineInvariant("single-before-album", {
  label: "A single leads its album",
  description: "A single is released no later than the album its song is on.",
  scope: { kind: "album" },
  repairs: ["take-off", "edit-album"],
  evaluate({ graph, subject }): Violation[] {
    if (subject.type !== "single" || !subject.released) return [];
    const out: Violation[] = [];
    for (const song of graph.out(subject.id, "tracks")) {
      for (const album of graph.in(song.id, "tracks")) {
        if (album.id === subject.id || album.kind !== "album" || album.type !== "album" || !album.released) continue;
        if (subject.released <= album.released) continue;
        out.push({
          invariant: "single-before-album",
          subjectId: subject.id,
          label: subject.label,
          message: `The single ${subject.label} (${subject.released}) came out after ${album.label} (${album.released}), the album its song is on`,
          nodeIds: [subject.id, album.id, song.id],
          repairs: [
            { mutation: "edit-album", args: { id: subject.id }, missing: ["released"], label: `Correct when ${subject.label} came out` },
            { mutation: "take-off", args: { songId: song.id, albumId: subject.id }, label: `Take ${song.label} off the single` },
          ],
        });
      }
    }
    return out;
  },
});

/*
 * "A single leads its album" is not kept: in a real catalogue singles follow
 * their album all the time (K.O.D.'s "Show Me a God" came two weeks after it),
 * so the rule flagged the discography rather than a mistake in it.
 */
export const invariants = [featuresSomebodyElse, tracksInOrder];
