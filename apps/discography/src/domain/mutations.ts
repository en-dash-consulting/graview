import { bindSchema, isoDate, nodeRef, type GraphReader } from "@graview/core";
import { z } from "@graview/core";
import { discographySchema } from "./schema.js";

const { defineMutation } = bindSchema(discographySchema);

type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;
const nameOf = (graph: Reader, id: string): string => {
  const node = graph.getNode(id);
  return typeof node?.["label"] === "string" ? (node["label"] as string) : id;
};
const n = (graph: unknown, id: string) => nameOf(graph as Reader, id);

/* ------------------------------------------------------------ beginnings */

export const addSong = defineMutation("add-song", {
  title: "Add a song",
  description: "Bring a new song into the discography, unreleased until it is released.",
  creates: ["song"],
  input: z.object({ label: z.string().min(1).max(100) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "song"), kind: "song", label: args.label, status: "unreleased", explicit: false });
  },
});

export const addAlbum = defineMutation("add-album", {
  title: "Add a release",
  description: "Add an album, an EP, a single or a mixtape.",
  creates: ["album"],
  input: z.object({
    label: z.string().min(1).max(100),
    type: z.enum(["album", "ep", "single", "mixtape", "compilation"]),
    released: isoDate.optional(),
  }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({
      id: ctx.freshId(args.label, "album"),
      kind: "album",
      label: args.label,
      type: args.type,
      ...(args.released ? { released: args.released } : {}),
    });
  },
});

export const addArtist = defineMutation("add-artist", {
  title: "Add an artist",
  description: "Add someone who records, features on or produces songs.",
  creates: ["artist"],
  input: z.object({ label: z.string().min(1).max(100) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "artist"), kind: "artist", label: args.label });
  },
});

export const addTheme = defineMutation("add-theme", {
  title: "Add a theme",
  description: "Name some recurring subject matter.",
  creates: ["theme"],
  input: z.object({ label: z.string().min(1).max(100) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "theme"), kind: "theme", label: args.label });
  },
});

export const addEra = defineMutation("add-era", {
  title: "Add an era",
  description: "Name a concept or an era that runs through several releases.",
  creates: ["era"],
  input: z.object({ label: z.string().min(1).max(100) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "era"), kind: "era", label: args.label });
  },
});

/* ------------------------------------------------------------- the life */

export const releaseSong = defineMutation("release-song", {
  title: "Release it",
  description: "Mark a song released.",
  subject: { kinds: ["song"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["song"]) }),
  describe: (args, graph) => `Release ${n(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "released" });
  },
});

export const scrapSong = defineMutation("scrap-song", {
  title: "Scrap it",
  description: "Mark a song scrapped. It leaves the picture, never the record.",
  subject: { kinds: ["song"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["song"]) }),
  describe: (args, graph) => `Scrap ${n(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "scrapped" });
  },
});

/* ------------------------------------------------------------- the ties */

export const putOn = defineMutation("put-on", {
  title: "Put it on a release",
  fromTheOtherEnd: "Add a song to the tracklist",
  description: "Put a song on an album, an EP, a single or a mixtape.",
  subject: { kinds: ["song"], arg: "songId" },
  connects: ["tracks"],
  input: z.object({ songId: nodeRef(["song"]), albumId: nodeRef(["album"]) }),
  describe: (args, graph) => `Put ${n(graph, args.songId)} on ${n(graph, args.albumId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "tracks", from: args.albumId, to: args.songId });
  },
});

export const takeOff = defineMutation("take-off", {
  title: "Take it off a release",
  fromTheOtherEnd: "Take a song off the tracklist",
  description: "Take a song off an album's tracklist.",
  subject: { kinds: ["song"], arg: "songId" },
  severs: ["tracks"],
  input: z.object({ songId: nodeRef(["song"]), albumId: nodeRef(["album"]) }),
  describe: (args, graph) => `Take ${n(graph, args.songId)} off ${n(graph, args.albumId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "tracks", from: args.albumId, to: args.songId });
  },
});

