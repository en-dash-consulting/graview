import { createSchema, defineNode, isoDate } from "@graview/core";
import { z } from "@graview/core";

/**
 * A discography: songs, the albums they are on, the artists who made them,
 * and what they are about.
 */
export const song = defineNode("song", {
  description: "A recorded song: a track on a release, one not yet released, or one that was scrapped.",
  fields: z.object({
    label: z.string().min(1).max(100),
    /** The track number on its album: an ordering key. */
    track: z.number().int().min(1).max(99).optional(),
    /** Seconds. */
    duration: z.number().int().min(1).max(3600).optional(),
    // No source for a real catalog says it for every track; unknown is not "No".
    explicit: z.boolean().optional(),
    status: z.enum(["released", "unreleased", "scrapped"]),
    /** When the first demo was cut. */
    demoed: isoDate.optional(),
    notes: z.string().max(2000).optional(),
  }),
  edges: {
    by: {
      to: ["artist"],
      description: "the artist whose song it is",
      inverse: "their songs",
    },
    features: {
      to: ["artist"],
      description: "who it features",
      inverse: "the songs they are featured on",
    },
    "produced-by": {
      to: ["artist"],
      description: "who produced it",
      inverse: "the songs they produced",
    },
    about: {
      to: ["theme"],
      description: "what it is about",
      inverse: "the songs about it",
    },
  },
  plural: "Songs",
  label: (node) => node.label,
  fieldRoles: { order: "track" },
  lifecycle: { field: "status", retired: ["unreleased", "scrapped"] },
  display: {
    labels: { track: "Track", duration: "Length", explicit: "Explicit", demoed: "First demo" },
    format: {
      duration: (value) => `${Math.floor(Number(value) / 60)}:${String(Number(value) % 60).padStart(2, "0")}`,
    },
  },
});

export const album = defineNode("album", {
  description: "A release: an album, an EP, a single, a mixtape or a compilation.",
  fields: z.object({
    label: z.string().min(1).max(100),
    released: isoDate.optional(),
    type: z.enum(["album", "ep", "single", "mixtape", "compilation"]),
  }),
  edges: {
    tracks: {
      to: ["song"],
      description: "the songs on it",
      inverse: "the releases it is on",
    },
    "released-by": {
      to: ["artist"],
      description: "the artist whose release it is",
      inverse: "their releases",
    },
  },
  plural: "Albums",
  label: (node) => node.label,
  fieldRoles: { start: "released" },
  display: { labels: { released: "Released", type: "Type" } },
});

/** A person or a group who records, features on, or produces songs. */
export const artist = defineNode("artist", {
  description: "Someone who makes the music: records it, features on it, or produces it.",
  fields: z.object({
    label: z.string().min(1).max(60),
  }),
  plural: "Artists",
  label: (node) => node.label,
});

export const theme = defineNode("theme", {
  description: "Recurring subject matter a song is about.",
  fields: z.object({ label: z.string().min(1).max(60) }),
  plural: "Themes",
  label: (node) => node.label,
});

export const era = defineNode("era", {
  description: "A concept or an era that runs through several releases.",
  fields: z.object({
    label: z.string().min(1).max(60),
    notes: z.string().max(2000).optional(),
  }),
  edges: {
    spans: {
      to: ["album", "song"],
      description: "the releases and songs in it",
      inverse: "the era it belongs to",
    },
  },
  plural: "Eras",
  label: (node) => node.label,
});

export const discographySchema = createSchema([song, album, artist, theme, era]);
export type DiscographySchema = typeof discographySchema;
