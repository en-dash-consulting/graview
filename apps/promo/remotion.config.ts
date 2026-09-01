import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

/**
 * Seekable H.264: 1s GOP @ 30fps, no scene-cut keyframes, faststart.
 * Flags must be inserted *before* `-y <outfile>` or FFmpeg ignores them.
 */
Config.overrideFfmpegCommand(({ args }) => {
  const next = args.filter((a, i, arr) => {
    // Drop any prior copies of these flags (value follows the flag)
    if (
      a === "-g" ||
      a === "-keyint_min" ||
      a === "-sc_threshold" ||
      a === "-x264-params"
    ) {
      return false;
    }
    if (
      i > 0 &&
      (arr[i - 1] === "-g" ||
        arr[i - 1] === "-keyint_min" ||
        arr[i - 1] === "-sc_threshold" ||
        arr[i - 1] === "-x264-params")
    ) {
      return false;
    }
    return true;
  });

  const flags = [
    "-g",
    "30",
    "-keyint_min",
    "30",
    "-sc_threshold",
    "0",
    "-x264-params",
    "keyint=30:min-keyint=30:scenecut=0",
  ];

  const yIdx = next.indexOf("-y");
  const insertAt = yIdx === -1 ? next.length : yIdx;
  next.splice(insertAt, 0, ...flags);

  const movIdx = next.indexOf("-movflags");
  if (movIdx === -1) {
    next.splice(insertAt, 0, "-movflags", "+faststart");
  } else {
    next[movIdx + 1] = "+faststart";
  }

  return next;
});
