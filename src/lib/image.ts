/** Reduce una foto del celular (varios MB) a ≤ maxSize px en WebP antes de subirla. */
export async function downscaleImage(file: File, maxSize = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("No pudimos procesar la foto.");
  const ext = blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `foto.${ext}`, { type: blob.type });
}