export const credit = defineMutation("credit", {
  title: "Credit the artist",
  fromTheOtherEnd: "Credit a song to them",
  description: "Say whose song it is.",
  subject: { kinds: ["song"], arg: "songId" },
  connects: ["by"],
  input: z.object({ songId: nodeRef(["song"]), artistId: nodeRef(["artist"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} is by ${n(graph, args.artistId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "by", from: args.songId, to: args.artistId });
  },
});

export const uncredit = defineMutation("uncredit", {
  title: "Take the credit away",
  fromTheOtherEnd: "Take a song's credit away from them",
  description: "Say a song is not theirs after all.",
  subject: { kinds: ["song"], arg: "songId" },
  severs: ["by"],
  input: z.object({ songId: nodeRef(["song"]), artistId: nodeRef(["artist"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} is no longer by ${n(graph, args.artistId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "by", from: args.songId, to: args.artistId });
  },
});

export const feature = defineMutation("feature", {
  title: "Feature an artist",
  fromTheOtherEnd: "Feature them on a song",
  description: "Say a song features another artist.",
  subject: { kinds: ["song"], arg: "songId" },
  connects: ["features"],
  input: z.object({ songId: nodeRef(["song"]), artistId: nodeRef(["artist"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} features ${n(graph, args.artistId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "features", from: args.songId, to: args.artistId });
  },
});

export const unfeature = defineMutation("unfeature", {
  title: "Drop a feature",
  fromTheOtherEnd: "Drop them from a song",
  description: "Say a song no longer features an artist.",
  subject: { kinds: ["song"], arg: "songId" },
  severs: ["features"],
  input: z.object({ songId: nodeRef(["song"]), artistId: nodeRef(["artist"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} no longer features ${n(graph, args.artistId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "features", from: args.songId, to: args.artistId });
  },
});

export const produce = defineMutation("produce", {
  title: "Credit a producer",
  fromTheOtherEnd: "Credit them as producer of a song",
  description: "Say who produced a song.",
  subject: { kinds: ["song"], arg: "songId" },
  connects: ["produced-by"],
  input: z.object({ songId: nodeRef(["song"]), artistId: nodeRef(["artist"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} is produced by ${n(graph, args.artistId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "produced-by", from: args.songId, to: args.artistId });
  },
});

export const unproduce = defineMutation("unproduce", {
  title: "Take a production credit away",
  fromTheOtherEnd: "Take their production credit away",
  description: "Say someone did not produce a song after all.",
  subject: { kinds: ["song"], arg: "songId" },
  severs: ["produced-by"],
  input: z.object({ songId: nodeRef(["song"]), artistId: nodeRef(["artist"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} is no longer produced by ${n(graph, args.artistId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "produced-by", from: args.songId, to: args.artistId });
  },
});

export const releaseBy = defineMutation("release-by", {
  title: "Say whose release it is",
  fromTheOtherEnd: "Give them a release",
  description: "Name the artist whose release it is.",
  subject: { kinds: ["album"], arg: "albumId" },
  connects: ["released-by"],
  severs: ["released-by"],
  input: z.object({ albumId: nodeRef(["album"]), artistId: nodeRef(["artist"]) }),
  describe: (args, graph) => `${n(graph, args.albumId)} is by ${n(graph, args.artistId)}`,
  apply(ctx, args) {
    for (const artist of ctx.graph.out(args.albumId, "released-by")) ctx.removeEdge({ kind: "released-by", from: args.albumId, to: artist.id });
    ctx.addEdge({ kind: "released-by", from: args.albumId, to: args.artistId });
  },
});

export const tag = defineMutation("tag", {
  title: "Say what it is about",
  fromTheOtherEnd: "Tag a song with it",
  description: "Tag a song with a theme.",
  subject: { kinds: ["song"], arg: "songId" },
  connects: ["about"],
  input: z.object({ songId: nodeRef(["song"]), themeId: nodeRef(["theme"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} is about ${n(graph, args.themeId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "about", from: args.songId, to: args.themeId });
  },
});

export const untag = defineMutation("untag", {
  title: "Say it is not about that",
  fromTheOtherEnd: "Untag a song",
  description: "Take a theme off a song.",
  subject: { kinds: ["song"], arg: "songId" },
  severs: ["about"],
  input: z.object({ songId: nodeRef(["song"]), themeId: nodeRef(["theme"]) }),
  describe: (args, graph) => `${n(graph, args.songId)} is no longer about ${n(graph, args.themeId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "about", from: args.songId, to: args.themeId });
  },
});

export const span = defineMutation("span", {
  title: "Put it in the era",
  fromTheOtherEnd: "Place it in an era",
  description: "Say a release or a song belongs to an era.",
  subject: { kinds: ["era"], arg: "eraId" },
  connects: ["spans"],
  input: z.object({ eraId: nodeRef(["era"]), memberId: nodeRef(["album", "song"]) }),
  describe: (args, graph) => `${n(graph, args.memberId)} belongs to ${n(graph, args.eraId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "spans", from: args.eraId, to: args.memberId });
  },
});

export const unspan = defineMutation("unspan", {
  title: "Take it out of the era",
  fromTheOtherEnd: "Take it out of its era",
  description: "Say a release or a song does not belong to an era.",
  subject: { kinds: ["era"], arg: "eraId" },
  severs: ["spans"],
  input: z.object({ eraId: nodeRef(["era"]), memberId: nodeRef(["album", "song"]) }),
  describe: (args, graph) => `${n(graph, args.memberId)} is no longer in ${n(graph, args.eraId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "spans", from: args.eraId, to: args.memberId });
  },
});

export const mutations = [
  addSong, addAlbum, addArtist, addTheme, addEra,
  releaseSong, scrapSong,
  putOn, takeOff, credit, uncredit, feature, unfeature, produce, unproduce, releaseBy,
  tag, untag, span, unspan,
];
