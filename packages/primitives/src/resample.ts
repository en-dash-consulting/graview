/**
 * A PICTURE, DRAWN AGAIN NO LARGER THAN `maxEdge` on its long edge, on a
 * canvas of its own size: what `downscale` encodes for a model to look at
 * (`seeding.tsx`) and what a file field's editor sends a host (FR-163).
 * Decoding is the browser's, so a HEIC the browser can read comes out as
 * pixels like any other; one it cannot read throws, and the caller says so.
 */
export async function resample(file: Blob, maxEdge: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("This browser will not give us a canvas to resize with.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}
